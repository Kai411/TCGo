// Sending one payout batch to Billplz.
//
// Extracted from the admin route so the automatic runner uses the identical
// code path. Two implementations of "pay a seller" is how you end up with an
// automated one that skips a check the manual one has.
//
// Ordering is the safety property: the batch is claimed (queued → processing)
// in a transaction *before* Billplz is called, so a double-click, a retry, or
// the runner overlapping with a human can't produce two transfers for the same
// money. Every failure path puts it back to `queued` rather than leaving the
// seller's money stuck in `processing`.

import type { Firestore } from "firebase-admin/firestore";
import {
  createMassPaymentCollection,
  createMassPaymentInstruction,
  mapInstructionStatus,
} from "~/server/utils/billplz";
import { noteError } from "~/server/utils/oplog";
import { toPayoutRecipient } from "~/shared/payout-details";
import type { PayoutBatch } from "~/shared/payout-ledger";

export interface ExecuteActor {
  staffId: string;
  name?: string;
}

export interface ExecuteResult {
  ok: boolean;
  status?: string;
  instructionId?: string;
  /** Set when the batch could not be sent. The batch is back on `queued`. */
  error?: string;
  /** True when the failure is permanent for this batch — don't retry it. */
  permanent?: boolean;
}

/** Thrown for conditions the caller should surface as an HTTP error. */
export class PayoutClaimError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export const executePayoutBatch = async (
  db: Firestore,
  payoutId: string,
  actor: ExecuteActor,
  siteUrl: string,
): Promise<ExecuteResult> => {
  const ref = db.collection("payouts").doc(payoutId);

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new PayoutClaimError("Payout not found", 404);
    const p = snap.data() as PayoutBatch;
    if (p.status !== "queued") {
      throw new PayoutClaimError(`Payout is already ${p.status}`, 409);
    }
    tx.update(ref, {
      status: "processing",
      executedAt: Date.now(),
      executedByUid: actor.staffId,
      executedByName: actor.name ?? null,
      failureReason: null,
    });
    return p;
  });

  const release = async (failureReason: string | null) => {
    await ref.update({
      status: "queued",
      executedAt: null,
      executedByUid: null,
      executedByName: null,
      ...(failureReason ? { failureReason } : {}),
    });
  };

  if (!claimed.autoPayoutSupported) {
    await release(null);
    return {
      ok: false,
      permanent: true,
      error:
        "Automated payout isn't available for this bank. Transfer manually and record it with the bank reference.",
    };
  }

  // The IC is never stored on the ledger — read it fresh from the profile.
  const profileSnap = await db.collection("users").doc(claimed.sellerUid).get();
  const recipient = toPayoutRecipient(profileSnap.data() as any);
  if (!recipient) {
    await release("Seller payout details are incomplete");
    noteError({
      area: "payout",
      code: "payout.recipient_incomplete",
      message: `Payout ${payoutId} can't be sent — the seller's payout details are incomplete.`,
      payoutId,
      userUid: claimed.sellerUid,
      hint: "Ask the seller to complete their bank account, account holder name and IC in seller settings.",
    });
    return { ok: false, permanent: true, error: "Seller payout details are incomplete" };
  }

  try {
    const collection = await createMassPaymentCollection(
      `TCGo payout ${payoutId.slice(0, 8)}`,
      `${siteUrl}/api/billplz/payout-callback`,
    );
    const instruction = await createMassPaymentInstruction({
      collectionId: collection.id,
      // Account details come from the snapshot taken at request time (that's
      // what the seller agreed to); only the IC is read live.
      bankCode: claimed.recipient.bankCode,
      bankAccountNumber: claimed.recipient.bankAccountNumber,
      identityNumber: recipient.identityNumber,
      name: claimed.recipient.name,
      description: `TCGo seller payout - ${claimed.orderIds.length} order(s)`,
      amount: claimed.amount,
      email: claimed.sellerEmail,
    });

    const mapped = mapInstructionStatus(instruction.status);
    const now = Date.now();
    await ref.update({
      billplzCollectionId: collection.id,
      billplzInstructionId: instruction.id,
      billplzStatus: instruction.status ?? null,
      status: mapped,
      ...(mapped === "paid" ? { paidAt: now } : {}),
    });

    // Mirror onto the orders so the seller's funds page reflects it.
    const writes = db.batch();
    for (const id of claimed.orderIds) {
      writes.update(db.collection("compiledOrders").doc(id), {
        payoutStatus: mapped,
        ...(mapped === "paid" ? { payoutPaidAt: now } : {}),
      });
    }
    await writes.commit();

    return { ok: true, status: mapped, instructionId: instruction.id };
  } catch (e: any) {
    const message = e?.message || "Billplz rejected the payout instruction";
    await release(message);
    noteError({
      area: "payout",
      severity: "critical",
      code: "payout.billplz_rejected",
      message: `Billplz rejected payout ${payoutId}: ${message}`,
      payoutId,
      userUid: claimed.sellerUid,
      context: { amount: claimed.amount, bankCode: claimed.recipient.bankCode },
      hint: "The batch is back in the queue. Check the Billplz float and the seller's bank details before retrying.",
      error: e,
    });
    return { ok: false, error: message };
  }
};

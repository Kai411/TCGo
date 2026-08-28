// Admin executes a queued payout batch via Billplz Mass Payment.
//
// Ordering matters: we claim the batch (queued → processing) *before* calling
// Billplz, so a double-click or a retried request can't create two transfers
// for the same money. If Billplz then fails, we roll the batch back to queued.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireAdmin } from "~/server/utils/auth";
import {
  createMassPaymentCollection,
  createMassPaymentInstruction,
  mapInstructionStatus,
} from "~/server/utils/billplz";
import { toPayoutRecipient } from "~/shared/payout-details";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const { payoutId } = (await readBody(event)) as { payoutId?: string };
  if (!payoutId) throw createError({ statusCode: 400, message: "payoutId required" });

  const db = getAdminFirestore();
  const ref = db.collection("payouts").doc(payoutId);

  // Claim it transactionally so two admins (or two clicks) can't both send.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Payout not found" });
    const p = snap.data() as PayoutBatch;
    if (p.status !== "queued") {
      throw createError({
        statusCode: 409,
        message: `Payout is already ${p.status}`,
      });
    }
    tx.update(ref, {
      status: "processing",
      executedAt: Date.now(),
      executedByUid: admin.uid,
      failureReason: null,
    });
    return p;
  });

  if (!claimed.autoPayoutSupported) {
    // Roll back the claim — this one needs /api/payouts/mark-manual instead.
    await ref.update({ status: "queued", executedAt: null, executedByUid: null });
    throw createError({
      statusCode: 400,
      message:
        "Automated payout isn't available for this bank. Transfer manually and record it with the bank reference.",
    });
  }

  // The IC is never stored on the ledger — read it fresh from the profile.
  const profileSnap = await db.collection("users").doc(claimed.sellerUid).get();
  const recipient = toPayoutRecipient(profileSnap.data() as any);
  if (!recipient) {
    await ref.update({
      status: "queued",
      executedAt: null,
      executedByUid: null,
      failureReason: "Seller payout details are incomplete",
    });
    throw createError({ statusCode: 400, message: "Seller payout details are incomplete" });
  }

  try {
    const collection = await createMassPaymentCollection(
      `TCGo payout ${payoutId.slice(0, 8)}`,
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
    // Billplz never accepted the instruction — release the batch so it can be
    // retried rather than leaving the seller's money stuck in "processing".
    await ref.update({
      status: "queued",
      executedAt: null,
      executedByUid: null,
      failureReason: e?.message || "Billplz rejected the payout instruction",
    });
    throw e;
  }
});

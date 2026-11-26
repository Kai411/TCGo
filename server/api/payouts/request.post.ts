// Seller requests payout of their currently-available funds.
//
// Everything that decides how much money leaves the platform is recomputed
// here from order documents — the client sends nothing but its identity. A
// seller can call this all day and never move a figure they don't deserve.

import { formatRM } from "~/shared/format-money";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { recordedPayout, isPayoutEligible, sumAmounts } from "~/shared/payouts";
import { WITHDRAWAL_FEE } from "~/shared/pricing";
import { toPayoutRecipient } from "~/shared/payout-details";
import { bankName } from "~/shared/banks";
import type { PayoutBatch } from "~/shared/payout-ledger";
import { getUserProfile } from "~/server/utils/user-profile";
import { assertNotLocked } from "~/server/utils/security-lock";
import { checkPayoutIdentity } from "~/shared/payout-identity";
import { orderPaymentProblem } from "~/shared/payout-paid";
import { billplzGetBillRecord } from "~/server/utils/billplz";
import { noteError } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  // Held for 24 hours after a password change (shared/security-lock.ts).
  await assertNotLocked(caller.uid);
  const db = getAdminFirestore();

  const profile = (await getUserProfile(db, caller.uid)) as any;
  const recipient = toPayoutRecipient(profile);
  if (!recipient) {
    throw createError({
      statusCode: 400,
      message:
        "Add your bank account, account holder name and IC number before requesting a payout.",
    });
  }

  // Still verified, not suspended, and paying an account in their own name
  // (shared/payout-identity.ts). A name mismatch doesn't refuse the request:
  // the batch is queued on hold and staff approve the account first.
  const identity = checkPayoutIdentity(profile, recipient);
  if (!identity.ok && identity.kind === "block") {
    throw createError({ statusCode: 403, message: identity.message });
  }
  const identityHold = !identity.ok && identity.kind === "hold" ? identity.reason : null;

  // Every online order this seller has money sitting against.
  const ordersQuery = db
    .collection("compiledOrders")
    .where("sellerUid", "==", caller.uid)
    .where("paymentMethod", "==", "billplz")
    .where("status", "==", "delivered");

  const now = Date.now();
  const firstLook = (await ordersQuery.get()).docs.filter((d) =>
    isPayoutEligible(d.data() as any, now),
  );
  if (!firstLook.length) {
    throw createError({ statusCode: 400, message: "No funds are available for payout yet." });
  }

  // Proof of payment comes from Billplz, not from the order: the buyer writes
  // the order document and can't write a Billplz bill (shared/payout-paid.ts).
  // Done before the transaction because it's network calls; the transaction
  // below only pays orders that passed.
  let bills;
  try {
    bills = await Promise.all(
      firstLook.map((d) => {
        const billId = (d.data() as any).billplzBillId;
        return billId ? billplzGetBillRecord(String(billId)) : Promise.resolve(null);
      }),
    );
  } catch (e: any) {
    noteError({
      area: "payout",
      severity: "error",
      code: "payout.bill_check_failed",
      message: `Couldn't confirm payments with Billplz for a payout request: ${e?.message || e}`,
      userUid: caller.uid,
      error: e,
      hint: "Nothing was queued. The seller can try again once Billplz answers.",
    });
    throw createError({
      statusCode: 502,
      message: "We couldn't confirm your sales with the payment provider just now. Try again in a few minutes.",
    });
  }

  const confirmed = new Set<string>();
  firstLook.forEach((d, i) => {
    const order = d.data() as any;
    const problem = orderPaymentProblem(d.id, order, bills[i] ?? null, recordedPayout(order));
    if (!problem) {
      confirmed.add(d.id);
      return;
    }
    noteError({
      area: "payout",
      severity: "critical",
      code: "payout.unpaid_order",
      message: `Order ${d.id} was left out of a payout request: ${problem}.`,
      orderId: d.id,
      userUid: caller.uid,
      context: { billId: order.billplzBillId ?? null },
      hint: "A delivered order Billplz doesn't show as paid is either a data error or someone faking a sale. Check the order and the buyer before paying anything for it.",
    });
  });
  if (!confirmed.size) {
    throw createError({ statusCode: 400, message: "No funds are available for payout yet." });
  }

  // One transaction, so two requests at once can't queue the same orders: the
  // second one re-reads them, sees them queued, and finds nothing to pay.
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ordersQuery);
    const at = Date.now();
    const eligible = snap.docs.filter(
      (d) => confirmed.has(d.id) && isPayoutEligible(d.data() as any, at),
    );
    if (!eligible.length) return null;

    // What the order recorded at settlement — never a fresh calculation. This
    // is the amount that leaves the bank account, so recomputing it would pay
    // a beta-era sale at launch rates the day the constant changes.
    const amounts = eligible.map((d) => recordedPayout(d.data() as any));
    const grossAmount = sumAmounts(amounts);
    if (grossAmount <= 0) return null;

    // The withdrawal fee recovers what Billplz charges to send the transfer.
    // Charged per request rather than per order, so batching is the seller's
    // lever: one request covering twenty sales costs the same RM 1.25 as one
    // covering a single card.
    //
    // Refused rather than clamped when the fee would swallow the payout. A
    // transfer of RM 0.00 costs TCGo the full RM 1.25 to send and gives the
    // seller nothing, and silently shipping it would look like theft on a
    // statement. Better to tell them to wait for one more sale.
    const amount = Math.round((grossAmount - WITHDRAWAL_FEE) * 100) / 100;
    if (amount <= 0) {
      throw createError({
        statusCode: 400,
        message:
          `Withdrawing costs ${formatRM(WITHDRAWAL_FEE)}, and you have ` +
          `${formatRM(grossAmount)} available — so there'd be nothing left to send. ` +
          `Wait until you've a little more, then withdraw it all in one go.`,
      });
    }

    const payoutRef = db.collection("payouts").doc();
    const batch: PayoutBatch = {
      id: payoutRef.id,
      sellerUid: caller.uid,
      sellerName: profile?.customName || profile?.displayName || caller.name || "Seller",
      sellerEmail: profile?.email || caller.email,
      orderIds: eligible.map((d) => d.id),
      amount,
      grossAmount,
      withdrawalFee: WITHDRAWAL_FEE,
      status: "queued",
      recipient: {
        bankCode: recipient.bankCode,
        bankName: bankName(recipient.bankCode),
        bankAccountNumber: recipient.bankAccountNumber,
        name: recipient.name,
      },
      autoPayoutSupported: recipient.autoPayoutSupported,
      requestedAt: at,
      paymentsConfirmedAt: at,
      identityHold,
    };

    // Ledger doc and the order flags commit together — a half-written
    // request would either double-pay or strand the funds.
    tx.set(payoutRef, batch);
    eligible.forEach((d, i) => {
      tx.update(d.ref, {
        payoutStatus: "queued",
        payoutRequestedAt: at,
        payoutId: payoutRef.id,
        // Freeze the figure this order contributed, so the amount the seller
        // was quoted is the amount that gets paid.
        sellerPayout: amounts[i],
        payoutFailureReason: null,
      });
    });
    return { payoutRef, batch };
  });

  if (!result) {
    throw createError({ statusCode: 400, message: "No funds are available for payout yet." });
  }
  const { payoutRef, batch } = result;
  const { amount, grossAmount } = batch;
  const eligible = batch.orderIds;

  return {
    payoutId: payoutRef.id,
    orders: eligible.length,
    amount,
    grossAmount,
    withdrawalFee: WITHDRAWAL_FEE,
    held: !!identityHold,
    heldMessage: identityHold && !identity.ok ? identity.message : null,
  };
});

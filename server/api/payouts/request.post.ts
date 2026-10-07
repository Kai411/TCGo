// Seller requests payout of their currently-available funds.
//
// Everything that decides how much money leaves the platform is recomputed
// here from order documents — the client sends nothing but its identity. A
// seller can call this all day and never move a figure they don't deserve.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { recordedPayout, isPayoutEligible, sumAmounts } from "~/shared/payouts";
import { WITHDRAWAL_FEE } from "~/shared/pricing";
import { toPayoutRecipient } from "~/shared/payout-details";
import { bankName } from "~/shared/banks";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const db = getAdminFirestore();

  const profileSnap = await db.collection("users").doc(caller.uid).get();
  const profile = profileSnap.data() as any;
  const recipient = toPayoutRecipient(profile);
  if (!recipient) {
    throw createError({
      statusCode: 400,
      message:
        "Add your bank account, account holder name and IC number before requesting a payout.",
    });
  }

  // Every online order this seller has money sitting against.
  const snap = await db
    .collection("compiledOrders")
    .where("sellerUid", "==", caller.uid)
    .where("paymentMethod", "==", "billplz")
    .where("status", "==", "delivered")
    .get();

  const now = Date.now();
  const eligible = snap.docs.filter((d) => isPayoutEligible(d.data() as any, now));
  if (!eligible.length) {
    throw createError({ statusCode: 400, message: "No funds are available for payout yet." });
  }

  // What the order recorded at settlement — never a fresh calculation. This
  // is the amount that leaves the bank account, so recomputing it would pay a
  // beta-era sale at launch rates the day the constant changes.
  const amounts = eligible.map((d) => recordedPayout(d.data() as any));
  const grossAmount = sumAmounts(amounts);
  if (grossAmount <= 0) {
    throw createError({ statusCode: 400, message: "No funds are available for payout yet." });
  }

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
        `Withdrawing costs RM ${WITHDRAWAL_FEE.toFixed(2)}, and you have ` +
        `RM ${grossAmount.toFixed(2)} available — so there'd be nothing left to send. ` +
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
    requestedAt: now,
  };

  // Ledger doc and the order flags go in one batch — a half-written request
  // would either double-pay or strand the funds.
  const writes = db.batch();
  writes.set(payoutRef, batch);
  eligible.forEach((d, i) => {
    writes.update(d.ref, {
      payoutStatus: "queued",
      payoutRequestedAt: now,
      payoutId: payoutRef.id,
      // Freeze the figure this order contributed, so the amount the seller
      // was quoted is the amount that gets paid.
      sellerPayout: amounts[i],
      payoutFailureReason: null,
    });
  });
  await writes.commit();

  return {
    payoutId: payoutRef.id,
    orders: eligible.length,
    amount,
    grossAmount,
    withdrawalFee: WITHDRAWAL_FEE,
  };
});

// Seller requests payout of their currently-available funds.
//
// Everything that decides how much money leaves the platform is recomputed
// here from order documents — the client sends nothing but its identity. A
// seller can call this all day and never move a figure they don't deserve.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { recordedPayout, isPayoutEligible, sumAmounts } from "~/shared/payouts";
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
  const amount = sumAmounts(amounts);
  if (amount <= 0) {
    throw createError({ statusCode: 400, message: "No funds are available for payout yet." });
  }

  const payoutRef = db.collection("payouts").doc();
  const batch: PayoutBatch = {
    id: payoutRef.id,
    sellerUid: caller.uid,
    sellerName: profile?.customName || profile?.displayName || caller.name || "Seller",
    sellerEmail: profile?.email || caller.email,
    orderIds: eligible.map((d) => d.id),
    amount,
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

  return { payoutId: payoutRef.id, orders: eligible.length, amount };
});

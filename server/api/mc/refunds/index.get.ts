// Staff: the refund queue.
//
// Refunds are requested by buyers when they cancel a paid order, and sent by
// staff as Billplz Payment Orders. IC numbers are never returned in full.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { bankName } from "~/shared/banks";
import { cancelReasonLabel, maskTail } from "~/shared/refunds";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "payouts.view");
  const db = getAdminFirestore();
  const snap = await db.collection("refunds").orderBy("createdAt", "desc").limit(200).get();

  const refunds = snap.docs.map((d) => {
    const r = d.data() as any;
    return {
      id: d.id,
      orderId: r.orderId,
      buyerUid: r.buyerUid,
      buyerName: r.buyerName ?? null,
      status: r.status,
      orderTotal: r.orderTotal,
      fee: r.fee,
      amount: r.amount,
      reason: r.reasonCode === "other" ? `Other: ${r.reasonNote ?? ""}` : cancelReasonLabel(r.reasonCode),
      holderName: r.recipient?.name ?? "",
      bank: bankName(r.recipient?.bankCode),
      account: maskTail(r.recipient?.bankAccountNumber),
      ic: maskTail(r.recipient?.identityNumber),
      autoPayoutSupported: r.autoPayoutSupported !== false,
      failureReason: r.failureReason ?? null,
      createdAt: r.createdAt,
      paidAt: r.paidAt ?? null,
    };
  });

  const totals = refunds.reduce<Record<string, number>>((t, r) => {
    t[r.status] = Math.round(((t[r.status] ?? 0) + (r.amount ?? 0)) * 100) / 100;
    return t;
  }, {});

  return { refunds, totals };
});

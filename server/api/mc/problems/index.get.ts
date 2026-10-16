// Staff: orders with a reported problem, newest first.
//
// Escalated ones are what need a decision; open ones are shown so staff can
// see a conversation going wrong before anyone asks them to step in.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { problemReasonLabel } from "~/shared/order-problems";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "reports.view");
  const db = getAdminFirestore();
  const snap = await db
    .collection("compiledOrders")
    .where("problem.status", "in", ["open", "escalated", "refund_agreed"])
    .limit(200)
    .get();

  const problems = snap.docs
    .map((d) => {
      const o = d.data() as any;
      return {
        orderId: d.id,
        status: o.problem.status,
        reason: problemReasonLabel(o.problem.reasonCode),
        openedAt: o.problem.openedAt,
        escalatedAt: o.problem.escalatedAt ?? null,
        escalatedBy: o.problem.escalatedBy ?? null,
        messages: o.problem.messages ?? [],
        buyerName: o.buyerName ?? null,
        sellerName: o.sellerName ?? null,
        orderStatus: o.status,
        total: o.total ?? 0,
        trackingNumber: o.trackingNumber ?? null,
        deliveredAt: o.deliveredAt ?? null,
      };
    })
    .sort((a, b) =>
      a.status === b.status ? b.openedAt - a.openedAt : a.status === "escalated" ? -1 : 1,
    );

  return { problems };
});

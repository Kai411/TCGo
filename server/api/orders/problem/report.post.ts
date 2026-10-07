// The buyer reports a problem with a paid order.
//
// From this moment the order's money is held (shared/payouts.ts checks
// order.problem), the seller is told, and the two of them try to sort it out
// before anyone asks TCGo to step in. See shared/order-problems.ts.
//
// The buyer's bank details are taken now rather than later, so an agreed
// refund can go out without a second round of asking. They're stored in the
// server-only orderProblems collection, never on the order.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { notifyProblem, problemPrivateRef } from "~/server/utils/order-problems";
import { canReportProblem, validateProblemReport, type OrderProblem } from "~/shared/order-problems";
import { toRefundRecipient, validateRefundRecipient, type RefundForm } from "~/shared/refunds";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as {
    orderId?: string;
    reasonCode?: string;
    details?: string;
    refund?: Partial<RefundForm>;
  };
  const orderId = String(body?.orderId || "").trim();
  if (!orderId || orderId.includes("/")) throw createError({ statusCode: 400, message: "orderId required" });

  const invalid = validateProblemReport(body);
  if (invalid) throw createError({ statusCode: 400, message: invalid });
  const refundErrors = validateRefundRecipient(body.refund);
  if (Object.keys(refundErrors).length) {
    throw createError({
      statusCode: 400,
      message: Object.values(refundErrors)[0] || "Refund details are incomplete",
      data: { fields: refundErrors },
    });
  }

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const now = Date.now();

  // A transaction so two taps can't open two problems, and a payout request
  // racing this can't slip between the check and the write.
  const order = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
    const o = snap.data() as any;
    if (o.buyerUid !== caller.uid) {
      throw createError({ statusCode: 403, message: "Only the buyer can report a problem with this order." });
    }
    const allowed = canReportProblem(o, now);
    if (!allowed.ok) throw createError({ statusCode: 409, message: allowed.reason });

    const details = String(body.details).trim();
    const problem: OrderProblem = {
      status: "open",
      reasonCode: body.reasonCode as OrderProblem["reasonCode"],
      details,
      openedAt: now,
      messages: [{ by: "buyer", text: details, at: now }],
      escalatedAt: null,
      escalatedBy: null,
      closedAt: null,
      decisionNote: null,
    };
    tx.update(orderRef, { problem, updatedAt: now });
    tx.set(problemPrivateRef(db, orderId), {
      orderId,
      buyerUid: o.buyerUid,
      sellerUid: o.sellerUid,
      recipient: toRefundRecipient({
        reasonCode: "",
        reasonNote: "",
        holderName: "",
        identityNumber: "",
        bankCode: "",
        bankAccountNumber: "",
        ...body.refund,
      } as RefundForm),
      createdAt: now,
    });
    return o;
  });

  await notifyProblem(
    db,
    order,
    orderId,
    "seller",
    "A buyer reported a problem",
    `${order.buyerName || "Your buyer"} reported a problem with their order. ` +
      `Reply on the order page to sort it out. The payment is on hold until it's settled.`,
  );

  return { ok: true };
});

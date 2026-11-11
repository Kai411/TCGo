// Staff decide an escalated problem: the held payment goes back to the buyer
// (a full refund, sent from the refund queue) or on to the seller.
//
// TCGo only decides where the money it is holding goes. Anything beyond that
// is between the buyer and the seller.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { appendMessage, notifyProblem, queueProblemRefund } from "~/server/utils/order-problems";
import { PROBLEM_MESSAGE_MAX } from "~/shared/order-problems";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "reports.resolve");
  const body = (await readBody(event)) as {
    orderId?: string;
    decision?: "refund" | "release";
    note?: string;
  };
  const orderId = String(body?.orderId || "").trim();
  if (!orderId || orderId.includes("/")) throw createError({ statusCode: 400, message: "orderId required" });
  const decision = body?.decision;
  if (decision !== "refund" && decision !== "release") {
    throw createError({ statusCode: 400, message: "decision must be refund or release" });
  }
  const note = String(body?.note ?? "").trim().slice(0, PROBLEM_MESSAGE_MAX);
  if (!note) throw createError({ statusCode: 400, message: "Explain the decision to both sides." });

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;
  if (!["open", "escalated"].includes(order.problem?.status)) {
    throw createError({ statusCode: 409, message: "This problem is already settled." });
  }

  const now = Date.now();
  const messages = appendMessage(order.problem.messages, { by: "tcgo", text: note, at: now });

  if (decision === "refund") {
    await queueProblemRefund(db, orderRef, order, {
      "problem.status": "refunded",
      "problem.closedAt": now,
      "problem.decisionNote": note,
      "problem.messages": messages,
    });
  } else {
    await orderRef.update({
      "problem.status": "released",
      "problem.closedAt": now,
      "problem.decisionNote": note,
      "problem.messages": messages,
      updatedAt: now,
    });
  }

  const title = decision === "refund" ? "TCGo decided: refund" : "TCGo decided: payment released";
  for (const to of ["buyer", "seller"] as const) {
    await notifyProblem(db, order, orderId, to, title, note.slice(0, 200));
  }

  noteAction({
    area: "order",
    action: decision === "refund" ? "problem.refunded" : "problem.released",
    actor,
    subject: orderId,
    summary:
      decision === "refund"
        ? `Refunded order ${orderId} after a reported problem.`
        : `Released payment for order ${orderId} after a reported problem.`,
    detail: { decision },
    event,
  });

  return { ok: true };
});

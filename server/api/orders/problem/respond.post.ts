// Buyer or seller acts on a reported problem: reply, agree to a refund,
// ask TCGo to step in, or (buyer) say it's sorted.
//
// Which side may do what is decided by problemActionsFor() in
// shared/order-problems.ts, so the buttons and this route agree.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { appendMessage, notifyProblem, queueProblemRefund } from "~/server/utils/order-problems";
import {
  PROBLEM_MESSAGE_MAX,
  problemActionsFor,
  type ProblemAction,
} from "~/shared/order-problems";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as {
    orderId?: string;
    action?: ProblemAction;
    message?: string;
  };
  const orderId = String(body?.orderId || "").trim();
  if (!orderId || orderId.includes("/")) throw createError({ statusCode: 400, message: "orderId required" });
  const action = body?.action;
  const message = String(body?.message ?? "").trim().slice(0, PROBLEM_MESSAGE_MAX);

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;

  const role =
    order.buyerUid === caller.uid ? "buyer" : order.sellerUid === caller.uid ? "seller" : null;
  if (!role) throw createError({ statusCode: 403, message: "Not your order" });
  if (!action || !problemActionsFor(order.problem, role).includes(action)) {
    throw createError({ statusCode: 409, message: "That isn't possible on this problem right now." });
  }
  if (action === "reply" && !message) {
    throw createError({ statusCode: 400, message: "Write a message first." });
  }

  const now = Date.now();
  const other = role === "buyer" ? "seller" : "buyer";
  const who = role === "buyer" ? order.buyerName || "The buyer" : order.sellerName || "The seller";
  const messages = message
    ? appendMessage(order.problem.messages, { by: role, text: message, at: now })
    : order.problem.messages ?? [];

  if (action === "reply") {
    await orderRef.update({ "problem.messages": messages, updatedAt: now });
    await notifyProblem(db, order, orderId, other, "New reply about a problem", `${who}: ${message.slice(0, 140)}`);
    return { ok: true };
  }

  if (action === "agree_refund") {
    // Settles it: the seller has accepted the buyer gets their money back.
    await queueProblemRefund(db, orderRef, order, {
      "problem.status": "refunded",
      "problem.messages": appendMessage(messages, {
        by: "seller",
        text: "Agreed to a full refund.",
        at: now,
      }),
      "problem.closedAt": now,
    });
    await notifyProblem(
      db,
      order,
      orderId,
      "buyer",
      "Refund agreed",
      `${who} agreed to refund your order in full. TCGo will send it to your bank.`,
    );
    return { ok: true };
  }

  if (action === "escalate") {
    await orderRef.update({
      "problem.status": "escalated",
      "problem.escalatedAt": now,
      "problem.escalatedBy": role,
      "problem.messages": messages,
      updatedAt: now,
    });
    await notifyProblem(
      db,
      order,
      orderId,
      other,
      "TCGo is reviewing a problem",
      `${who} asked TCGo to step in. We'll look at what you've both said and decide where the payment goes.`,
    );
    return { ok: true };
  }

  // resolve (buyer): the payment carries on to the seller as normal.
  await orderRef.update({
    "problem.status": "resolved",
    "problem.closedAt": now,
    "problem.messages": appendMessage(messages, { by: "buyer", text: "Marked as resolved.", at: now }),
    updatedAt: now,
  });
  await notifyProblem(db, order, orderId, "seller", "Problem resolved", `${who} marked the problem as resolved.`);
  return { ok: true };
});

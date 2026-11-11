// Server side of "Report a problem": the refund it can end in, and the
// notifications it sends. Rules for who may do what are in
// shared/order-problems.ts.

import type { Firestore, DocumentReference } from "firebase-admin/firestore";
import { bankByCode } from "~/shared/banks";
import type { ProblemMessage } from "~/shared/order-problems";
import { PROBLEM_MESSAGES_MAX, problemReasonLabel } from "~/shared/order-problems";
import { notify } from "~/server/utils/notify";

/**
 * orderProblems/{orderId}: the buyer's refund bank details for a reported
 * problem. Server-only (firestore.rules), because it holds an IC number.
 */
export const problemPrivateRef = (db: Firestore, orderId: string) =>
  db.collection("orderProblems").doc(orderId);

export const appendMessage = (
  existing: ProblemMessage[] | undefined,
  message: ProblemMessage,
): ProblemMessage[] => [...(existing ?? []), message].slice(-PROBLEM_MESSAGES_MAX);

/**
 * Queue a full refund for an order with a reported problem.
 *
 * Writes the same refunds/{orderId} record a cancellation does, so staff send
 * it from the existing refund queue. The money never becomes the seller's:
 * the payout is zeroed in the same batch. Stock is returned only when the
 * order never shipped; otherwise the card is with the buyer, or on its way.
 */
export const queueProblemRefund = async (
  db: Firestore,
  orderRef: DocumentReference,
  order: Record<string, any>,
  patch: Record<string, unknown>,
): Promise<void> => {
  const orderId = orderRef.id;
  const priv = (await problemPrivateRef(db, orderId).get()).data() as any;
  const recipient = priv?.recipient;
  if (!recipient) {
    throw createError({
      statusCode: 409,
      message: "The buyer's refund details are missing. Staff need to collect them before refunding.",
    });
  }
  const amount = Math.round((Number(order.total) || 0) * 100) / 100;
  const now = Date.now();

  const batch = db.batch();
  batch.update(orderRef, {
    ...patch,
    refundStatus: "pending",
    refundAmount: amount,
    refundFee: 0,
    refundBankName: bankByCode(recipient.bankCode)?.name ?? null,
    refundAccountLast4: String(recipient.bankAccountNumber ?? "").slice(-4),
    refundBillplzBillId: order.billplzBillId ?? null,
    payoutStatus: "cancelled",
    sellerPayout: 0,
    updatedAt: now,
  });
  batch.set(db.collection("refunds").doc(orderId), {
    orderId,
    buyerUid: order.buyerUid,
    buyerName: order.buyerName ?? null,
    buyerEmail: order.buyerEmail ?? null,
    sellerUid: order.sellerUid,
    status: "requested",
    source: "problem",
    orderTotal: amount,
    fee: 0,
    amount,
    reasonCode: "other",
    reasonNote: `Reported problem: ${problemReasonLabel(order.problem?.reasonCode)}`,
    recipient,
    autoPayoutSupported: bankByCode(recipient.bankCode)?.payoutSupported ?? false,
    billplzBillId: order.billplzBillId ?? null,
    createdAt: now,
  });
  // Never shipped: the order ends here and the cards go back on sale, the
  // same as a buyer cancellation.
  if (["paid", "confirmed"].includes(order.status) && !order.shipmentOrderNo) {
    batch.update(orderRef, { status: "cancelled", cancelledAt: now, cancelledBy: "problem" });
    for (const item of order.items ?? []) {
      if (typeof item?.cardId === "string" && item.cardId) {
        batch.update(db.collection("cards").doc(item.cardId), {
          sold: false,
          soldAt: null,
          status: "active",
        });
      }
    }
  }

  await batch.commit();
};

/** Tell the other side of the order what just happened. */
export const notifyProblem = (
  db: Firestore,
  order: Record<string, any>,
  orderId: string,
  to: "buyer" | "seller",
  title: string,
  body: string,
) =>
  notify(db, to === "buyer" ? order.buyerUid : order.sellerUid, {
    kind: "order_problem",
    audience: to,
    title,
    body,
    href: `/orders/${orderId}`,
    meta: { orderId },
  });

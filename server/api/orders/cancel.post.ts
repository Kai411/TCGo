// Cancel a paid order that hasn't been handed to the courier yet.
//
// Three things have to happen together and in this order, because each one
// makes the next safe:
//
//   1. Stop the courier. If a label was bought it must be cancelled FIRST —
//      a cancelled order with a live waybill means a parcel arrives that
//      nobody is expecting and nobody has paid for. Delyva refuses once a
//      courier is assigned, and that refusal blocks the whole cancellation
//      rather than being ignored.
//   2. Put the stock back. Cards return to the marketplace and inventory
//      returns to listed/in_stock, so the seller can sell them again.
//   3. Record the refund owed. Not perform it — see below.
//
// REFUNDS ARE NOT AUTOMATIC, AND CANNOT BE
// ────────────────────────────────────────
// Billplz has no refund API. Verified against the live API rather than
// assumed: /v3/bills/{id} returns a JSON RecordNotFound for a bad id, which
// is a route that exists; every refund path — /v3/bills/{id}/refund,
// /v3/refunds, /v4/refunds, /v5/refunds — returns Billplz's HTML 404 page,
// which is a route that does not.
//
// So the money is moved by a human from the Billplz dashboard. This route
// records what is owed and to whom; it never pretends to have sent it. An
// order that says "refunded" when nothing left the account is far worse than
// one that says "refund pending".

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { cancelShipmentForOrder } from "~/server/utils/book-shipment";
import { noteError } from "~/server/utils/oplog";
import { bankByCode } from "~/shared/banks";
import { CANCEL_GRACE_MINUTES, canBuyerCancel } from "~/shared/order-windows";
import {
  refundBreakdown,
  toRefundRecipient,
  validateRefundForm,
  type RefundForm,
} from "~/shared/refunds";

/** Cancellable while the money is in and the parcel hasn't left. */
const CANCELLABLE = ["paid", "confirmed"];

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId, refund } = (await readBody(event)) as {
    orderId?: string;
    refund?: RefundForm;
  };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;

  const isBuyer = order.buyerUid === caller.uid;
  const isSeller = order.sellerUid === caller.uid;
  if (!isBuyer && !isSeller) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  // Cancelling a paid order is the buyer's to do: the refund needs their own
  // bank details, which the seller doesn't have. A seller who can't fulfil
  // should contact support.
  if (!isBuyer) {
    throw createError({
      statusCode: 403,
      message: "Only the buyer can cancel this order. Contact support if you can't fulfil it.",
    });
  }

  if (order.status === "cancelled") {
    return { cancelled: true, alreadyCancelled: true };
  }
  if (!CANCELLABLE.includes(order.status)) {
    throw createError({
      statusCode: 409,
      message:
        order.status === "shipped" || order.status === "delivered"
          ? "This parcel is already with the courier and can't be cancelled here."
          : "This order isn't in a state that can be cancelled.",
    });
  }

  // Self-service cancellation is open for 30 minutes after payment. After
  // that the seller may book the courier, and cancelling becomes a support
  // matter — see shared/order-windows.ts.
  if (!canBuyerCancel(order)) {
    throw createError({
      statusCode: 409,
      message: `Orders can be cancelled within ${CANCEL_GRACE_MINUTES} minutes of payment. Contact support to cancel this one.`,
    });
  }

  // The refund goes to the buyer's bank as a Billplz Payment Order, so the
  // details are required and checked here — never trusted from the browser.
  const refundErrors = validateRefundForm(refund);
  if (Object.keys(refundErrors).length) {
    throw createError({
      statusCode: 400,
      message: Object.values(refundErrors)[0] || "Refund details are incomplete",
      data: { fields: refundErrors },
    });
  }

  // ── 1. Stop the courier ─────────────────────────────────────────────
  // Deliberately before anything else. If this fails the order stays exactly
  // as it was: a half-cancelled order whose parcel still ships is the one
  // outcome with no clean recovery.
  if (order.shipmentOrderNo) {
    const stopped = await cancelShipmentForOrder(db, orderId);
    if (!stopped.cancelled) {
      throw createError({
        statusCode: 409,
        message:
          "The courier has already picked this up or assigned a driver, so it can't be cancelled. " +
          (stopped.reason ?? ""),
      });
    }
  }

  const now = Date.now();
  const breakdown = refundBreakdown(order.total || 0);
  const refundAmount = breakdown.amount;
  const recipient = toRefundRecipient(refund!);

  // ── 2. Stock back, 3. refund recorded — one batch ───────────────────
  const batch = db.batch();

  batch.update(orderRef, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: "buyer",
    cancelReasonCode: refund!.reasonCode,
    cancelReason:
      refund!.reasonCode === "other" ? refund!.reasonNote.trim().slice(0, 300) : refund!.reasonCode,
    // What is owed, and the fact that nobody has sent it yet. Deliberately
    // not "refunded" — see the note at the top of this file.
    refundStatus: "pending",
    refundAmount,
    refundFee: breakdown.fee,
    // For display only; the full details live in the staff-only refunds doc.
    refundBankName: bankByCode(recipient.bankCode)?.name ?? null,
    refundAccountLast4: recipient.bankAccountNumber.slice(-4),
    // The bill to refund against, so whoever processes it in the Billplz
    // dashboard doesn't have to go looking.
    refundBillplzBillId: order.billplzBillId ?? null,
    // The money never became the seller's, so it must not sit in their funds.
    payoutStatus: "cancelled",
    sellerPayout: 0,
    updatedAt: now,
  });

  // Cards return to the marketplace. Both fields are cleared: `sold` is what
  // the legacy filters read and `status` is what shared/card-availability
  // reads, and leaving either set keeps the card invisible.
  const cardIds: string[] = (order.items ?? [])
    .map((i: any) => i?.cardId)
    .filter((id: unknown): id is string => typeof id === "string" && !!id);

  for (const cardId of cardIds) {
    batch.update(db.collection("cards").doc(cardId), {
      sold: false,
      soldAt: null,
      status: "active",
    });
  }

  // The refund request staff send. One per order (the id is the order id), in
  // a collection clients can't read — it holds the buyer's IC and account.
  batch.set(db.collection("refunds").doc(orderId), {
    orderId,
    buyerUid: order.buyerUid,
    buyerName: order.buyerName ?? null,
    buyerEmail: order.buyerEmail ?? null,
    sellerUid: order.sellerUid,
    status: "requested",
    orderTotal: breakdown.total,
    fee: breakdown.fee,
    amount: breakdown.amount,
    reasonCode: refund!.reasonCode,
    reasonNote: refund!.reasonCode === "other" ? refund!.reasonNote.trim().slice(0, 300) : "",
    recipient,
    autoPayoutSupported: bankByCode(recipient.bankCode)?.payoutSupported ?? false,
    billplzBillId: order.billplzBillId ?? null,
    createdAt: now,
  });

  await batch.commit();

  // Inventory mirrors the listings. Outside the batch because it needs a
  // query per card, and a failure here leaves the cards sellable again —
  // which is the direction that doesn't lose the seller money.
  for (const cardId of cardIds) {
    try {
      const inv = await db
        .collection("inventory")
        .where("listingId", "==", cardId)
        .get();
      await Promise.all(
        inv.docs.map((d) =>
          d.ref.update({
            status: "listed",
            soldAt: null,
            soldPrice: null,
            soldFee: null,
            saleChannel: null,
            updatedAt: now,
          }),
        ),
      );
    } catch (e: any) {
      console.error("[order cancel] inventory restore failed:", cardId, e?.message || e);
    }
  }

  noteError({
    area: "payment",
    severity: "warning",
    code: "order.refund_due",
    message: `Order ${orderId.slice(0, 8)} cancelled — RM ${refundAmount.toFixed(2)} to refund.`,
    orderId,
    userUid: caller.uid,
    context: {
      refundAmount,
      billplzBillId: order.billplzBillId ?? null,
      cancelledBy: "buyer",
      fee: breakdown.fee,
    },
    hint: "The buyer submitted their bank details. Send it from Mintcondition → Refunds.",
  });

  return { cancelled: true, refundAmount, refundStatus: "pending" };
});

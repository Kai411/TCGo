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

/** Cancellable while the money is in and the parcel hasn't left. */
const CANCELLABLE = ["paid", "confirmed"];

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId, reason } = (await readBody(event)) as {
    orderId?: string;
    reason?: string;
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
  const refundAmount = Math.round((order.total || 0) * 100) / 100;

  // ── 2. Stock back, 3. refund recorded — one batch ───────────────────
  const batch = db.batch();

  batch.update(orderRef, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: isBuyer ? "buyer" : "seller",
    cancelReason: (reason || "").slice(0, 300),
    // What is owed, and the fact that nobody has sent it yet. Deliberately
    // not "refunded" — see the note at the top of this file.
    refundStatus: "pending",
    refundAmount,
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
      cancelledBy: isBuyer ? "buyer" : "seller",
    },
    hint: "Billplz has no refund API. Refund this bill from the Billplz dashboard, then mark the order refunded.",
  });

  return { cancelled: true, refundAmount, refundStatus: "pending" };
});

// Merge several orders from one buyer into a single shipment.
//
// Server-side because everything it touches is privileged: voiding Billplz
// bills, cancelling Delyva waybills, booking the replacement label, and
// writing order documents that belong to two different people.
//
// Paid orders (the normal case — FPX settles before a seller ever sees the
// order):
//   1. cancel every waybill already booked across the group; if Delyva
//      refuses any of them (courier already assigned), abort untouched
//   2. transactionally fold the newer orders into the oldest one, SUMMING the
//      collected money — merging must never re-price an order the buyer
//      already paid
//   3. book ONE new waybill for the combined parcel, weight re-quoted
//
// Unpaid orders (duplicate-checkout cleanup): void outstanding bills first —
// a bill that can't be voided because the buyer just paid it aborts the
// merge — then fold, leaving pricing to create-bill's re-quote at pay time.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaCancelOrder } from "~/server/utils/delyva";
import { billplzDeleteBill, billplzBillState } from "~/server/utils/billplz";
import { bookShipmentForOrder, type BookResult } from "~/server/utils/book-shipment";
import { computeSellerPayout, platformFeeFor } from "~/shared/payouts";
import {
  mergeModeFor,
  sortForMerge,
  combineItems,
  unpaidFinancials,
  paidFinancials,
  UNPAID_STATUSES,
  type MergeableOrder,
} from "~/shared/merge-orders";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderIds } = (await readBody(event)) as { orderIds?: string[] };
  const ids = [...new Set(orderIds ?? [])];
  if (ids.length < 2) {
    throw createError({ statusCode: 400, message: "At least two orderIds required" });
  }

  const db = getAdminFirestore();
  const refs = ids.map((id) => db.collection("compiledOrders").doc(id));
  const snaps = await db.getAll(...refs);
  if (snaps.some((s) => !s.exists)) {
    throw createError({ statusCode: 404, message: "Order not found" });
  }
  const orders = snaps.map(
    (s) => ({ ...(s.data() as any), id: s.id }) as MergeableOrder & Record<string, any>,
  );

  // Only the seller consolidates parcels — and only their own.
  if (orders.some((o) => o.sellerUid !== caller.uid)) {
    throw createError({ statusCode: 403, message: "Not your orders" });
  }

  let mode: "paid" | "unpaid";
  try {
    mode = mergeModeFor(orders);
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e.message });
  }

  const sorted = sortForMerge(orders);
  const primary = sorted[0]!;
  const rest = sorted.slice(1);

  // ── Unpaid: void outstanding bills before touching anything ─────────
  if (mode === "unpaid") {
    for (const o of sorted) {
      if (!o.billplzBillId) continue;
      try {
        await billplzDeleteBill(o.billplzBillId);
      } catch {
        const state = await billplzBillState(o.billplzBillId).catch(() => "unknown");
        if (state === "paid") {
          throw createError({
            statusCode: 409,
            message:
              "The buyer just paid one of these orders — wait for it to settle, then merge the paid orders.",
          });
        }
        if (state === "due") {
          throw createError({
            statusCode: 409,
            message: "An outstanding payment bill couldn't be voided. Try again shortly.",
          });
        }
        // deleted / gone — it can no longer collect, safe to continue
      }
    }
  }

  // ── Paid: cancel every existing waybill, all-or-nothing ─────────────
  let waybillsCancelled = 0;
  if (mode === "paid") {
    for (const o of sorted) {
      if (!o.shipmentOrderNo) continue;
      try {
        await delyvaCancelOrder(o.shipmentOrderNo);
      } catch {
        throw createError({
          statusCode: 409,
          message: `The waybill for order ${o.id.slice(0, 8)} can no longer be cancelled — the courier may already be assigned. Ship these orders separately.`,
        });
      }
      // Recorded immediately, outside the merge transaction: if a later step
      // dies, each order is left "paid, no waybill" — recoverable through the
      // normal rebook flow instead of pointing at a cancelled shipment.
      await db.collection("compiledOrders").doc(o.id).update({
        cancelledShipmentOrderNo: o.shipmentOrderNo,
        shipmentOrderNo: null,
        shipmentClaimedAt: null,
        shipmentBookedAt: null,
        shipmentStatus: "cancelled",
        trackingNumber: null,
        awbLink: null,
        awbLinkFetchedAt: null,
      });
      waybillsCancelled++;
    }
  }

  const now = Date.now();
  const items = combineItems(sorted);
  const becomesConfirmed =
    mode === "unpaid" && sorted.some((o) => o.status === "confirmed");

  await db.runTransaction(async (tx) => {
    const fresh = await tx.getAll(...refs);
    const byId = new Map(fresh.map((s) => [s.id, s.data() as any]));
    for (const o of sorted) {
      const f = byId.get(o.id);
      const stillValid =
        f &&
        (mode === "paid"
          ? f.status === "paid" && !f.shipmentOrderNo && !f.shipmentClaimedAt
          : // A NEW bill appearing since we voided the old one means the
            // buyer is at the payment page right now — abort.
            UNPAID_STATUSES.has(f.status) &&
            (f.billplzBillId ?? null) === (o.billplzBillId ?? null));
      if (!stillValid) {
        throw createError({
          statusCode: 409,
          message: "An order changed while merging — nothing was combined. Try again.",
        });
      }
    }

    // Reads before writes: card docs, when this merge locks them as sold.
    let cardSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    if (becomesConfirmed) {
      const cardRefs = items
        .map((i) => i.cardId)
        .filter((id): id is string => typeof id === "string" && !!id)
        .map((id) => db.collection("cards").doc(id));
      cardSnaps = cardRefs.length ? await tx.getAll(...cardRefs) : [];
    }

    const primaryRef = db.collection("compiledOrders").doc(primary.id);
    if (mode === "paid") {
      const money = paidFinancials(sorted);
      tx.update(primaryRef, {
        items,
        ...money,
        mergedFrom: rest.map((o) => o.id),
        mergedAt: now,
        // The old quote described one small parcel; booking re-quotes the
        // combined weight because these are cleared.
        shippingCourier: null,
        shippingServiceId: null,
        shippingServiceCode: null,
        shippingQuotedRate: null,
        shippingWeightKg: null,
        // Provisional; refreshed after the rebooking outcome is known.
        platformFee: platformFeeFor(money),
        sellerPayout: computeSellerPayout(money),
      });
    } else {
      tx.update(primaryRef, {
        items,
        ...unpaidFinancials(primary, items),
        status: becomesConfirmed ? "confirmed" : "pending",
        ...(becomesConfirmed && primary.status !== "confirmed"
          ? { confirmedAt: now }
          : {}),
        mergedFrom: rest.map((o) => o.id),
        mergedAt: now,
        // Force a fresh quote at pay time — the frozen one described a
        // smaller parcel.
        shippingQuoted: false,
        shippingCourier: null,
        shippingServiceId: null,
        shippingServiceCode: null,
        shippingQuotedRate: null,
        shippingWeightKg: null,
        billplzBillId: null,
        billplzAmountSen: null,
      });
      // `update` on a missing doc fails the whole transaction, so only touch
      // card listings that actually exist (same guard as the webhook).
      for (const cardSnap of cardSnaps) {
        if (!cardSnap.exists) continue;
        tx.update(cardSnap.ref, { sold: true, soldAt: now, status: "sold" });
      }
    }

    for (const o of rest) {
      tx.update(db.collection("compiledOrders").doc(o.id), {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: `Merged into order ${primary.id.slice(0, 8)}`,
        mergedInto: primary.id,
      });
    }
  });

  // ── One waybill for the combined parcel ─────────────────────────────
  // Non-fatal by design: the merge itself is committed, and a booking failure
  // leaves the survivor "paid" with shipmentError set — the seller retries
  // from the order page, exactly like a failed automatic booking.
  let booking: BookResult = { booked: false, reason: "not attempted" };
  if (mode === "paid") {
    try {
      booking = await bookShipmentForOrder(db, primary.id);
    } catch (e: any) {
      booking = { booked: false, reason: e?.message || "Booking failed" };
    }
    // Refresh the provisional payout now the booking outcome is known — with
    // a platform waybill the shipping money stays with the platform.
    const freshSnap = await db.collection("compiledOrders").doc(primary.id).get();
    const freshOrder = freshSnap.data() as any;
    await freshSnap.ref.update({
      platformFee: platformFeeFor(freshOrder),
      sellerPayout: computeSellerPayout(freshOrder),
    });
  }

  return {
    mergedInto: primary.id,
    mode,
    waybillsCancelled,
    booked: booking.booked,
    bookingReason: booking.reason ?? null,
    consignmentNo: booking.consignmentNo ?? null,
  };
});

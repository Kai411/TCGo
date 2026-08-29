// Courier tracking for an order — buyer or seller.
//
// The buyer is the main audience here: this is what powers the timeline on
// the order page. Both parties to the order can read it; nobody else can,
// since the response includes origin and destination localities.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaTrack, delyvaStage } from "~/server/utils/delyva";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const db = getAdminFirestore();
  const snap = await db.collection("compiledOrders").doc(orderId).get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;

  if (order.buyerUid !== caller.uid && order.sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  if (!order.trackingNumber) {
    return { available: false, reason: "No tracking number yet" };
  }

  try {
    const tracking = await delyvaTrack(order.trackingNumber);

    // Advance the order from what the courier actually reports.
    //
    // This endpoint used to be read-only, which meant nothing ever moved an
    // order to shipped or delivered except a human pressing a button. A parcel
    // Delyva had already delivered would sit on "shipped" indefinitely — and
    // since payout eligibility keys off deliveredAt, the seller's money stayed
    // locked behind that button.
    //
    // Forward-only: a courier re-reporting an earlier scan must never drag a
    // delivered order backwards, and a cancelled shipment is recorded but the
    // order is left alone — cancelling a paid order is a refund decision, not
    // a tracking one.
    const stage = delyvaStage(tracking.statusCode);
    const RANK: Record<string, number> = { paid: 0, confirmed: 0, shipped: 1, delivered: 2 };
    const currentRank = RANK[order.status] ?? -1;
    const nextRank = stage === "delivered" ? 2 : stage === "shipped" ? 1 : -1;

    if (nextRank > currentRank) {
      const now = Date.now();
      const patch: Record<string, unknown> = {
        status: stage,
        shipmentStatus: tracking.statusText ?? null,
      };
      if (stage === "shipped") patch.shippedAt = order.shippedAt ?? now;
      if (stage === "delivered") {
        patch.shippedAt = order.shippedAt ?? now;
        patch.deliveredAt = order.deliveredAt ?? now;
      }
      await snap.ref.update(patch);
    } else if (tracking.statusText && tracking.statusText !== order.shipmentStatus) {
      // Keep the human-readable courier status fresh even mid-stage.
      await snap.ref.update({ shipmentStatus: tracking.statusText });
    }

    return { available: true, tracking, stage };
  } catch (e: any) {
    // A courier that hasn't scanned the parcel yet is normal, not an error.
    return { available: false, reason: e?.message || "Tracking not available yet" };
  }
});

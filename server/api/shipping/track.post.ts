// Courier tracking for an order — buyer or seller.
//
// The buyer is the main audience here: this is what powers the timeline on
// the order page. Both parties to the order can read it; nobody else can,
// since the response includes origin and destination localities.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaTrack } from "~/server/utils/delyva";

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
    return { available: true, tracking };
  } catch (e: any) {
    // A courier that hasn't scanned the parcel yet is normal, not an error.
    return { available: false, reason: e?.message || "Tracking not available yet" };
  }
});

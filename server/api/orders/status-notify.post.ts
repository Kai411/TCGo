// Announce an order's latest status after the browser changed it.
//
// The buyer's "I received it" and the seller's manual "Mark shipped" are
// written straight to Firestore from the browser, so this is called right
// after. It reads the order fresh and announces what it actually says, so the
// caller can't make up a status, and announceOrderStatus() makes repeat calls
// harmless.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { announceOrderStatus } from "~/server/utils/order-status-notify";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const db = getAdminFirestore();
  const snap = await db.collection("compiledOrders").doc(String(orderId)).get();
  const order = snap.data() as any;
  if (!order) throw createError({ statusCode: 404, message: "Order not found" });
  if (order.buyerUid !== caller.uid && order.sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  const announced = await announceOrderStatus(db, snap.id, order);
  return { ok: true, announced };
});

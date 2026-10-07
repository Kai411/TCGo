// Seller-triggered courier booking.
//
// Normally the webhook books automatically the moment payment settles; this
// exists for the cases where that couldn't run — the seller's pickup address
// was incomplete at the time, or the courier call failed and they want to
// retry. The shared implementation is idempotent, so calling it after an
// automatic booking is a no-op rather than a second charge.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { bookShipmentForOrder } from "~/server/utils/book-shipment";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const db = getAdminFirestore();
  const snap = await db.collection("compiledOrders").doc(orderId).get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  if ((snap.data() as any).sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }

  const result = await bookShipmentForOrder(db, orderId);
  if (!result.booked) throw createError({ statusCode: 400, message: result.reason });
  return result;
});

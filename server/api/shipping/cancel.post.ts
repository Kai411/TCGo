// Cancel a booked shipment.
//
// Delyva's cancellation policy: only while the order's status code is between
// 0 and 110. Once a courier is assigned (status 200) it cannot be cancelled.
// Delyva does not document whether cancelling credits the wallet back, so this
// is "stop the collection", not a guaranteed refund.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { cancelShipmentForOrder } from "~/server/utils/book-shipment";

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

  const result = await cancelShipmentForOrder(db, orderId);
  if (!result.cancelled) throw createError({ statusCode: 400, message: result.reason });
  return result;
});

// Fetch the consignment note / AWB for a booked shipment.
//
// Fetched on demand rather than trusting the copy stored at booking time —
// hosted label links expire, and the label often isn't ready in the same
// instant the order is confirmed.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaLabel } from "~/server/utils/delyva";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;

  if (order.sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  if (!order.shipmentOrderNo) {
    throw createError({
      statusCode: 400,
      message: "No shipment has been booked for this order",
    });
  }

  const awbLink = await delyvaLabel(order.shipmentOrderNo);
  if (!awbLink) {
    throw createError({
      statusCode: 502,
      message: "The label isn't ready yet — try again in a moment.",
    });
  }

  await orderRef.update({ awbLink, awbLinkFetchedAt: Date.now() });
  return { awbLink };
});

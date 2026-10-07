// Stream the consignment note / AWB for a booked shipment.
//
// Delyva's label endpoint returns the PDF *document*, not a link to one, so
// this proxies the bytes rather than handing the client a URL. It also stays
// authenticated: the label carries both parties' addresses.
//
// Fetched on demand rather than cached — Delyva queues orders, so the label
// often isn't ready in the same second the booking is confirmed.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaLabelPdf, delyvaConsignmentNo } from "~/server/utils/delyva";

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

  const { body, contentType } = await delyvaLabelPdf(order.shipmentOrderNo);

  // If tracking wasn't ready when the booking was made, it will be by now.
  if (!order.trackingNumber) {
    try {
      const consignmentNo = await delyvaConsignmentNo(order.shipmentOrderNo);
      if (consignmentNo) await orderRef.update({ trackingNumber: consignmentNo });
    } catch {
      /* non-fatal — the label is what was asked for */
    }
  }

  setHeader(event, "Content-Type", contentType);
  setHeader(event, "Content-Disposition", `inline; filename="waybill-${orderId.slice(0, 8)}.pdf"`);
  setHeader(event, "Cache-Control", "no-store");
  return body;
});

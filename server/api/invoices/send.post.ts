// Send (or resend) an order's invoice to the buyer.
//
// Either party may trigger it — a buyer who lost the email, or a seller
// helping them out.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { sendInvoiceForOrder } from "~/server/utils/send-invoice";

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

  const result = await sendInvoiceForOrder(db, orderId);
  if (!result.sent) throw createError({ statusCode: 400, message: result.reason });
  return result;
});

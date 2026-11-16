// Prices an order for its delivery address before the buyer pays, so the
// confirm step can show the real shipping and total. create-bill runs the
// same pricing, so the bank asks for exactly this amount.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { priceOrderForPayment } from "~/server/utils/order-pricing";

// Mirrors PAYABLE_STATUSES in /api/billplz/create-bill.
const PAYABLE_STATUSES = ["pending", "confirmed"];

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;
  if (order.buyerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  if (!PAYABLE_STATUSES.includes(order.status)) {
    throw createError({ statusCode: 400, message: "Order is not awaiting payment" });
  }
  if (!order.deliveryAddress?.postcode) {
    throw createError({ statusCode: 400, message: "Delivery address required" });
  }

  return await priceOrderForPayment(db, orderRef, order);
});

// Create a Billplz bill for a pending compiled order. The amount is computed
// server-side from the order document — the client only supplies the id.
//
// Flow: buyer taps "Pay online (FPX)" → this creates the bill, links it to
// the order, and returns the hosted payment URL. The webhook flips the order
// to paid; the redirect just lands the buyer back on the order page (which
// listens live).

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { billplzBaseUrl, billplzAuthHeader } from "~/server/utils/billplz";

export default defineEventHandler(async (event) => {
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const config = useRuntimeConfig();
  const collectionId = config.billplzCollectionId as string;
  if (!collectionId) {
    throw createError({ statusCode: 500, message: "Billplz collection not configured" });
  }

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;
  if (order.status !== "pending") {
    throw createError({ statusCode: 400, message: "Order is not awaiting payment" });
  }
  if (!order.deliveryAddress?.postcode) {
    throw createError({ statusCode: 400, message: "Delivery address required before payment" });
  }

  const requestUrl = getRequestURL(event);
  const siteUrl = (config.public.siteUrl as string) || requestUrl.origin;
  const amount = Math.round((order.total || 0) * 100); // MYR sen

  const form = new URLSearchParams({
    collection_id: collectionId,
    email: order.buyerEmail || "buyer@tcgo.shop",
    name: order.buyerName || "TCGo Buyer",
    amount: String(amount),
    callback_url: `${siteUrl}/api/billplz/webhook`,
    redirect_url: `${siteUrl}/orders/${orderId}`,
    description: `TCGo order #${orderId.slice(0, 8)} (${order.items?.length ?? 0} items)`,
    reference_1_label: "orderId",
    reference_1: orderId,
  });

  const res = await fetch(`${billplzBaseUrl()}/v3/bills`, {
    method: "POST",
    headers: {
      Authorization: billplzAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[billplz] bill creation failed:", res.status, text);
    throw createError({ statusCode: 502, message: "Payment provider error" });
  }
  const bill = (await res.json()) as { id: string; url: string };

  await orderRef.update({
    billplzBillId: bill.id,
    paymentMethod: "billplz",
  });

  return { url: bill.url };
});

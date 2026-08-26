// Create a Billplz bill for a pending compiled order. The amount is computed
// server-side from the order document — the client only supplies the id.
//
// Flow: buyer taps "Pay online (FPX)" → this creates the bill, links it to
// the order, and returns the hosted payment URL. The webhook flips the order
// to paid; the redirect just lands the buyer back on the order page (which
// listens live).

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import {
  billplzBaseUrl,
  billplzAuthHeader,
  billplzDeleteBill,
} from "~/server/utils/billplz";
import { requireUser } from "~/server/utils/auth";
import { regionForState, totalForRegion } from "~/shared/shipping";
import { quoteOrderShipping } from "~/server/utils/shipping";

// An order is payable while the seller hasn't shipped it. `pending` and
// `confirmed` both mean "money not collected yet" — the seller confirming a
// manual order must not strand a buyer who chose to pay online.
const PAYABLE_STATUSES = ["pending", "confirmed"];

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
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
  // Only the buyer pays, and only for their own order.
  if (order.buyerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  if (!PAYABLE_STATUSES.includes(order.status)) {
    throw createError({ statusCode: 400, message: "Order is not awaiting payment" });
  }
  if (!order.deliveryAddress?.postcode) {
    throw createError({ statusCode: 400, message: "Delivery address required before payment" });
  }

  const requestUrl = getRequestURL(event);
  const siteUrl = (config.public.siteUrl as string) || requestUrl.origin;

  // Region always comes from the delivery address, never from what the buyer
  // picked earlier — you can't ship to Sabah at West Malaysia rates.
  const region = regionForState(order.deliveryAddress.state);

  // Orders placed through the cart already carry a live courier quote, frozen
  // at the price the buyer was shown. Anything else — auction wins, legacy
  // orders priced off seller-set figures — gets quoted now, against the
  // address they just entered.
  let shipping: number;
  let total: number;
  const patch: Record<string, unknown> = {};

  if (order.shippingQuoted) {
    ({ shipping, total } = totalForRegion(order, region));
  } else {
    const quote = await quoteOrderShipping(db, { ...order, sellerUid: order.sellerUid });
    if (!quote) {
      throw createError({
        statusCode: 400,
        message:
          "We couldn't get a shipping rate for this order. The seller may not have set a pickup address yet.",
      });
    }
    shipping = quote.shipping;
    total = Math.round(((order.subtotal || 0) + shipping) * 100) / 100;
    Object.assign(patch, {
      shippingQuoted: true,
      shippingWM: shipping,
      shippingEM: shipping,
      shippingCourier: quote.courier,
      shippingQuotedRate: quote.quotedRate,
      shippingServiceId: quote.serviceId,
      shippingServiceCode: quote.serviceCode,
      shippingWeightKg: quote.weightKg,
    });
  }

  if (
    Object.keys(patch).length ||
    region !== order.region ||
    shipping !== order.shipping ||
    total !== order.total
  ) {
    await orderRef.update({ ...patch, region, shipping, total });
    order.region = region;
    order.shipping = shipping;
    order.total = total;
  }
  const amount = Math.round(total * 100); // MYR sen

  // A re-created bill supersedes the previous one. Void the old bill so a
  // stale payment tab can't collect an out-of-date amount for this order —
  // Billplz refuses to delete a paid bill, and anything else that slips
  // through is caught by the webhook's amount check.
  if (order.billplzBillId) {
    await billplzDeleteBill(order.billplzBillId).catch(() => {});
  }

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
    // Recorded in sen so the webhook can verify Billplz reports the same
    // amount it collected — without this, a bill created against a since-
    // changed order would settle at the wrong price.
    billplzAmountSen: amount,
    paymentMethod: "billplz",
  });

  return { url: bill.url };
});

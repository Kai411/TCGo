// Rate check for an order's shipment: seller pickup → buyer delivery.
// Returns a simplified list of courier services with prices, used by the
// seller's "Create shipment" dialog to pick a courier.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { easyparcelApiKey, easyparcelPost } from "~/server/utils/easyparcel";

export default defineEventHandler(async (event) => {
  const { orderId, weight } = (await readBody(event)) as {
    orderId?: string;
    weight?: number;
  };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });
  const kg = Math.max(0.01, Number(weight) || 0.2);

  const db = getAdminFirestore();
  const snap = await db.collection("compiledOrders").doc(orderId).get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;
  const addr = order.deliveryAddress;
  if (!addr?.postcode) {
    throw createError({ statusCode: 400, message: "Order has no delivery address" });
  }

  const sellerSnap = await db.collection("users").doc(order.sellerUid).get();
  const seller = sellerSnap.data() as any;
  if (!seller?.pickupPostcode || !seller?.pickupState) {
    throw createError({ statusCode: 400, message: "Seller pickup address incomplete — complete seller verification" });
  }

  const data = await easyparcelPost("EPRateCheckingBulk", {
    api: easyparcelApiKey(),
    "bulk[0][pick_code]": seller.pickupPostcode,
    "bulk[0][pick_state]": seller.pickupState,
    "bulk[0][pick_country]": "MY",
    "bulk[0][send_code]": addr.postcode,
    "bulk[0][send_state]": addr.state,
    "bulk[0][send_country]": "MY",
    "bulk[0][weight]": String(kg),
  });

  const result = data?.result?.[0];
  const rates = (result?.rates ?? []).map((r: any) => ({
    serviceId: r.service_id,
    courier: r.courier_name,
    serviceName: r.service_name,
    price: Number(r.price ?? r.shipment_price ?? 0),
    etd: r.delivery ?? "",
  }));
  rates.sort((a: any, b: any) => a.price - b.price);

  if (!rates.length) {
    const reason = result?.status || data?.error_remark || "No couriers available for this route";
    return { rates: [], error: String(reason) };
  }
  return { rates };
});

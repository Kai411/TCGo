// Rate check for an order's shipment: seller pickup → buyer delivery, via
// the Developer Hub quotations endpoint. Returns a simplified list of
// courier services used by the seller's "Create shipment" dialog.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { epPost, toSubdivision } from "~/server/utils/easyparcel";

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

  const data = await epPost("shipment/quotations", {
    shipment: [
      {
        sender: {
          postcode: seller.pickupPostcode,
          // NOTE: the quotations endpoint spells this key "subdivison_code"
          // (sic) in EasyParcel's own collection; submit_orders spells it
          // "subdivision_code". Keep each endpoint's exact key.
          subdivison_code: toSubdivision(seller.pickupState),
          country: "MY",
        },
        receiver: {
          postcode: addr.postcode,
          subdivison_code: toSubdivision(addr.state),
          country: "MY",
        },
        parcel_value: order.subtotal || 1,
        weight: kg,
        width: 25,
        length: 18,
        height: 3,
      },
    ],
  });

  const entry = data?.data?.[0];
  const rates = (entry?.quotations ?? []).map((q: any) => ({
    serviceId: q?.courier?.service_id ?? "",
    courier: q?.courier?.courier_name ?? "",
    serviceName: q?.courier?.service_name ?? "",
    price: Number(q?.pricing?.total_amount ?? 0),
    etd: q?.courier?.delivery_duration ?? "",
  })).filter((r: any) => r.serviceId);
  rates.sort((a: any, b: any) => a.price - b.price);

  if (!rates.length) {
    const reason = entry?.message || entry?.status || data?.message || "No couriers available for this route";
    return { rates: [], error: String(reason) };
  }
  return { rates };
});

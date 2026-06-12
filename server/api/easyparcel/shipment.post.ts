// Book a shipment for a paid/confirmed order via the Developer Hub
// submit_orders endpoint. Submitting auto-pays from the EasyParcel wallet
// and returns the AWB + label PDF in the same response. The tracking number
// and label link are written to the order, which flips to shipped.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { epPost, toSubdivision, epPhone } from "~/server/utils/easyparcel";

export default defineEventHandler(async (event) => {
  const { orderId, serviceId, weight } = (await readBody(event)) as {
    orderId?: string;
    serviceId?: string;
    weight?: number;
  };
  if (!orderId || !serviceId) {
    throw createError({ statusCode: 400, message: "orderId and serviceId required" });
  }
  const kg = Math.max(0.01, Number(weight) || 0.2);

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;
  if (order.status !== "paid" && order.status !== "confirmed") {
    throw createError({ statusCode: 400, message: "Order must be paid/confirmed before shipping" });
  }
  const addr = order.deliveryAddress;
  if (!addr?.postcode) throw createError({ statusCode: 400, message: "Order has no delivery address" });

  const sellerSnap = await db.collection("users").doc(order.sellerUid).get();
  const seller = sellerSnap.data() as any;
  if (!seller?.pickupAddress1 || !seller?.pickupPostcode) {
    throw createError({ statusCode: 400, message: "Seller pickup address incomplete" });
  }

  // Collection tomorrow (couriers won't collect same-day after cutoff).
  const collectDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const data = await epPost("shipment/submit_orders", {
    shipment: [
      {
        service_id: serviceId,
        collection_date: collectDate,
        weight: kg,
        length: 25,
        width: 18,
        height: 3,
        item: [
          {
            content: "Trading cards",
            weight: kg,
            currency_code: "MYR",
            value: order.subtotal || 1,
            quantity: 1,
          },
        ],
        sender: {
          name: seller.customName || seller.displayName || "TCGo Seller",
          phone_number_country_code: "MY",
          phone_number: epPhone(seller.whatsappNumber || seller.phone),
          email: "support@tcgo.shop",
          address_1: seller.pickupAddress1,
          address_2: seller.pickupAddress2 || "",
          city: seller.pickupCity || "",
          subdivision_code: toSubdivision(seller.pickupState),
          postcode: seller.pickupPostcode,
          country_code: "MY",
        },
        receiver: {
          name: addr.name,
          phone_number_country_code: "MY",
          phone_number: epPhone(addr.phone),
          email: order.buyerEmail || "buyer@tcgo.shop",
          address_1: addr.address1,
          address_2: addr.address2 || "",
          city: addr.city,
          subdivision_code: toSubdivision(addr.state),
          postcode: addr.postcode,
          country_code: "MY",
        },
      },
    ],
  });

  const entry = data?.data?.[0];
  const shipment = entry?.shipments?.[0];
  const awb = shipment?.awb_number ?? "";
  const awbLink = shipment?.awb_url ?? "";
  const courier = shipment?.courier ?? "";
  const orderNo = entry?.order_details?.order_number ?? "";
  if (!awb) {
    const reason =
      shipment?.message || shipment?.status || entry?.message || data?.message ||
      "booking failed (check EasyParcel wallet credit)";
    throw createError({ statusCode: 502, message: `EasyParcel: ${reason}` });
  }

  await orderRef.update({
    status: "shipped",
    shippedAt: Date.now(),
    trackingNumber: awb,
    shippingCarrier: courier || "EasyParcel",
    easyparcelOrderNo: String(orderNo),
    awbLink,
  });

  return { awb, awbLink, courier, orderNo };
});

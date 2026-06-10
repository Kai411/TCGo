// Create + pay an EasyParcel shipment for a paid order, producing a waybill
// (AWB). Writes the tracking number / AWB link back to the order and flips
// it to shipped.
//
// Cost note: paying the shipment draws from the platform's EasyParcel credit
// balance — top up the EasyParcel account before going live.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { easyparcelApiKey, easyparcelPost } from "~/server/utils/easyparcel";

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
  const collect = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const collectDate = collect.toISOString().slice(0, 10);
  const sellerPhone = (seller.whatsappNumber || seller.phone || "").replace(/[^0-9+]/g, "");

  // 1. Submit the order.
  const submit = await easyparcelPost("EPSubmitOrderBulk", {
    api: easyparcelApiKey(),
    "bulk[0][content]": "Trading cards",
    "bulk[0][value]": String(order.subtotal || 1),
    "bulk[0][weight]": String(kg),
    "bulk[0][service_id]": serviceId,
    "bulk[0][collect_date]": collectDate,
    "bulk[0][sms]": "false",
    "bulk[0][pick_name]": seller.customName || seller.displayName || "TCGo Seller",
    "bulk[0][pick_contact]": sellerPhone,
    "bulk[0][pick_addr1]": seller.pickupAddress1,
    "bulk[0][pick_addr2]": seller.pickupAddress2 || "",
    "bulk[0][pick_code]": seller.pickupPostcode,
    "bulk[0][pick_city]": seller.pickupCity || "",
    "bulk[0][pick_state]": seller.pickupState,
    "bulk[0][pick_country]": "MY",
    "bulk[0][send_name]": addr.name,
    "bulk[0][send_contact]": (addr.phone || "").replace(/[^0-9+]/g, ""),
    "bulk[0][send_addr1]": addr.address1,
    "bulk[0][send_addr2]": addr.address2 || "",
    "bulk[0][send_code]": addr.postcode,
    "bulk[0][send_city]": addr.city,
    "bulk[0][send_state]": addr.state,
    "bulk[0][send_country]": "MY",
  });

  const submitted = submit?.result?.[0];
  const orderNo = submitted?.order_number ?? submitted?.order_no;
  if (!orderNo) {
    const reason = submitted?.remarks || submitted?.status || submit?.error_remark || "submission rejected";
    throw createError({ statusCode: 502, message: `EasyParcel: ${reason}` });
  }

  // 2. Pay it (draws from the platform's EasyParcel credit) → AWB.
  const pay = await easyparcelPost("EPPayOrderBulk", {
    api: easyparcelApiKey(),
    "bulk[0][order_no]": String(orderNo),
  });
  const paid = pay?.result?.[0];
  const parcel = paid?.parcel?.[0] ?? paid?.parcels?.[0] ?? null;
  const awb = parcel?.awb ?? "";
  const awbLink = parcel?.awb_id_link ?? "";
  const courier = parcel?.courier ?? submitted?.courier ?? "";
  if (!awb) {
    const reason = paid?.messagenow || paid?.remarks || pay?.error_remark || "payment failed (check EasyParcel credit)";
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

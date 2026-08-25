// Book the courier for a paid order and get a waybill.
//
// Simpler than the old EasyParcel equivalent because the service is already
// decided: the buyer paid for a specific `shippingServiceCode` quoted at
// checkout, so booking just uses it. No rate picker, no cost cap — same
// provider, same service, same price the buyer was charged.
//
// This spends real money from the Delyva wallet, so:
//   1. only the order's seller can call it,
//   2. only a genuinely paid order can ship,
//   3. a transactional claim makes double-clicks and retries idempotent.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaCreateOrder, delyvaLabel } from "~/server/utils/delyva";
import { quoteOrderShipping } from "~/server/utils/shipping";
import { stateName } from "~/shared/my-states";
import { PARCEL_DIMS, parcelWeightKg } from "~/shared/parcel";

// Couriers don't collect on Sundays; schedule the next working day.
const nextCollection = (from = new Date()): string => {
  const d = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  // Delyva wants ISO8601 with an explicit offset; MY is always +0800.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00+0800`;
};

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
  if (order.status !== "paid") {
    throw createError({
      statusCode: 400,
      message: "Order must be paid before a shipping label can be created",
    });
  }
  const addr = order.deliveryAddress;
  if (!addr?.postcode) {
    throw createError({ statusCode: 400, message: "Order has no delivery address" });
  }
  if (order.shipmentOrderNo) {
    throw createError({ statusCode: 409, message: "A shipment already exists for this order" });
  }

  const sellerSnap = await db.collection("users").doc(order.sellerUid).get();
  const seller = sellerSnap.data() as any;
  if (!seller?.pickupAddress1 || !seller?.pickupPostcode) {
    throw createError({ statusCode: 400, message: "Your pickup address is incomplete" });
  }

  // The service the buyer paid for. Legacy orders predate quoting, so re-quote
  // to pick one rather than refusing to ship them.
  let serviceCode: string = order.shippingServiceCode || "";
  if (!serviceCode) {
    const quote = await quoteOrderShipping(db, { ...order, sellerUid: order.sellerUid });
    if (!quote) {
      throw createError({ statusCode: 400, message: "No courier is available for this route." });
    }
    serviceCode = quote.serviceCode;
  }

  // Claim before calling Delyva — `process: true` books and charges, so a
  // double-click that got through would buy two labels.
  const claimed = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(orderRef);
    const data = fresh.data() as any;
    if (data.shipmentOrderNo || data.shipmentClaimedAt) return false;
    tx.update(orderRef, { shipmentClaimedAt: Date.now() });
    return true;
  });
  if (!claimed) {
    throw createError({
      statusCode: 409,
      message: "A shipment is already being created for this order",
    });
  }

  try {
    const weightKg = order.shippingWeightKg ?? parcelWeightKg(order);
    const inventory = [
      {
        name: "Trading cards",
        type: "PARCEL" as const,
        price: { amount: String(order.subtotal ?? 1), currency: "MYR" as const },
        weight: { value: weightKg, unit: "kg" as const },
        dimension: { ...PARCEL_DIMS, unit: "cm" as const },
        quantity: 1,
        description: `TCGo order ${orderId.slice(0, 8)}`,
      },
    ];

    const result = await delyvaCreateOrder({
      serviceCode,
      scheduledAt: nextCollection(),
      inventory,
      origin: {
        name: seller.customName || seller.displayName || "TCGo Seller",
        email: seller.email || "support@tcgo.shop",
        phone: String(seller.whatsappNumber || seller.phone || ""),
        address1: seller.pickupAddress1,
        address2: seller.pickupAddress2 || "",
        city: seller.pickupCity || "",
        state: stateName(seller.pickupState),
        postcode: String(seller.pickupPostcode),
        country: "MY",
      },
      destination: {
        name: addr.name,
        email: order.buyerEmail || "buyer@tcgo.shop",
        phone: String(addr.phone || ""),
        address1: addr.address1,
        address2: addr.address2 || "",
        city: addr.city,
        state: stateName(addr.state),
        postcode: String(addr.postcode),
        country: "MY",
      },
    });

    // Label may not be ready the instant the order is confirmed; a missing one
    // isn't fatal since /api/shipping/label re-fetches on demand.
    let awbLink = "";
    try {
      awbLink = await delyvaLabel(result.orderId);
    } catch (e) {
      console.warn("[delyva] label not ready yet for", result.orderId);
    }

    await orderRef.update({
      status: "shipped",
      shippedAt: Date.now(),
      shipmentOrderNo: result.orderId,
      shipmentStatus: result.status || null,
      shippingCarrier: order.shippingCourier || "Delyva",
      ...(awbLink ? { awbLink, awbLinkFetchedAt: Date.now() } : {}),
    });

    return { orderId: result.orderId, status: result.status, awbLink };
  } catch (e) {
    // Nothing was booked — release the claim so the seller can retry.
    await orderRef.update({ shipmentClaimedAt: null });
    throw e;
  }
});

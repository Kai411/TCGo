// Booking a courier for a paid order.
//
// Shared by two callers so there is exactly one implementation of the money-
// spending path:
//   - the Billplz webhook, automatically once payment settles
//   - /api/shipping/book, when a seller retries a booking that failed
//
// Charges the Delyva wallet, so it is idempotent by construction: a
// transactional claim on `shipmentClaimedAt` means concurrent callers (webhook
// and seller clicking at the same moment) can't buy two labels.

import type { Firestore } from "firebase-admin/firestore";
import { delyvaCreateOrder, delyvaLabel, delyvaCancelOrder } from "~/server/utils/delyva";
import { quoteOrderShipping } from "~/server/utils/shipping";
import { stateName } from "~/shared/my-states";
import { PARCEL_DIMS, parcelWeightKg } from "~/shared/parcel";

// Couriers don't collect on Sundays; schedule the next working day. Delyva
// wants ISO8601 with an explicit offset, and MY is always +0800.
export const nextCollection = (from = new Date()): string => {
  const d = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00+0800`;
};

export interface BookResult {
  booked: boolean;
  reason?: string;
  shipmentOrderNo?: string;
  awbLink?: string;
  status?: string;
}

export const bookShipmentForOrder = async (
  db: Firestore,
  orderId: string,
): Promise<BookResult> => {
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return { booked: false, reason: "Order not found" };
  const order = snap.data() as any;

  if (order.status !== "paid") {
    return { booked: false, reason: `Order is ${order.status}, not paid` };
  }
  const addr = order.deliveryAddress;
  if (!addr?.postcode) return { booked: false, reason: "Order has no delivery address" };
  if (order.shipmentOrderNo) {
    return { booked: false, reason: "A shipment already exists for this order" };
  }

  const sellerSnap = await db.collection("users").doc(order.sellerUid).get();
  const seller = sellerSnap.data() as any;
  if (!seller?.pickupAddress1 || !seller?.pickupPostcode) {
    return { booked: false, reason: "Seller pickup address is incomplete" };
  }

  // The service the buyer paid for. Orders placed before the cart recorded a
  // service code — and legacy ones — get re-quoted rather than refused.
  let serviceCode: string = order.shippingServiceCode || "";
  if (!serviceCode) {
    const quote = await quoteOrderShipping(db, { ...order, sellerUid: order.sellerUid });
    if (!quote) return { booked: false, reason: "No courier available for this route" };
    serviceCode = quote.serviceCode;
  }

  // Claim before spending. `process: true` books and charges, so a race
  // between the webhook and a seller click must not buy two labels.
  const claimed = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(orderRef);
    const d = fresh.data() as any;
    if (d.shipmentOrderNo || d.shipmentClaimedAt) return false;
    tx.update(orderRef, { shipmentClaimedAt: Date.now() });
    return true;
  });
  if (!claimed) return { booked: false, reason: "A shipment is already being created" };

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

    // Delyva queues orders — the consignment number and label usually appear
    // within seconds, not instantly. A missing label is not a failure; the
    // order page re-fetches it on demand.
    let awbLink = "";
    try {
      awbLink = await delyvaLabel(result.orderId);
    } catch {
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

    return { booked: true, shipmentOrderNo: result.orderId, awbLink, status: result.status };
  } catch (e: any) {
    // Nothing was booked — release the claim so it can be retried.
    await orderRef.update({
      shipmentClaimedAt: null,
      shipmentError: e?.message || "Booking failed",
    });
    throw e;
  }
};

// Cancel a booked shipment. Delyva only allows this while the order's status
// code is between 0 and 110 — once a courier is assigned (200) it's refused.
// Whether the wallet is credited back is not documented by Delyva; treat a
// successful cancel as "no longer collecting", not as a guaranteed refund.
export const cancelShipmentForOrder = async (
  db: Firestore,
  orderId: string,
): Promise<{ cancelled: boolean; reason?: string }> => {
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return { cancelled: false, reason: "Order not found" };
  const order = snap.data() as any;
  if (!order.shipmentOrderNo) {
    return { cancelled: false, reason: "No shipment booked for this order" };
  }

  await delyvaCancelOrder(order.shipmentOrderNo);

  // Back to paid so the seller can rebook or ship themselves. The shipment
  // reference is kept for the audit trail rather than deleted.
  await orderRef.update({
    status: "paid",
    shippedAt: null,
    cancelledShipmentOrderNo: order.shipmentOrderNo,
    shipmentOrderNo: null,
    shipmentClaimedAt: null,
    shipmentStatus: "cancelled",
    awbLink: null,
    trackingNumber: null,
  });
  return { cancelled: true };
};

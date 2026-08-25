// Server-side shipping quote for an order.
//
// The cart quotes before checkout and freezes the result onto the order
// (`shippingQuoted: true`). Orders that never went through the cart — auction
// wins, and any legacy order created back when sellers priced their own
// shipping — reach payment with no live quote, so create-bill fills one in
// here using the delivery address the buyer just entered.

import type { Firestore } from "firebase-admin/firestore";
import { delyvaQuote } from "~/server/utils/delyva";
import { parcelWeightKg } from "~/shared/parcel";
import { stateName } from "~/shared/my-states";
import { quoteForOrder, type HandoverPreference } from "~/shared/shipping-quote";

export interface QuotedShipping {
  shipping: number;
  quotedRate: number;
  courier: string;
  serviceId: string;
  serviceCode: string;
  weightKg: number;
}

export const quoteOrderShipping = async (
  db: Firestore,
  order: {
    sellerUid: string;
    items?: unknown[];
    deliveryAddress?: {
      address1?: string;
      city?: string;
      state?: string;
      postcode?: string;
    };
  },
): Promise<QuotedShipping | null> => {
  const addr = order.deliveryAddress;
  if (!addr?.postcode || !addr?.state) return null;

  const sellerSnap = await db.collection("users").doc(order.sellerUid).get();
  const seller = sellerSnap.data() as any;
  if (!seller?.pickupPostcode || !seller?.pickupState) return null;

  const weightKg = parcelWeightKg({ items: order.items ?? [] });
  const rates = await delyvaQuote({
    origin: {
      address1: seller.pickupAddress1 || "",
      city: seller.pickupCity || "",
      state: stateName(seller.pickupState),
      postcode: String(seller.pickupPostcode),
      country: "MY",
    },
    destination: {
      address1: addr.address1 || "",
      city: addr.city || "",
      state: stateName(addr.state),
      postcode: String(addr.postcode),
      country: "MY",
    },
    weightKg,
  });

  const preference: HandoverPreference =
    seller.handoverPreference === "pickup" ? "pickup" : "dropoff";
  const quote = quoteForOrder(rates, preference);
  if (!quote) return null;

  return {
    shipping: quote.buyerPrice,
    quotedRate: quote.rate.price,
    courier: quote.rate.courier,
    serviceId: quote.rate.serviceId,
    serviceCode: quote.rate.serviceCode,
    weightKg,
  };
};

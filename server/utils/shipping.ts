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
import { getUserProfile } from "~/server/utils/user-profile";
import { findOpenParcelFor } from "~/server/utils/open-parcel";
import { JOIN_FEE_MYR } from "~/shared/order-joining";
import { noteError } from "~/server/utils/oplog";

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

  const seller = (await getUserProfile(db, order.sellerUid)) as any;
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
  const quote = quoteForOrder(rates, preference, seller.preferredCouriers ?? []);
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

// ── The buyer-facing quote ──────────────────────────────────────────────
//
// One function for every place a buyer is charged postage: the cart's live
// quote (/api/shipping/quote), order placement (/api/orders/place) and the
// price at payment (server/utils/order-pricing.ts). It answers the join
// question first: a parcel from this seller to this address that is paid but
// not yet labelled already carries the postage, so the newcomer pays only the
// join fee.

export interface BuyerShippingQuote {
  shipping: number;
  quotedRate: number;
  courier: string;
  serviceId: string;
  serviceCode: string;
  weightKg: number | null;
  /** The open parcel this order ships inside, when the price is a join fee. */
  joinsOrderId: string | null;
}

export type BuyerShippingResult =
  | { available: true; quote: BuyerShippingQuote }
  | { available: false; reason: "no_pickup_address" | "no_courier" };

export const quoteShippingForBuyer = async (
  db: Firestore,
  input: {
    buyerUid: string;
    sellerUid: string;
    itemCount: number;
    destination: { postcode?: string; city?: string; state?: string; address1?: string };
  },
): Promise<BuyerShippingResult> => {
  const { destination } = input;
  const openParcel = await findOpenParcelFor(db, {
    buyerUid: input.buyerUid,
    sellerUid: input.sellerUid,
    destination,
  });
  if (openParcel) {
    return {
      available: true,
      quote: {
        // Not postage, that is paid. This covers the combined parcel being
        // heavier than the one already quoted.
        shipping: JOIN_FEE_MYR,
        quotedRate: 0,
        courier: openParcel.shippingCourier || "",
        serviceId: openParcel.shippingServiceId || "",
        serviceCode: openParcel.shippingServiceCode || "",
        weightKg: null,
        joinsOrderId: openParcel.id,
      },
    };
  }

  const seller = (await getUserProfile(db, input.sellerUid)) as any;
  if (!seller?.pickupPostcode || !seller?.pickupState) {
    return { available: false, reason: "no_pickup_address" };
  }

  // Same weight function the booking route uses, so the quote and the eventual
  // label describe the same parcel.
  const weightKg = parcelWeightKg({ items: new Array(Math.max(1, input.itemCount || 1)) });
  const rates = await delyvaQuote({
    origin: {
      address1: seller.pickupAddress1 || "",
      city: seller.pickupCity || "",
      state: stateName(seller.pickupState),
      postcode: String(seller.pickupPostcode),
      country: "MY",
    },
    destination: {
      address1: destination.address1 || "",
      city: destination.city || "",
      state: stateName(destination.state || ""),
      postcode: String(destination.postcode || ""),
      country: "MY",
    },
    weightKg,
  });

  const preference: HandoverPreference =
    seller.handoverPreference === "pickup" ? "pickup" : "dropoff";
  const quote = quoteForOrder(rates, preference, seller.preferredCouriers ?? []);
  if (!quote) {
    // A checkout that can't be completed, so it's worth seeing even though
    // nothing technically errored: a route with no coverage looks identical
    // to a misconfigured courier list from the buyer's side.
    noteError({
      area: "shipping",
      severity: "warning",
      code: "shipping.no_courier",
      message: `No courier available ${seller.pickupPostcode} → ${destination.postcode}.`,
      userUid: input.sellerUid,
      context: {
        fromPostcode: String(seller.pickupPostcode),
        toPostcode: String(destination.postcode),
        weightKg,
        ratesReturned: rates.length,
        preference,
      },
      hint: "The buyer couldn't check out. Check the seller's preferred couriers and the Delyva service coverage.",
    });
    return { available: false, reason: "no_courier" };
  }

  return {
    available: true,
    quote: {
      shipping: quote.buyerPrice,
      // Recorded on the order so a later booking can be checked against what
      // the buyer was actually quoted.
      quotedRate: quote.rate.price,
      courier: quote.rate.courier,
      serviceId: quote.rate.serviceId,
      serviceCode: quote.rate.serviceCode,
      weightKg,
      joinsOrderId: null,
    },
  };
};

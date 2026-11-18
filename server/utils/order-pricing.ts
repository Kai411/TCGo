// The amount a compiled order will be billed at, worked out from its delivery
// address. Shared by the price check the buyer sees before paying and by
// create-bill, so the total on screen is the total at the bank.

import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { needsShippingQuote, regionForState, shippingQuoteKey, totalForRegion } from "~/shared/shipping";
import { quoteOrderShipping } from "~/server/utils/shipping";

export interface OrderPrice {
  region: "WM" | "EM";
  shipping: number;
  total: number;
  courier: string | null;
}

/**
 * Prices the order for its delivery address and saves the result on it.
 * `order` is updated in place. Throws a 400 when no courier rate is available.
 */
export const priceOrderForPayment = async (
  db: Firestore,
  orderRef: DocumentReference,
  order: any,
): Promise<OrderPrice> => {
  // Region always comes from the delivery address, never from what the buyer
  // picked earlier — you can't ship to Sabah at West Malaysia rates.
  const region = regionForState(order.deliveryAddress.state);

  // Orders placed through the cart already carry a live courier quote, frozen
  // at the price the buyer was shown. Anything else — auction wins, legacy
  // orders priced off seller-set figures — gets quoted now, against the
  // address they just entered (and again if they change it before paying).
  let shipping: number;
  let total: number;
  const patch: Record<string, unknown> = {};

  if (!needsShippingQuote(order)) {
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
      shippingQuotedFor: shippingQuoteKey(order.deliveryAddress),
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
    Object.assign(order, patch, { region, shipping, total });
  }

  return { region, shipping, total, courier: order.shippingCourier ?? null };
};

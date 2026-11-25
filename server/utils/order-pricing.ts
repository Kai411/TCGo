// The amount a compiled order will be billed at. Shared by the price check the
// buyer sees before paying (/api/orders/price) and by create-bill, so the
// total on screen is the total at the bank.
//
// Every figure is worked out here from things the buyer can't write: card
// prices from the listings (or the winning bid, for an auction), postage from
// a quote the server made for the order's delivery address. What the order
// document says its subtotal, shipping or total is never counts; it is
// overwritten with these figures.

import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { regionForState, shippingQuoteKey } from "~/shared/shipping";
import { quoteShippingForBuyer } from "~/server/utils/shipping";
import { lineItemsFromListings, roundRM, type ListingPriceView } from "~/shared/order-price";

export interface OrderPrice {
  region: "WM" | "EM";
  subtotal: number;
  shipping: number;
  total: number;
  courier: string | null;
}

const unavailable = (message: string) => createError({ statusCode: 409, message });

/** Items and subtotal from the listings, or from the auction for a win. */
const serverSubtotal = async (db: Firestore, order: any) => {
  if (order.auctionId) {
    const auction = (await db.collection("auctions").doc(String(order.auctionId)).get()).data() as any;
    const price = Number(auction?.winningBid);
    if (!auction || !Number.isFinite(price) || price <= 0 || auction.orderId !== order.id) {
      throw unavailable("This auction's winning bid couldn't be confirmed, so it can't be paid yet.");
    }
    const items = (order.items ?? []).slice(0, 1).map((i: any) => ({ ...i, price: roundRM(price) }));
    return { items, subtotal: roundRM(price) };
  }

  const cardIds: string[] = (order.items ?? []).map((i: any) => i?.cardId).filter(Boolean);
  const snaps = await Promise.all(cardIds.map((id) => db.collection("cards").doc(String(id)).get()));
  const listings = new Map<string, ListingPriceView>();
  for (const s of snaps) if (s.exists) listings.set(s.id, s.data() as ListingPriceView);
  const priced = lineItemsFromListings(order.items ?? [], listings, order.sellerUid);
  if (!priced.ok) {
    throw unavailable(
      priced.reason === "missing"
        ? "A card in this order is no longer listed, so it can't be paid for."
        : "This order has a card that can't be priced. Remove it and order again.",
    );
  }
  return { items: priced.items, subtotal: priced.subtotal };
};

/**
 * Prices the order for its delivery address and saves the result on it.
 * `order` (with its id) is updated in place. Throws a 400 when no courier
 * rate is available and a 409 when a card can't be priced any more.
 */
export const priceOrderForPayment = async (
  db: Firestore,
  orderRef: DocumentReference,
  order: any,
): Promise<OrderPrice> => {
  order.id = order.id ?? orderRef.id;
  // Region always comes from the delivery address, never from what the buyer
  // picked earlier: you can't ship to Sabah at West Malaysia rates.
  const region = regionForState(order.deliveryAddress.state);
  const { items, subtotal } = await serverSubtotal(db, order);

  // A quote is kept only when the server made it (placement or an earlier
  // pricing) for this same address. Orders placed from the browser before
  // stage 2, auction wins and merged orders get a fresh one.
  const addressKey = shippingQuoteKey(order.deliveryAddress);
  const quoteStillGood =
    order.pricedBy === "server" && order.shippingQuoted === true && order.shippingQuotedFor === addressKey;

  const patch: Record<string, unknown> = {};
  let shipping: number;
  if (quoteStillGood) {
    shipping = roundRM(Number(order.shippingWM ?? order.shipping ?? 0));
  } else {
    const result = await quoteShippingForBuyer(db, {
      buyerUid: order.buyerUid,
      sellerUid: order.sellerUid,
      itemCount: items.length,
      destination: order.deliveryAddress,
    });
    if (!result.available) {
      throw createError({
        statusCode: 400,
        message:
          "We couldn't get a shipping rate for this order. The seller may not have set a pickup address yet.",
      });
    }
    const q = result.quote;
    shipping = roundRM(q.shipping);
    Object.assign(patch, {
      shippingQuoted: true,
      shippingQuotedFor: addressKey,
      shippingWM: shipping,
      shippingEM: shipping,
      shippingCourier: q.courier,
      shippingQuotedRate: q.quotedRate,
      shippingServiceId: q.serviceId,
      shippingServiceCode: q.serviceCode,
      shippingWeightKg: q.weightKg,
      // Auction wins ship on their own (shared/order-joining.ts).
      joinsOrderId: order.auctionId ? null : q.joinsOrderId,
    });
  }

  const total = roundRM(subtotal + shipping);
  const itemsChanged = JSON.stringify(items) !== JSON.stringify(order.items ?? []);
  if (
    Object.keys(patch).length ||
    itemsChanged ||
    order.pricedBy !== "server" ||
    subtotal !== order.subtotal ||
    region !== order.region ||
    shipping !== order.shipping ||
    total !== order.total
  ) {
    Object.assign(patch, { items, subtotal, region, shipping, total, pricedBy: "server" });
    await orderRef.update(patch);
    Object.assign(order, patch);
  }

  return { region, subtotal, shipping, total, courier: order.shippingCourier ?? null };
};

// Pure pieces of server-side order pricing (ledger stage 2). No Firebase, so
// the tests import it as is. The server reads the listings; this decides what
// the order is worth from them.

export const roundRM = (n: number): number => Math.round(n * 100) / 100;

/** The listing fields pricing reads. */
export interface ListingPriceView {
  price?: number;
  sellerUid?: string;
  cardName?: string;
  cardSet?: string;
  condition?: string;
  imageUrl?: string;
  imageUrls?: string[];
  shippingWM?: number;
  shippingEM?: number;
}

export interface PricedLineItem {
  cardId: string;
  cardName: string;
  cardSet: string;
  condition: string;
  imageUrl: string;
  price: number;
  shippingWM: number;
  shippingEM: number;
}

export type PricedItems =
  | { ok: true; items: PricedLineItem[]; subtotal: number }
  | { ok: false; reason: "empty" | "missing" | "bad_price" | "other_seller"; cardId?: string };

/**
 * Line items for `cardIds` as the listings price them now. A card that isn't
 * listed, has no positive price, or belongs to another seller fails the whole
 * order: the buyer would otherwise pay for something the seller can't send.
 * Duplicate ids count once.
 */
export const lineItemsFromListings = (
  current: { cardId?: string }[],
  listings: Map<string, ListingPriceView>,
  sellerUid: string,
): PricedItems => {
  const ids = [...new Set(current.map((i) => i?.cardId).filter((id): id is string => typeof id === "string" && !!id))];
  if (!ids.length) return { ok: false, reason: "empty" };
  const items: PricedLineItem[] = [];
  for (const cardId of ids) {
    const card = listings.get(cardId);
    if (!card) return { ok: false, reason: "missing", cardId };
    if (card.sellerUid !== sellerUid) return { ok: false, reason: "other_seller", cardId };
    const price = Number(card.price);
    if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: "bad_price", cardId };
    items.push({
      cardId,
      cardName: String(card.cardName ?? "Card"),
      cardSet: String(card.cardSet ?? ""),
      condition: String(card.condition ?? ""),
      imageUrl: String(card.imageUrls?.[0] || card.imageUrl || ""),
      price: roundRM(price),
      shippingWM: Number(card.shippingWM ?? 0),
      shippingEM: Number(card.shippingEM ?? 0),
    });
  }
  return { ok: true, items, subtotal: roundRM(items.reduce((s, i) => s + i.price, 0)) };
};

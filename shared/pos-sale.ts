// An in-person counter sale: what was scanned, what it was discounted to,
// and how the payment went.
//
// Kept separate from `compiledOrders` on purpose. A marketplace order carries
// a buyer, a delivery address, shipping, escrow and a payout — none of which
// exist when someone hands over cash at a shop counter. Forcing counter sales
// through the order model would mean a dozen nullable fields and a permanent
// "is this a real order?" check on every payout query.

export type PosSaleStatus =
  /** Cards held, waiting for the customer to pay. */
  | "awaiting_payment"
  /** Money received; inventory marked sold. */
  | "paid"
  /** Payment failed or was declined; holds released. */
  | "failed"
  /** Seller backed out, or the hold lapsed before payment. */
  | "cancelled";

export type PosPaymentMethod = "duitnow_qr" | "tap_to_pay" | "cash";

export interface PosSaleLine {
  /** inventory doc id */
  itemId: string;
  /** listing doc id, when the item was also listed online */
  cardId: string | null;
  cardName: string;
  sub: string;
  image: string;
  /** The asking price the label was printed with. */
  listPrice: number;
  /** What the customer actually paid for this line. */
  soldPrice: number;
}

export interface PosSale {
  id: string;
  sellerUid: string;
  lines: PosSaleLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  status: PosSaleStatus;
  method: PosPaymentMethod;
  /** Provider-side charge id, for polling and webhook matching. */
  chargeId?: string;
  /** Raw EMVCo payload the POS renders as a QR. Not persisted after payment. */
  qrPayload?: string;
  /** When the inventory holds lapse if nobody has paid. */
  reservedUntil?: number;
  createdAt: number;
  updatedAt: number;
  paidAt?: number;
  failedReason?: string;
}

/** Per-line discount in MYR. Never negative — an upsell isn't a discount. */
export const lineDiscount = (line: Pick<PosSaleLine, "listPrice" | "soldPrice">): number =>
  Math.max(0, round2(line.listPrice - line.soldPrice));

export const isDiscounted = (line: Pick<PosSaleLine, "listPrice" | "soldPrice">): boolean =>
  lineDiscount(line) > 0;

/**
 * Totals for a set of lines.
 *
 * `subtotal` is what the labels said, `total` is what was actually charged,
 * and `discountTotal` is the gap — so the dashboard can report margin given
 * away at the counter rather than silently booking a lower sale price.
 */
export const posTotals = (lines: Array<Pick<PosSaleLine, "listPrice" | "soldPrice">>) => {
  const subtotal = round2(lines.reduce((s, l) => s + (l.listPrice || 0), 0));
  const total = round2(lines.reduce((s, l) => s + (l.soldPrice || 0), 0));
  return {
    subtotal,
    total,
    discountTotal: round2(Math.max(0, subtotal - total)),
    discountedCount: lines.filter(isDiscounted).length,
  };
};

/** MYR is a 2-decimal currency; float sums drift without this. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Providers price in the minor unit. */
export const toSen = (myr: number): number => Math.round(round2(myr) * 100);

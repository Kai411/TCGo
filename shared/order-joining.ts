// Combining a buyer's orders into one parcel, before anyone pays twice.
//
// THE PROBLEM THIS REPLACES
// ────────────────────────
// Orders used to be merged after the fact: a buyer ordered three times from
// one seller, paid RM 6 shipping each time, and the seller then combined them
// into a single parcel. One label got bought and the other RM 12 stayed with
// the platform. The buyer paid for three deliveries and received one.
//
// Merging late also fought itself — labels already bought had to be cancelled
// and re-booked, which is two courier API calls that can each fail halfway.
//
// THE WINDOW
// ──────────
// So the shipping is never charged twice in the first place. A paid order
// that has no label yet is an OPEN PARCEL: anything else the same buyer sends
// to the same address can still go in it. Checkout spots that, charges no
// shipping on the newcomer, and the two are combined when it settles.
//
// The window closes the moment a label is bought, because after that there is
// a physical waybill with a specific parcel on it. Merging past that point is
// how you end up with two labels for one box.
//
// This is also why booking moved off the payment webhook: auto-booking closed
// the window instantly, before a second order could ever exist.

/**
 * What a buyer pays to add an order to a parcel that hasn't gone out yet.
 *
 * Not shipping — the postage on that parcel is already paid. This covers the
 * combined parcel weighing more than the one that was quoted: the label is
 * re-quoted at booking and a heavier box costs more, and something has to
 * carry that or every join quietly costs the platform money.
 *
 * SET TO MATCH THE COLLECTION FEE, NOT ROUNDED DOWN.
 * A joined order buys no second label, so it never earns the ~RM 1.24 postage
 * buffer that a standalone order does — but Billplz still charges RM 1.25 to
 * collect it. At RM 1.00 the join was 25 sen short before the heavier label
 * was even considered, which pushed break-even from RM 0.25 to RM 6.25 and
 * put 38 of the 113 live listings underwater as joined orders. At RM 1.25 a
 * joined order is exactly as profitable as a standalone one.
 *
 * Still far below a second delivery. Joining stays the obvious choice for the
 * buyer: RM 1.25 against another RM 6 and a second parcel to wait for.
 */
export const JOIN_FEE_MYR = 1.25;

export interface JoinableOrder {
  status?: string;
  /** Set once a courier label has been bought. Closes the window. */
  shipmentOrderNo?: string | null;
  /** Set while a booking is in flight — treated as closed, not "not yet". */
  shipmentClaimedAt?: number | null;
  /** Auctions settle one-per-order and never combine. */
  auctionId?: string | null;
  /** Already folded into another order. */
  mergedInto?: string | null;
  /** Underpayment held for an admin — never quietly absorbed into a parcel. */
  paymentAmountMismatch?: unknown;
  buyerUid?: string;
  sellerUid?: string;
}

/** Money is in and the parcel hasn't been labelled — it can still take more. */
export const isOpenParcel = (order: JoinableOrder): boolean => {
  if (order.status !== "paid" && order.status !== "confirmed") return false;
  // A claim in flight counts as closed: the label may exist by the time
  // anything else lands, and racing a courier booking is not worth RM 6.
  if (order.shipmentOrderNo || order.shipmentClaimedAt) return false;
  if (order.auctionId || order.mergedInto) return false;
  if (order.paymentAmountMismatch) return false;
  return true;
};

/**
 * Why the seller can't combine these, in words they'd use. Null when they can.
 */
export const closedReason = (order: JoinableOrder): string | null => {
  if (!isOpenParcel(order)) {
    if (order.shipmentOrderNo || order.shipmentClaimedAt) {
      return "A waybill has already been printed for this order.";
    }
    if (order.auctionId) return "Auction wins ship on their own.";
    if (order.paymentAmountMismatch) return "This payment is being checked.";
    return "This order isn't ready to combine.";
  }
  return null;
};

/**
 * The open parcel a new order should join, if there is one.
 *
 * Same buyer AND same destination — a buyer shipping to two addresses gets
 * two parcels, and `addressKey` is what decides that (see merge-orders.ts).
 * Oldest first: the buyer has been waiting on it longest, so it is the one
 * most likely to be packed next.
 */
export const findOpenParcel = <T extends JoinableOrder & { createdAt?: number }>(
  orders: T[],
  match: { sellerUid: string; addressKey: string },
  addressKeyOf: (o: T) => string,
): T | null => {
  const open = orders
    .filter((o) => o.sellerUid === match.sellerUid)
    .filter(isOpenParcel)
    .filter((o) => addressKeyOf(o) === match.addressKey)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return open[0] ?? null;
};

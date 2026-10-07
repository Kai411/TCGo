// The first 30 minutes of a paid order.
//
// ONE WINDOW, TWO SIDES OF IT. For 30 minutes after payment the buyer may
// cancel and request a refund, and the seller may not book the courier. The
// moment one closes the other opens, so a buyer can never cancel an order the
// seller has already bought a label for.
//
// That matters for cost: Delyva moves a booking past its API-cancellable
// status within seconds, so a label bought and then cancelled is courier
// credit we may not get back. Keeping cancellation before booking avoids it.
//
// Counted from payment (paidAt), falling back to creation for an order with
// no payment time. For an online order payment is when it reaches the seller.

export const CANCEL_GRACE_MINUTES = 30;
export const CANCEL_GRACE_MS = CANCEL_GRACE_MINUTES * 60 * 1000;

interface WindowOrder {
  status?: string | null;
  paidAt?: number | null;
  createdAt?: number | null;
  shipmentOrderNo?: string | null;
}

const startOf = (o: WindowOrder | null | undefined): number | null =>
  o?.paidAt ?? o?.createdAt ?? null;

/** When the buyer's cancellation window closes — and courier booking opens. */
export const graceEndsAt = (o: WindowOrder | null | undefined): number | null => {
  const start = startOf(o);
  return start == null ? null : start + CANCEL_GRACE_MS;
};

const CANCELLABLE = ["paid", "confirmed"];

/** Buyer may still cancel and request a refund. */
export const canBuyerCancel = (o: WindowOrder | null | undefined, now = Date.now()): boolean => {
  if (!o || !CANCELLABLE.includes(o.status ?? "")) return false;
  if (o.shipmentOrderNo) return false;
  const ends = graceEndsAt(o);
  return ends != null && now < ends;
};

/** Seller may book the courier: only once the buyer's window has closed. */
export const canBookCourier = (o: WindowOrder | null | undefined, now = Date.now()): boolean => {
  const ends = graceEndsAt(o);
  return ends == null || now >= ends;
};

/** Whole minutes until `until`, rounded up; 0 once it has passed. */
export const minutesUntil = (until: number | null, now = Date.now()): number =>
  until == null ? 0 : Math.max(0, Math.ceil((until - now) / 60000));

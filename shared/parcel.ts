// Parcel shape and weight — provider-neutral.
//
// One definition used by quoting and (eventually) booking, so we never price
// one box and ship another.

export const PARCEL_DIMS = { length: 25, width: 18, height: 3 } as const;

// Derive the parcel weight from the order rather than trusting the client.
// ~20g per sleeved/toploadered card plus packaging, floored at 100g and capped
// so a typo can't book a 50kg parcel. A caller-supplied hint is honoured only
// within the plausible range.
export const parcelWeightKg = (
  order: { items?: unknown[] },
  hint?: number,
): number => {
  const count = Math.max(1, order.items?.length ?? 1);
  const derived = Math.max(0.1, Math.round((0.06 + count * 0.02) * 100) / 100);
  const n = Number(hint);
  if (Number.isFinite(n) && n >= derived && n <= Math.max(2, derived * 5)) {
    return Math.round(n * 100) / 100;
  }
  return derived;
};

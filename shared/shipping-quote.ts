// Turning a raw courier rate into the price we charge the buyer.
//
// The buyer pays this at checkout, before anyone books a courier, so the
// number has to survive a couple of days of drift between quote and dispatch.
// The buffer exists to absorb that drift — it is not a margin.
//
// What can push the real cost above the quote:
//   1. weight drift        — near zero; parcelWeightKg() is deterministic and
//                            the same function quotes and books.
//   2. cheapest unavailable — the real risk. Cheapest→dearest spread measured
//                            on live rates was ~RM 1.90 within West Malaysia
//                            but ~RM 8.15 to East Malaysia.
//   3. drop-off vs pickup   — the cheapest service is usually drop-off only;
//                            a collection service costs RM 0–0.45 more (WM).
//
// RM 1.00 covers a West Malaysia fallback comfortably and is deliberately thin
// for East Malaysia: rather than inflate every East order to cover a rare worst
// case, the cost cap in /api/easyparcel/shipment refuses an over-budget courier
// at booking time, turning an overrun into a blocked booking rather than a
// silent loss.

/** Flat buffer added after rounding. */
export const SHIPPING_BUFFER_MYR = 1.0;
/** Charged price is rounded up to a multiple of this. */
export const SHIPPING_ROUNDING_MYR = 0.5;

const roundUpTo = (value: number, step: number) =>
  Math.round(Math.ceil(value / step) * step * 100) / 100;

/**
 * Buyer-facing shipping price for a raw courier rate.
 *   RM 5.00  → RM 6.00      RM 10.90 → RM 12.00
 *   RM 5.60  → RM 7.00      RM 6.90  → RM 8.00
 */
export const buyerShippingPrice = (rawRate: number): number => {
  if (!Number.isFinite(rawRate) || rawRate <= 0) return 0;
  return roundUpTo(rawRate + SHIPPING_BUFFER_MYR, SHIPPING_ROUNDING_MYR);
};

// How the seller wants parcels handed to the courier. Decides which services
// we're allowed to quote — quoting a drop-off rate to a seller who expects
// collection produces a price they can't actually book at.
export type HandoverPreference = "dropoff" | "pickup";

export interface CourierRate {
  serviceId: string;
  serviceCode: string;
  courier: string;
  serviceName: string;
  /** Raw courier rate in MYR, before buffer. */
  price: number;
  /** True when the service requires the seller to drop off at a point. */
  dropoffOnly: boolean;
  etd: string;
}

/**
 * Plausible price band for a domestic parcel under ~2kg, in MYR.
 *
 * A brand-agnostic sanity guard, because the selection rule is "cheapest
 * wins" with nothing underneath it. The DelyvaX demo tenant makes the failure
 * obvious — it returns a RM 0.10 "Instant Delivery" that wins every quote and
 * a RM 15,000 Lalamove entry — but the same shape of bad data in production
 * would be charged to a real buyer, so this guards both.
 */
export const MIN_PLAUSIBLE_RATE_MYR = 2.0;
export const MAX_PLAUSIBLE_RATE_MYR = 150.0;

/**
 * Service classes that can't fulfil a mail-order card order, whatever they
 * cost. On-demand point-to-point couriers need a rider and an immediate
 * handover, so they can't do a scheduled collection — and they certainly
 * can't cross to East Malaysia, which the demo tenant happily quotes them for.
 *
 * Deliberately matched on service name rather than a courier allowlist: the
 * production tenant's parcel services (SPX, J&T, Ninja Van, DHL eCommerce,
 * ABX, City-Link, Pos Laju) contain none of these words, so this narrows the
 * junk without silently dropping a real courier we haven't seen yet.
 */
const NON_PARCEL_SERVICE =
  /\b(instant|same[-\s]?day|lalamove|grab(express)?|borzo|mr\.?\s*speedy|restock|international)\b/i;

/** A rate we're willing to quote or book. */
export const isQuotableRate = (r: CourierRate): boolean =>
  r.price >= MIN_PLAUSIBLE_RATE_MYR &&
  r.price <= MAX_PLAUSIBLE_RATE_MYR &&
  !NON_PARCEL_SERVICE.test(r.serviceName || r.courier);

/** Drop anything we shouldn't be quoting at all. */
export const quotableRates = (rates: CourierRate[]): CourierRate[] =>
  rates.filter(isQuotableRate);

// Services a seller can actually use, cheapest first. A pickup-preferring
// seller never sees drop-off-only rates; a drop-off seller sees everything,
// since they can always hand a collection parcel over too.
export const usableRates = (
  rates: CourierRate[],
  preference: HandoverPreference,
): CourierRate[] => {
  const quotable = quotableRates(rates);
  const usable =
    preference === "pickup" ? quotable.filter((r) => !r.dropoffOnly) : quotable;
  return [...usable].sort((a, b) => a.price - b.price);
};

// The quote we commit to the order.
//
// Cheapest usable service, unless the seller has named couriers they prefer
// and at least one serves this route — then it's the cheapest of those. A
// preference is not a guarantee: courier availability varies by destination
// (J&T reaches Penang but not every Sabah postcode), so an unavailable
// preference silently falls back rather than blocking the sale.
export const quoteForOrder = (
  rates: CourierRate[],
  preference: HandoverPreference,
  preferredCouriers: string[] = [],
): { rate: CourierRate; buyerPrice: number; preferredUsed: boolean } | null => {
  const usable = usableRates(rates, preference);
  if (!usable.length) return null;

  const wanted = preferredCouriers.map((c) => c.trim().toLowerCase()).filter(Boolean);
  const preferred = wanted.length
    ? usable.filter((r) => wanted.includes(r.courier.trim().toLowerCase()))
    : [];

  const chosen = preferred[0] ?? usable[0]!;
  return {
    rate: chosen,
    buyerPrice: buyerShippingPrice(chosen.price),
    preferredUsed: preferred.length > 0,
  };
};

// Distinct courier brands in a set of rates, cheapest-first order preserved.
export const courierBrands = (rates: CourierRate[]): string[] => {
  const seen: string[] = [];
  // Same filter as quoting — a seller shouldn't be offered a preferred courier
  // we would never actually book.
  for (const r of quotableRates(rates))
    if (r.courier && !seen.includes(r.courier)) seen.push(r.courier);
  return seen;
};

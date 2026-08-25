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

// Services a seller can actually use, cheapest first. A pickup-preferring
// seller never sees drop-off-only rates; a drop-off seller sees everything,
// since they can always hand a collection parcel over too.
export const usableRates = (
  rates: CourierRate[],
  preference: HandoverPreference,
): CourierRate[] => {
  const usable =
    preference === "pickup" ? rates.filter((r) => !r.dropoffOnly) : rates;
  return [...usable].sort((a, b) => a.price - b.price);
};

// The quote we commit to the order. Cheapest usable service plus buffer.
export const quoteForOrder = (
  rates: CourierRate[],
  preference: HandoverPreference,
): { rate: CourierRate; buyerPrice: number } | null => {
  const usable = usableRates(rates, preference);
  const cheapest = usable[0];
  if (!cheapest) return null;
  return { rate: cheapest, buyerPrice: buyerShippingPrice(cheapest.price) };
};

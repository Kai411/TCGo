// Payout math — the single source of truth for "how much does the seller get"
// and "is this order eligible yet".
//
// Shared deliberately: the seller's funds page, the payout request route, and
// the admin execution route must all agree to the sen. Anything that computes
// a payout amount outside this file is a bug.
//
// Structurally typed (not importing CompiledOrder) so Nitro can use it without
// pulling in the Vue composable layer.

// Platform commission on the item subtotal.
//
// The rate itself lives in shared/pricing (BETA_RATE while in beta, per-plan
// rates at launch) so the seller-facing pricing page, the admin revenue
// forecast and the money actually deducted here can never quote three
// different numbers.
export { effectiveRate } from "~/shared/pricing";
import { effectiveRate, sstOn, type PlanId } from "~/shared/pricing";

/** @deprecated Read the rate via effectiveRate() — it varies by plan at launch. */
export const PLATFORM_FEE_PERCENT = effectiveRate();

// Hold window after delivery before funds unlock (dispute buffer).
export const PAYOUT_HOLD_DAYS = 3;
export const PAYOUT_HOLD_MS = PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000;

export type PayoutStatus =
  | "pending"
  | "queued"
  | "processing"
  | "paid"
  | "failed";

export interface PayableOrder {
  subtotal?: number;
  /** Commission recorded at settlement. Authoritative once written. */
  platformFee?: number;
  /**
   * The rate that fee was struck at, as a fraction. Recorded because it
   * cannot be reliably recovered from the fee: MYR rounds to the sen, so 2%
   * of RM 1.12 stores as RM 0.02 and reads back as 1.79%.
   */
  platformFeeRate?: number;
  /** Service tax recorded at settlement. Authoritative once written. */
  sstAmount?: number;
  /** Seller's share recorded at settlement. Authoritative once written. */
  sellerPayout?: number;
  shipping?: number;
  total?: number;
  status?: string;
  paymentMethod?: string;
  deliveredAt?: number;
  payoutStatus?: PayoutStatus;
  // Present when the platform booked the label on its own courier credit.
  // Absent means the seller shipped it themselves and paid the courier.
  shipmentOrderNo?: string;
  /**
   * The seller paid the courier themselves, out of pocket.
   *
   * Never set by the normal flow — TCGo buys every label. It exists so a
   * booking failure that a seller worked around by hand can be made good
   * deliberately, rather than by the payout maths guessing from a missing
   * field. See shippingReimbursement().
   */
  selfShipped?: boolean;
  /** Seller's subscription plan, once orders record it. Beta ignores this. */
  sellerPlan?: PlanId;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// `sellerPlan` is absent on every order today, so this resolves to the beta
// rate for everyone. It starts honouring per-plan rates the moment orders
// carry the seller's plan — no change needed here.
export const platformFeeFor = (order: PayableOrder): number =>
  round2((order.subtotal || 0) * effectiveRate(order.sellerPlan));

// Postage is not the seller's money, and neither is the join fee.
//
// The buyer pays both to TCGo; TCGo buys the label from its own Delyva
// credit. Paying either out to the seller would mean covering postage twice.
//
// THIS USED TO KEY OFF shipmentOrderNo, AND THAT BROKE.
// The rule was "reimburse if we did not pay the courier", which was safe
// while the payment webhook booked the label the instant money landed —
// shipmentOrderNo was always set by the time anyone looked. Booking then
// moved to the seller's request, so that a second order can still join the
// parcel, and the window between payment and booking became the NORMAL state
// rather than an error. In that window every order looked self-shipped, and
// the seller's statement credited them the full postage: a RM 70 card showed
// a RM 74.45 payout that would silently drop to RM 67.20 once the label was
// bought.
//
// So it now keys off an explicit fact instead of the absence of one.
// `selfShipped` is set only when a seller genuinely dispatched at their own
// cost — which is not a flow the product offers, so in practice this is zero
// and the number on the statement is the number that arrives.
export const shippingReimbursement = (order: PayableOrder): number =>
  order.selfShipped === true ? round2(order.shipping || 0) : 0;

/**
 * Service tax on this order's fee. Zero until TCGo is SST-registered.
 *
 * Charged on the fee, not the sale: the card is the seller's supply, ours is
 * the service we take a commission for.
 */
export const sstForOrder = (order: PayableOrder): number =>
  sstOn(platformFeeFor(order));

export const computeSellerPayout = (order: PayableOrder): number =>
  round2(
    (order.subtotal || 0) -
      platformFeeFor(order) -
      sstForOrder(order) +
      shippingReimbursement(order),
  );

// ── The record, not the recalculation ────────────────────────────────
//
// platformFeeFor and computeSellerPayout above read TODAY'S rate. That is
// what you want when pricing a sale that is happening now, and wrong for
// every sale that already happened.
//
// The Billplz webhook writes platformFee and sellerPayout onto the order at
// the moment payment settles. From then on those are history: a card sold
// during beta was charged 2%, and it stays charged 2% after BETA_PRICING
// flips to false, after the seller moves to Vendor, after anything. Reading
// the constants again would re-price the past — and at the payout route that
// is not a display bug, it is paying the seller the wrong amount.
//
// Use these anywhere an order has already settled. Use the two above only
// when creating the record, or for an order that predates it.

/** Commission actually charged on this order. */
export const recordedFee = (order: PayableOrder): number =>
  order.platformFee != null ? round2(order.platformFee) : platformFeeFor(order);

/**
 * Service tax actually charged on this order.
 *
 * An absent sstAmount means ZERO, not "work it out" — and this is the one
 * accessor here that must not fall back to a fresh calculation. The field
 * only started being written once SST was wired up, which was necessarily
 * before registration, so an order without it was charged no tax. Deriving
 * instead would hand every pre-registration order an 8% bill the day
 * SST_REGISTERED flips, which is the same re-pricing trap platformFeeRate
 * exists to close.
 *
 * recordedFee can safely derive because a legacy order WAS charged
 * something and the calculation approximates it. Here the answer is known.
 */
export const recordedSst = (order: PayableOrder): number =>
  order.sstAmount != null ? round2(order.sstAmount) : 0;

/** Seller's share actually recorded for this order. */
export const recordedPayout = (order: PayableOrder): number =>
  order.sellerPayout != null ? round2(order.sellerPayout) : computeSellerPayout(order);

// Only online (Billplz) money is held by the platform. Manual/WhatsApp orders
// and POS sales never enter the payout rail — the seller already has that cash.
export const isPayoutTrackable = (order: PayableOrder): boolean =>
  order.paymentMethod === "billplz" &&
  ["paid", "shipped", "delivered"].includes(order.status || "");

export const payoutEligibleAt = (order: PayableOrder): number | null =>
  order.status === "delivered" && order.deliveredAt
    ? order.deliveredAt + PAYOUT_HOLD_MS
    : null;

// The authoritative "can this order be paid out right now" check. The server
// re-runs this at request and execution time; the client uses it for display.
export const isPayoutEligible = (
  order: PayableOrder,
  now: number = Date.now(),
): boolean => {
  if (!isPayoutTrackable(order)) return false;
  const ps = order.payoutStatus ?? "pending";
  if (ps !== "pending" && ps !== "failed") return false;
  if (recordedPayout(order) <= 0) return false;
  const eligible = payoutEligibleAt(order);
  return eligible !== null && now >= eligible;
};

export const sumAmounts = (amounts: number[]): number =>
  round2(amounts.reduce((t, n) => t + n, 0));

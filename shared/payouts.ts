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
import { effectiveRate, type PlanId } from "~/shared/pricing";

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
  /** Seller's subscription plan, once orders record it. Beta ignores this. */
  sellerPlan?: PlanId;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// `sellerPlan` is absent on every order today, so this resolves to the beta
// rate for everyone. It starts honouring per-plan rates the moment orders
// carry the seller's plan — no change needed here.
export const platformFeeFor = (order: PayableOrder): number =>
  round2((order.subtotal || 0) * effectiveRate(order.sellerPlan));

// Shipping is only reimbursed to the seller when *they* paid the courier.
// When the platform books the label it's charged to the platform's own courier
// credit, so the shipping the buyer paid stays with the platform — paying it
// out again would mean covering postage twice.
//
// TCGo books every label now — the Billplz webhook books through Delyva the
// moment payment settles, so in the normal flow shipmentOrderNo is always set
// and postage is never reimbursed. Sellers are not meant to ship with their
// own labels at all.
//
// The reimbursement branch is the safety net, not an alternative flow: when a
// booking fails the order carries shipmentError and the seller may dispatch it
// themselves out of pocket. Hard-coding this to zero would quietly keep the
// postage they paid for. Reimburse if and only if we did not pay the courier.
export const shippingReimbursement = (order: PayableOrder): number =>
  order.shipmentOrderNo ? 0 : round2(order.shipping || 0);

export const computeSellerPayout = (order: PayableOrder): number =>
  round2(
    (order.subtotal || 0) - platformFeeFor(order) + shippingReimbursement(order),
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

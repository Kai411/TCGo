// Payout math — the single source of truth for "how much does the seller get"
// and "is this order eligible yet".
//
// Shared deliberately: the seller's funds page, the payout request route, and
// the admin execution route must all agree to the sen. Anything that computes
// a payout amount outside this file is a bug.
//
// Structurally typed (not importing CompiledOrder) so Nitro can use it without
// pulling in the Vue composable layer.

// Platform commission on the item subtotal. 0 during beta — the plumbing
// exists so turning this on later is a one-line change.
export const PLATFORM_FEE_PERCENT = 0;

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
  shipping?: number;
  total?: number;
  status?: string;
  paymentMethod?: string;
  deliveredAt?: number;
  payoutStatus?: PayoutStatus;
  // Present when the platform booked the label on its own courier credit.
  // Absent means the seller shipped it themselves and paid the courier.
  shipmentOrderNo?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const platformFeeFor = (order: PayableOrder): number =>
  round2((order.subtotal || 0) * PLATFORM_FEE_PERCENT);

// Shipping is only reimbursed to the seller when *they* paid the courier.
// When the platform books the label it's charged to the platform's own courier
// credit, so the shipping the buyer paid stays with the platform — paying it
// out again would mean covering postage twice.
//
// There is no platform-booked path today (sellers dispatch with their own
// label and enter a tracking number), so in practice this always reimburses.
// The check stays so the sums remain correct the moment booking lands.
export const shippingReimbursement = (order: PayableOrder): number =>
  order.shipmentOrderNo ? 0 : round2(order.shipping || 0);

export const computeSellerPayout = (order: PayableOrder): number =>
  round2(
    (order.subtotal || 0) - platformFeeFor(order) + shippingReimbursement(order),
  );

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
  if (computeSellerPayout(order) <= 0) return false;
  const eligible = payoutEligibleAt(order);
  return eligible !== null && now >= eligible;
};

export const sumAmounts = (amounts: number[]): number =>
  round2(amounts.reduce((t, n) => t + n, 0));

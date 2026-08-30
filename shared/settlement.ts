// The settlement statement for one order — what the buyer paid, what came
// off, and what reaches the seller's bank.
//
// One definition, used by the order page and the funds screens, because a
// seller comparing two screens that disagree about their own money will
// (rightly) stop trusting both.
//
// AUTHORITY: the figures written at settlement win. platformFee and
// sellerPayout are computed by the Billplz webhook at the moment payment
// lands and stored on the order; recomputing them later would re-price
// history the next time a rate constant changes — a card sold during beta at
// 2% would silently restate as 4% on launch day. Recomputation is the
// fallback for orders written before those fields existed, nothing more.

import { recordedFee, recordedPayout } from "~/shared/payouts";
import { BETA_RATE, PLANS } from "~/shared/pricing";

export interface SettlementOrder {
  subtotal?: number;
  shipping?: number;
  total?: number;
  platformFee?: number;
  /** Rate the fee was struck at, as a fraction. Recorded at settlement. */
  platformFeeRate?: number;
  sellerPayout?: number;
  /** Set when TCGo booked the courier label and paid for it. */
  shipmentOrderNo?: string | null;
  sellerPlan?: string;
}

export interface SettlementLine {
  label: string;
  /** Signed: positive is money in, negative is money out. */
  amount: number;
  kind: "gross" | "credit" | "deduction" | "total";
  note?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What was actually charged, not what today's rate would charge. */
export const feeCharged = (order: SettlementOrder): number =>
  recordedFee(order as any);

/** What actually reaches the bank. */
export const payoutAmount = (order: SettlementOrder): number =>
  recordedPayout(order as any);

/** Every rate TCGo has ever charged, as percentages. */
const KNOWN_RATES = [...new Set([BETA_RATE, ...PLANS.map((p) => p.rate)])].map(
  (r) => round2(r * 100),
);

/**
 * The rate this order was charged at, as a percentage.
 *
 * Read from the record where possible. Deriving it from the fee — which is
 * what this used to do — breaks on small orders, because the fee is stored to
 * the sen: 2% of RM 1.12 is RM 0.0224, banks to RM 0.02, and divides back to
 * 1.79%. The seller was charged 2% and the statement said 1.79%.
 *
 * For orders settled before the rate was recorded, the derivation carries at
 * most half a sen of error, which is a known bound: ±(0.005 / subtotal). If a
 * rate we actually charge sits inside that window, it is the one that was
 * charged, so snap to it. Outside the window the figure is real — a merged
 * order blending two rates, say — and is shown as-is.
 */
export const rateCharged = (order: SettlementOrder): number | null => {
  if (order.platformFeeRate != null) return round2(order.platformFeeRate * 100);

  const subtotal = order.subtotal || 0;
  if (subtotal <= 0) return null;

  const derived = (feeCharged(order) / subtotal) * 100;
  const tolerance = (0.005 / subtotal) * 100;
  const match = KNOWN_RATES.find((r) => Math.abs(derived - r) <= tolerance);
  return match ?? round2(derived);
};

/**
 * Statement lines, in the order a seller reads them: what they sold, what
 * came off it, what they get.
 *
 * Deliberately does NOT open with what the buyer paid. An earlier version
 * did — "Buyer paid RM 7.12" at the top, "Your payout RM 1.10" at the
 * bottom — and it read as though RM 6 had been taken from the seller. It
 * hadn't: the buyer's postage went to the courier and was never part of the
 * sale. Showing money that was never theirs, then deducting it again, invents
 * a loss the seller then has to be talked out of.
 *
 * So the statement starts at the sale. Shipping appears only when it is
 * genuinely the seller's money — when they bought the label and we owe it
 * back. Otherwise it is a footnote; see shippingNote().
 */
export const settlementLines = (order: SettlementOrder): SettlementLine[] => {
  const subtotal = round2(order.subtotal || 0);
  const shipping = round2(order.shipping || 0);
  const fee = feeCharged(order);
  const rate = rateCharged(order);
  const platformBooked = !!order.shipmentOrderNo;

  const lines: SettlementLine[] = [
    { label: "Card sold", amount: subtotal, kind: "gross" },
  ];

  // Money owed back to the seller, not money passing through.
  if (!platformBooked && shipping > 0) {
    lines.push({
      label: "Shipping reimbursed",
      amount: shipping,
      kind: "credit",
      note: "You booked the label, so the buyer's postage comes back to you.",
    });
  }

  lines.push({
    label: rate != null ? `TCGo fee (${rate}%)` : "TCGo fee",
    amount: -fee,
    kind: "deduction",
    note: "Charged once, when the buyer paid. Nothing further is deducted at payout.",
  });

  lines.push({
    label: "Your payout",
    amount: payoutAmount(order),
    kind: "total",
  });

  return lines;
};

/**
 * The postage explanation, for orders where TCGo bought the label.
 *
 * A seller who sees the buyer paid RM 7.12 and reads a RM 1.10 payout will
 * ask where the rest went, so answer it before they have to — but as an
 * aside, not as a line in their statement.
 */
export const shippingNote = (order: SettlementOrder): string => {
  const shipping = round2(order.shipping || 0);
  if (!order.shipmentOrderNo || shipping <= 0) return "";
  return `The buyer also paid RM ${shipping.toFixed(
    2,
  )} for shipping. That went to the courier for the label we booked — it was never part of your sale.`;
};

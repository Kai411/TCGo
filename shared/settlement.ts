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

import { recordedFee, recordedPayout, recordedSst } from "~/shared/payouts";
import { BETA_RATE, PLANS, splitFee, SST_RATE } from "~/shared/pricing";

export interface SettlementOrder {
  selfShipped?: boolean;
  subtotal?: number;
  shipping?: number;
  /** Ids folded into this parcel. Present only on a combined order. */
  joinedOrderIds?: string[] | null;
  total?: number;
  platformFee?: number;
  /** Rate the fee was struck at, as a fraction. Recorded at settlement. */
  platformFeeRate?: number;
  /** Service tax charged on the fee. Recorded at settlement; zero if we
   *  weren't SST-registered at the time. */
  sstAmount?: number;
  sellerPayout?: number;
  /** Set when TCGo booked the courier label and paid for it. */
  shipmentOrderNo?: string | null;
  sellerPlan?: string;
}

export interface SettlementLine {
  label: string;
  /** Signed: positive is money in, negative is money out. */
  amount: number;
  kind: "gross" | "credit" | "deduction" | "sub" | "total";
  note?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What was actually charged, not what today's rate would charge. */
export const feeCharged = (order: SettlementOrder): number =>
  recordedFee(order as any);

/** What actually reaches the bank. */
export const payoutAmount = (order: SettlementOrder): number =>
  recordedPayout(order as any);

/** Service tax charged on this order. Zero before TCGo was SST-registered. */
export const sstCharged = (order: SettlementOrder): number =>
  recordedSst(order as any);

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
  const selfShipped = order.selfShipped === true;

  const lines: SettlementLine[] = [
    { label: "Card sold", amount: subtotal, kind: "gross" },
  ];

  // Only when the seller genuinely paid a courier out of pocket.
  //
  // This used to appear whenever no label had been bought yet — which, since
  // booking moved to the seller's request, is every order between payment and
  // dispatch. The statement credited postage that was never the seller's and
  // then quietly took it back when the label was bought.
  if (selfShipped && shipping > 0) {
    lines.push({
      label: "Shipping reimbursed",
      amount: shipping,
      kind: "credit",
      note: "You paid the courier yourself, so the buyer's postage comes back to you.",
    });
  }

  lines.push({
    label: rate != null ? `Charges (${rate}%)` : "Charges",
    amount: -fee,
    kind: "deduction",
    note: "Charged once, when the buyer paid. Nothing further is deducted at payout.",
  });

  // What that fee is for. Indented under it and summing to it exactly, so the
  // statement still reads as one deduction rather than two.
  if (fee > 0) {
    const split = splitFee(fee);
    lines.push({
      label: "Payment processing",
      amount: -split.processing,
      kind: "sub",
      note: "Moving the money — FPX collection and the bank transfer out.",
    });
    lines.push({
      label: "Platform commission",
      amount: -split.platform,
      kind: "sub",
      note: "Listings, market data, courier booking and support.",
    });
  }

  // Only when there is tax to show. A zero line on every statement invites
  // "why is this here", and before registration the honest answer is that it
  // isn't charged at all.
  const sst = sstCharged(order);
  if (sst > 0) {
    lines.push({
      label: `SST (${round2(SST_RATE * 100)}%)`,
      amount: -sst,
      kind: "deduction",
      note: "Service tax on the TCGo fee, not on your sale.",
    });
  }

  lines.push({
    label: "Your payout",
    amount: payoutAmount(order),
    kind: "total",
  });

  return lines;
};

/**
 * The postage aside, for orders where TCGo bought the label.
 *
 * The seller's question is only ever "where did the shipping go", so it
 * answers that and stops. Longer versions explained things nobody asked.
 */
/**
 * Where the buyer's postage went, for an order the seller did not ship.
 *
 * Deliberately not keyed on shipmentOrderNo any more: the postage is TCGo's
 * from the moment it is paid, whether or not the label has been bought yet.
 * Waiting for the label meant the note appeared only after dispatch, leaving
 * the gap where the statement looked like it owed the seller postage.
 *
 * Says nothing about the join fee. That is TCGo's side of the ledger and
 * putting it on a seller's statement only invites "why am I being shown a
 * charge that isn't mine?".
 */
export const shippingNote = (order: SettlementOrder): string => {
  const shipping = round2(order.shipping || 0);
  if (order.selfShipped === true || shipping <= 0) return "";
  const joined = order.joinedOrderIds?.length ?? 0;
  return joined > 0
    ? `Shipping covers one parcel for ${joined + 1} orders and goes to the courier.`
    : `Shipping goes to the courier, not to your payout.`;
};

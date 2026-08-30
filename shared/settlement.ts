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

export interface SettlementOrder {
  subtotal?: number;
  shipping?: number;
  total?: number;
  platformFee?: number;
  sellerPayout?: number;
  /** Set when TCGo booked the courier label and paid for it. */
  shipmentOrderNo?: string | null;
  sellerPlan?: string;
}

export interface SettlementLine {
  label: string;
  /** Signed: positive is money in, negative is money out. */
  amount: number;
  kind: "gross" | "sub" | "deduction" | "total";
  note?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What was actually charged, not what today's rate would charge. */
export const feeCharged = (order: SettlementOrder): number =>
  recordedFee(order as any);

/** What actually reaches the bank. */
export const payoutAmount = (order: SettlementOrder): number =>
  recordedPayout(order as any);

/**
 * The rate this order was charged at, derived from the fee rather than read
 * from config — so a beta order keeps saying 2% after launch flips to 4%.
 * Null when there's no subtotal to divide by.
 */
export const rateCharged = (order: SettlementOrder): number | null => {
  const subtotal = order.subtotal || 0;
  if (subtotal <= 0) return null;
  return round2((feeCharged(order) / subtotal) * 100);
};

/**
 * Statement lines, in the order a seller reads them: what the buyer paid,
 * then each deduction, then the payout.
 *
 * Shipping appears twice on purpose — once as money the buyer handed over,
 * once as money that went straight back out to the courier. Netting them into
 * a single line is how sellers end up believing we kept their postage.
 */
export const settlementLines = (order: SettlementOrder): SettlementLine[] => {
  const subtotal = round2(order.subtotal || 0);
  const shipping = round2(order.shipping || 0);
  const fee = feeCharged(order);
  const rate = rateCharged(order);
  const platformBooked = !!order.shipmentOrderNo;

  const lines: SettlementLine[] = [
    {
      label: "Buyer paid",
      amount: round2(order.total ?? subtotal + shipping),
      kind: "gross",
    },
    { label: "Card subtotal", amount: subtotal, kind: "sub" },
  ];

  if (shipping > 0) {
    lines.push({ label: "Shipping", amount: shipping, kind: "sub" });
    lines.push({
      label: platformBooked ? "Shipping — label booked by TCGo" : "Shipping — you booked the label",
      amount: platformBooked ? -shipping : 0,
      kind: "deduction",
      note: platformBooked
        ? "We paid the courier, so the postage stays with us."
        : "You paid the courier, so the postage comes back to you.",
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

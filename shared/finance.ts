// Platform economics — what TCGo actually earns and spends.
//
// The counterpart to shared/payouts.ts: that file answers "what does the
// seller get", this one answers "what is left for us". Both are pure and
// structurally typed so the Nitro aggregation route and the admin dashboard
// compute identical figures.
//
// Two rules that shape everything here:
//
//  1. GMV is not revenue. Money collected for a card belongs to the seller;
//     our revenue is commission, retained postage and subscriptions. A
//     dashboard that leads with GMV flatters itself into bad decisions.
//
//  2. Postage is grossed up, not netted. What the buyer paid is revenue and
//     what the courier charged is a cost, on separate lines. Netting them into
//     a "margin" and ALSO listing the courier as a cost subtracts the courier
//     twice — which is exactly the bug this once had.
//
//  3. Beta is reported honestly. Commission runs at the reduced beta rate, and
//     what launch rates would have earned is shown beside it so the discount
//     is visible rather than invisible.

import { PLANS, planById, SST_RATE, type PlanId } from "~/shared/pricing";

// ── Third-party unit costs ───────────────────────────────────────────
// Billplz Basic: RM1.25 per FPX collection and per Payment Order payout.
// Both are deducted from the Billplz credit balance, not from the transfer.
export const BILLPLZ_FPX_FEE = 1.25;
export const BILLPLZ_PAYOUT_FEE = 1.25;

// Malaysian SST. The rate and the registered flag live in shared/pricing
// alongside everything else TCGo charges, so the payout maths and this
// module can't disagree about whether tax is being collected.
export { SST_RATE, SST_REGISTERED } from "~/shared/pricing";
export const SST_THRESHOLD = 500_000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (ns: number[]) => round2(ns.reduce((t, n) => t + n, 0));

export interface FinanceOrder {
  status?: string;
  paymentMethod?: string;
  paidAt?: number;
  subtotal?: number;
  /** Shipping charged to the buyer. */
  shipping?: number;
  /** Raw courier rate before our buffer — what the label actually costs us. */
  shippingQuotedRate?: number;
  /** Present only when the platform booked (and paid for) the label. */
  shipmentOrderNo?: string | null;
  /** Commission actually recorded at settlement. Zero during beta. */
  platformFee?: number;
  sellerUid?: string;
}

export interface FinancePayout {
  status?: string;
  amount?: number;
  executedAt?: number;
  autoPayoutSupported?: boolean;
}

/** Orders that represent collected money. Only these carry revenue or cost. */
export const isSettled = (o: FinanceOrder): boolean =>
  o.paymentMethod === "billplz" &&
  ["paid", "shipped", "delivered"].includes(o.status || "");

// ── Per-order economics ──────────────────────────────────────────────

/** What the courier label cost us. Zero when the seller shipped it. */
export const courierCost = (o: FinanceOrder): number =>
  o.shipmentOrderNo ? round2(o.shippingQuotedRate || 0) : 0;

/**
 * Postage collected from the buyer that we keep. Only when WE booked the
 * label — if the seller shipped it themselves the postage is reimbursed to
 * them (see shippingReimbursement in shared/payouts) and never reaches us.
 *
 * This is the GROSS amount collected, not the margin: the courier's charge is
 * a separate cost line so the Delyva spend is visible on its own. Netting it
 * here as well would subtract the courier twice.
 */
export const shippingRevenue = (o: FinanceOrder): number =>
  o.shipmentOrderNo ? round2(o.shipping || 0) : 0;

/** Kept for reporting: what's left of the postage after the courier is paid. */
export const shippingMargin = (o: FinanceOrder): number =>
  round2(shippingRevenue(o) - courierCost(o));

/** Commission actually recorded. Zero while the beta fee holiday is on. */
export const actualCommission = (o: FinanceOrder): number =>
  round2(o.platformFee || 0);

/**
 * What this order WOULD earn at launch rates, given the seller's plan. Used to
 * price the beta giveaway — never mixed into actual revenue.
 */
export const commissionAtLaunch = (
  o: FinanceOrder,
  plan: PlanId = "free",
): number => round2((o.subtotal || 0) * planById(plan).rate);

/** Billplz takes its collection fee on every settled order. */
export const orderProcessingCost = (): number => BILLPLZ_FPX_FEE;

// ── Aggregate ────────────────────────────────────────────────────────

export interface SubscriptionCounts {
  pro: number;
  vendor: number;
}

export interface FinanceSummary {
  orderCount: number;
  /** Gross merchandise value — sellers' money, NOT ours. Context only. */
  gmv: number;

  // Revenue
  commission: number;
  commissionIfCharged: number;
  /** Forgone commission: what launch rates would add over the beta rate. */
  betaGiveaway: number;
  /** Postage collected on platform-booked labels, gross of the courier bill. */
  shippingRevenue: number;
  /** Postage left after the courier is paid. Reporting only — already
   *  implied by shippingRevenue minus courierCost, never added on top. */
  shippingMargin: number;
  subscriptionRevenue: number;
  revenue: number;

  // Costs
  courierCost: number;
  billplzCollectionFees: number;
  billplzPayoutFees: number;
  costs: number;

  netProfit: number;
  /** Net as a share of revenue. Null when there's no revenue to divide by. */
  margin: number | null;

  // Money owed to sellers but not yet transferred.
  payoutsPending: number;
  payoutsPaid: number;
}

export const summariseFinance = (
  orders: FinanceOrder[],
  payouts: FinancePayout[],
  subscriptions: SubscriptionCounts = { pro: 0, vendor: 0 },
  planForSeller: (uid: string | undefined) => PlanId = () => "free",
): FinanceSummary => {
  const settled = orders.filter(isSettled);

  const gmv = sum(settled.map((o) => o.subtotal || 0));
  const commission = sum(settled.map(actualCommission));
  const commissionIfCharged = sum(
    settled.map((o) => commissionAtLaunch(o, planForSeller(o.sellerUid))),
  );
  const postage = sum(settled.map(shippingRevenue));
  const subscriptionRevenue = round2(
    subscriptions.pro * (PLANS.find((p) => p.id === "pro")?.monthly ?? 0) +
      subscriptions.vendor * (PLANS.find((p) => p.id === "vendor")?.monthly ?? 0),
  );
  const revenue = round2(commission + postage + subscriptionRevenue);

  const courier = sum(settled.map(courierCost));
  const collectionFees = round2(settled.length * BILLPLZ_FPX_FEE);
  // Only executed batches incur the Payment Order fee; queued ones haven't
  // been sent yet, and manual bank transfers don't go through Billplz at all.
  const executedPayouts = payouts.filter(
    (p) => p.executedAt && p.autoPayoutSupported !== false,
  );
  const payoutFees = round2(executedPayouts.length * BILLPLZ_PAYOUT_FEE);

  const costs = round2(courier + collectionFees + payoutFees);
  const netProfit = round2(revenue - costs);

  return {
    orderCount: settled.length,
    gmv,
    commission,
    commissionIfCharged,
    betaGiveaway: round2(commissionIfCharged - commission),
    shippingRevenue: postage,
    shippingMargin: round2(postage - courier),
    subscriptionRevenue,
    revenue,
    courierCost: courier,
    billplzCollectionFees: collectionFees,
    billplzPayoutFees: payoutFees,
    costs,
    netProfit,
    margin: revenue > 0 ? round2((netProfit / revenue) * 100) : null,
    payoutsPending: sum(
      payouts.filter((p) => p.status === "queued" || p.status === "processing")
        .map((p) => p.amount || 0),
    ),
    payoutsPaid: sum(
      payouts.filter((p) => p.status === "paid").map((p) => p.amount || 0),
    ),
  };
};

// ── Float projection ─────────────────────────────────────────────────
//
// Delyva is a prepaid wallet and Billplz runs on a credit balance: if either
// empties, labels stop printing and payouts stop going out. These project how
// much to top up, from the burn actually observed rather than a guess.

export interface TopUpProjection {
  /** Average spend per day over the observed window. */
  dailyBurn: number;
  /** Spend expected over `days` at that rate. */
  projected: number;
  /** Recommended top-up: projection plus a safety buffer, rounded up. */
  recommended: number;
  /** Days of runway left at the current balance, when one is known. */
  runwayDays: number | null;
}

export const projectTopUp = (
  spentInWindow: number,
  windowDays: number,
  forecastDays = 30,
  currentBalance: number | null = null,
  bufferPercent = 0.25,
): TopUpProjection => {
  const dailyBurn = windowDays > 0 ? round2(spentInWindow / windowDays) : 0;
  const projected = round2(dailyBurn * forecastDays);
  const needed = Math.max(0, projected * (1 + bufferPercent) - (currentBalance ?? 0));
  return {
    dailyBurn,
    projected,
    // Rounded up to the nearest RM10 — you top a wallet up in round numbers.
    recommended: Math.ceil(needed / 10) * 10,
    runwayDays:
      currentBalance !== null && dailyBurn > 0
        ? Math.floor(currentBalance / dailyBurn)
        : null,
  };
};

// ── Tax ──────────────────────────────────────────────────────────────

export interface SstPosition {
  taxableTurnover: number;
  threshold: number;
  /** Progress toward mandatory registration, 0–100 (capped). */
  percent: number;
  registrationRequired: boolean;
  /** What 8% would add to our fees, if we were registered today. */
  taxIfRegistered: number;
}

/**
 * SST applies to OUR service revenue — commission, shipping margin and
 * subscriptions — never to GMV. Registration is mandatory once taxable
 * turnover passes the threshold in any rolling 12 months.
 */
export const sstPosition = (taxableTurnover: number): SstPosition => ({
  taxableTurnover: round2(taxableTurnover),
  threshold: SST_THRESHOLD,
  percent: Math.min(100, round2((taxableTurnover / SST_THRESHOLD) * 100)),
  registrationRequired: taxableTurnover > SST_THRESHOLD,
  taxIfRegistered: round2(taxableTurnover * SST_RATE),
});

// Malaysian resident SME corporate tax bands (paid-up capital ≤ RM2.5m and
// gross income ≤ RM50m). Indicative only — a provision, not a tax return.
export const SME_TAX_BANDS = [
  { upTo: 150_000, rate: 0.15 },
  { upTo: 600_000, rate: 0.17 },
  { upTo: Infinity, rate: 0.24 },
];

export const incomeTaxProvision = (netProfit: number): number => {
  if (netProfit <= 0) return 0;
  let remaining = netProfit;
  let previousCap = 0;
  let tax = 0;
  for (const band of SME_TAX_BANDS) {
    const slice = Math.min(remaining, band.upTo - previousCap);
    if (slice <= 0) break;
    tax += slice * band.rate;
    remaining -= slice;
    previousCap = band.upTo;
  }
  return round2(tax);
};

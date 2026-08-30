// Plan definitions — the single source of truth for what TCGo charges.
//
// Both the public pricing page and the admin operations dashboard read from
// here, so the number a seller is quoted and the number we forecast revenue
// against can never drift apart.
//
// Structurally plain (no Vue imports) so Nitro can use it too.

export type PlanId = "free" | "pro" | "vendor";

export interface Plan {
  id: PlanId;
  name: string;
  /** Subscription price in MYR per month. */
  monthly: number;
  /** Commission taken on each online sale, as a fraction. */
  rate: number;
}

export const STANDARD_RATE = 0.04;
export const POS_RATE = 0.03;

export const MARKETPLACE_MONTHLY = 4.99;
export const POS_MONTHLY = 69.99;

export const PLANS: Plan[] = [
  { id: "free", name: "Free", monthly: 0, rate: STANDARD_RATE },
  { id: "pro", name: "Pro", monthly: MARKETPLACE_MONTHLY, rate: STANDARD_RATE },
  { id: "vendor", name: "Vendor", monthly: POS_MONTHLY, rate: POS_RATE },
];

export const planById = (id: string | undefined | null): Plan =>
  PLANS.find((p) => p.id === id) ?? PLANS[0]!;

// ── Beta pricing ──────────────────────────────────────────────────────
//
// During beta every seller pays a single reduced rate regardless of plan —
// half the standard 4%. A flat beta rate is deliberate: layering the Vendor
// discount on top would put the commission at 1%, below what an order costs
// us to process, and it would make "what am I paying" harder to answer during
// exactly the period we're asking people to take a chance on us.
//
// Flip BETA_PRICING to false at launch and per-plan rates take over with no
// other change.
//
// Now false: launch pricing is live. Orders settled during beta keep the 2%
// they were charged — the rate travels with the order as platformFeeRate, so
// nothing already sold is re-priced by this flag. See shared/payouts.ts.
export const BETA_PRICING = false;
export const BETA_RATE = 0.02;

// ── SST ───────────────────────────────────────────────────────────────
//
// Malaysian service tax on OUR fee — never on the sale itself. A seller's
// card is their supply, not ours; what we supply is the service, so 8% sits
// on the commission and nothing else.
//
// Off until TCGo is registered, because charging tax you are not registered
// to collect is not a rounding decision. Registration becomes mandatory once
// taxable service turnover passes RM 500,000 in any rolling 12 months —
// sstPosition() in shared/finance.ts tracks how close that is, and the admin
// dashboard shows it.
//
// Flip SST_REGISTERED once the registration number is issued and it applies
// everywhere: the payout maths, the settlement statement and the pricing
// page. Orders settled before the flip keep the tax they were charged,
// which is none, because sstAmount travels with the order the same way
// platformFeeRate does.
export const SST_RATE = 0.08;
export const SST_REGISTERED = false;

/** Service tax on a fee. Zero until registration. */
export const sstOn = (fee: number): number =>
  SST_REGISTERED ? Math.round(fee * SST_RATE * 100) / 100 : 0;

// ── How the fee reads on a statement ──────────────────────────────────
//
// One number is opaque. Split in two, a seller can see what they are paying
// for: the cost of moving the money, and the platform itself.
//
// PRESENTATION ONLY. The total charged is exactly the rate above; this
// decides how it is *described*. It is deliberately not what TCGo pays its
// payment provider — Billplz charges RM 1.25 flat per collection, not a
// percentage, so the real cost is a bigger share of a small order and a tiny
// share of a large one. The surplus on large orders is the platform's, and
// what it funds is a TCGo decision.
export const FEE_SPLIT_PROCESSING = 0.5;

/**
 * Split a fee into its two published halves.
 *
 * The halves are made to sum to the fee exactly rather than rounded
 * independently — otherwise a RM 0.05 fee shows as two lines of RM 0.03 and
 * a seller can watch the statement fail to add up.
 */
export const splitFee = (fee: number) => {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const processing = round2(fee * FEE_SPLIT_PROCESSING);
  return { processing, platform: round2(fee - processing) };
};

/** The two halves as percentages, for the pricing page. */
export const feeSplitRates = (planId: PlanId = "free") => {
  const rate = effectiveRate(planId) * 100;
  const processing = Math.round(rate * FEE_SPLIT_PROCESSING * 100) / 100;
  return {
    processing,
    platform: Math.round((rate - processing) * 100) / 100,
  };
};

/** The commission actually charged today, for a seller on `planId`. */
export const effectiveRate = (planId: PlanId = "free"): number =>
  BETA_PRICING ? BETA_RATE : planById(planId).rate;

/** Online sales a month at which Vendor's 1pp discount covers its subscription. */
export const POS_BREAKEVEN = Math.round(POS_MONTHLY / (STANDARD_RATE - POS_RATE));

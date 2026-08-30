// Plan definitions — the single source of truth for what TCGo charges.
//
// Both the public pricing page and the admin operations dashboard read from
// here, so the number a seller is quoted and the number we forecast revenue
// against can never drift apart.
//
// ONE COMMISSION RATE, EVERY PLAN
// ───────────────────────────────
// A subscription buys features. It never buys a cheaper rate.
//
// There used to be a Vendor plan at RM 69.99 that dropped commission to 3%,
// and it was wrong in two ways at once. It was never actually charged —
// `sellerPlan` is read in three places and written in none, so effectiveRate()
// fell through to the standard rate for everyone — and the arithmetic didn't
// work either: against a flat 4% plus the RM 4.99 plan, Vendor only earned
// TCGo more from sellers under ~RM 6,500 of online sales a month, which are
// exactly the sellers who would never pay RM 69.99. It made its money from
// people who wouldn't buy it.
//
// Keeping one rate also keeps the settlement statement honest. Two sellers
// looking at the same sale see the same deduction, and nobody has to be told
// why their neighbour pays less.
//
// The till has no subscription. It charges per counter sale instead — see
// POS_PLATFORM_RATE below.
//
// Structurally plain (no Vue imports) so Nitro can use it too.

export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** Subscription price in MYR per month. */
  monthly: number;
  /** Commission taken on each online sale, as a fraction. */
  rate: number;
}

export const STANDARD_RATE = 0.04;

export const MARKETPLACE_MONTHLY = 4.99;

// ── The counter ───────────────────────────────────────────────────────
//
// No subscription. The till is free to install and free to keep; TCGo takes
// a percentage of what goes through it instead, so a shop that sells nothing
// over the counter pays nothing.
//
// The shop sees one all-in number: 2.0%. That is HitPay's 1.2% for moving the
// money plus TCGo's 0.8% for the till, and it is deliberately a round figure
// because a shopkeeper reconciling a day's takings should not need a
// calculator to check it.
//
// CASH IS NOT CHARGED, and cannot be. Cash never touches a rail we can bill
// against — see server/api/pos/cash-sale.post.ts. That also means the fee is
// avoidable by a shop willing to take payment on its own DuitNow standee and
// press "Cash", which is why 0.8% is set low enough that the dodge isn't
// worth the bother. If counter volume ever starts drifting into the cash
// column, that is the number to look at first.
export const POS_PLATFORM_RATE = 0.008;

/** HitPay's own DuitNow QR rate. Not ours — shown so the 2.0% adds up. */
export const POS_PROVIDER_RATE = 0.012;

/** What the shop pays all-in on a counter QR sale, as a fraction. */
export const POS_ALL_IN_RATE = POS_PLATFORM_RATE + POS_PROVIDER_RATE;

/** TCGo's cut of one counter sale. Rounded to the sen HitPay will deduct. */
export const posPlatformFee = (total: number): number =>
  Math.round(Math.max(0, total) * POS_PLATFORM_RATE * 100) / 100;

// ── Getting paid out ──────────────────────────────────────────────────
//
// Billplz charges RM 1.25 per Payment Order. This recovers it exactly —
// not a margin, a pass-through, which is why it is the same 1.25 rather than
// a rounder number that would quietly earn.
//
// Charged per withdrawal, not per order, so it is entirely within the
// seller's control: batching a month of sales into one request costs the same
// RM 1.25 as cashing out a single card.
export const WITHDRAWAL_FEE = 1.25;

// Free scans a month before Pro is worth buying. Mirrors FREE_SCAN_LIMIT in
// composables/useScanQuota.ts, which is what actually enforces it — this copy
// exists so the pricing page can quote the number without importing a Vue
// composable into the Nitro build.
export const FREE_SCANS_MONTHLY = 20;

// Both plans commission at STANDARD_RATE. `rate` stays per-plan rather than
// being hoisted to a single constant so that if the rates ever do diverge
// again, every call site already reads the right one.
export const PLANS: Plan[] = [
  { id: "free", name: "Free", monthly: 0, rate: STANDARD_RATE },
  { id: "pro", name: "Pro", monthly: MARKETPLACE_MONTHLY, rate: STANDARD_RATE },
];

export const planById = (id: string | undefined | null): Plan =>
  PLANS.find((p) => p.id === id) ?? PLANS[0]!;

// ── Beta pricing ──────────────────────────────────────────────────────
//
// During beta every seller paid a single reduced rate — half the standard 4%.
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

/**
 * The commission actually charged today, for a seller on `planId`.
 *
 * Both live plans commission at the same rate, so the argument changes
 * nothing right now. It is kept because orders record the rate they were
 * struck at and the parameter is what a future divergence would flow through
 * — and because dropping it would silently re-price the beta orders that
 * still carry a sellerPlan-shaped field.
 */
export const effectiveRate = (planId: PlanId = "free"): number =>
  BETA_PRICING ? BETA_RATE : planById(planId).rate;

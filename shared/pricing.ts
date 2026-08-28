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

/** Online sales a month at which Vendor's 1pp discount covers its subscription. */
export const POS_BREAKEVEN = Math.round(POS_MONTHLY / (STANDARD_RATE - POS_RATE));

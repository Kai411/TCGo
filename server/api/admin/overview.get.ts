// Operations dashboard aggregate.
//
// Server-side because it reads every order, every payout and the user table —
// none of which the browser is allowed near. The maths lives in shared/finance
// so this route and any future report agree to the sen.
//
// Scale note: this reads the collections in full (capped) and aggregates in
// memory. That is the right trade at current volume — a few thousand documents
// — and the point to revisit is when the cap starts truncating, at which stage
// this should become a nightly rollup document rather than a live scan.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireAdmin } from "~/server/utils/auth";
import {
  summariseFinance,
  projectTopUp,
  sstPosition,
  incomeTaxProvision,
  isSettled,
  courierCost,
  shippingMargin,
  actualCommission,
  BILLPLZ_FPX_FEE,
  BILLPLZ_PAYOUT_FEE,
  type FinanceOrder,
  type FinancePayout,
} from "~/shared/finance";
import type { PlanId } from "~/shared/pricing";

const SCAN_LIMIT = 5000;
const DAY = 24 * 60 * 60 * 1000;

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = getAdminFirestore();
  const now = Date.now();

  const [orderSnap, payoutSnap, userSnap] = await Promise.all([
    db.collection("compiledOrders").limit(SCAN_LIMIT).get(),
    db.collection("payouts").limit(SCAN_LIMIT).get(),
    db.collection("users").limit(SCAN_LIMIT).get(),
  ]);

  const orders = orderSnap.docs.map((d) => d.data() as FinanceOrder & { paidAt?: number });
  const payouts = payoutSnap.docs.map((d) => d.data() as FinancePayout);
  const users = userSnap.docs.map((d) => d.data() as { tier?: string; plan?: string });

  // Subscriptions. `tier: premium` is the built Stripe membership (Pro).
  // Vendor has no billing behind it yet — reported as unimplemented rather
  // than as a zero that looks like "nobody subscribed".
  const proCount = users.filter((u) => u.tier === "premium").length;
  const vendorCount = users.filter((u) => u.plan === "vendor").length;

  // Nobody carries a paid seller plan yet, so every seller commissions at the
  // standard rate. Reads `plan` so this starts working the moment it's set.
  const planByUid = new Map<string, PlanId>();
  userSnap.docs.forEach((d) => {
    const plan = (d.data() as { plan?: string }).plan;
    if (plan === "vendor" || plan === "pro") planByUid.set(d.id, plan);
  });
  const planForSeller = (uid: string | undefined): PlanId =>
    (uid && planByUid.get(uid)) || "free";

  const subs = { pro: proCount, vendor: vendorCount };
  const within = (from: number) => (o: FinanceOrder & { paidAt?: number }) =>
    (o.paidAt ?? 0) >= from;
  const payoutsWithin = (from: number) => (p: FinancePayout) =>
    (p.executedAt ?? 0) >= from;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const allTime = summariseFinance(orders, payouts, subs, planForSeller);
  const last30 = summariseFinance(
    orders.filter(within(now - 30 * DAY)),
    payouts.filter(payoutsWithin(now - 30 * DAY)),
    subs,
    planForSeller,
  );
  const thisMonth = summariseFinance(
    orders.filter(within(monthStart)),
    payouts.filter(payoutsWithin(monthStart)),
    subs,
    planForSeller,
  );

  // ── Float projections ───────────────────────────────────────────────
  // Balances aren't exposed by either provider's API in a form we poll today,
  // so runway is null until an admin records one. Burn is real either way.
  const settled30 = orders.filter(isSettled).filter(within(now - 30 * DAY));
  const delyvaSpend30 = settled30.reduce((t, o) => t + courierCost(o), 0);
  const billplzSpend30 =
    settled30.length * BILLPLZ_FPX_FEE +
    payouts.filter(payoutsWithin(now - 30 * DAY)).filter((p) => p.autoPayoutSupported !== false)
      .length *
      BILLPLZ_PAYOUT_FEE;

  const float = {
    delyva: projectTopUp(delyvaSpend30, 30, 30, null),
    billplz: projectTopUp(billplzSpend30, 30, 30, null),
  };

  // ── Tax ─────────────────────────────────────────────────────────────
  // SST is levied on our service revenue over a rolling 12 months, never on
  // GMV. Income tax is provisioned off the trailing-year net.
  const rolling12 = summariseFinance(
    orders.filter(within(now - 365 * DAY)),
    payouts.filter(payoutsWithin(now - 365 * DAY)),
    // Annualise the current subscriber base rather than counting one month.
    { pro: subs.pro * 12, vendor: subs.vendor * 12 },
    planForSeller,
  );
  const tax = {
    sst: sstPosition(rolling12.revenue),
    rollingRevenue: rolling12.revenue,
    rollingNet: rolling12.netProfit,
    incomeTaxProvision: incomeTaxProvision(rolling12.netProfit),
  };

  // ── 30-day daily series (for the trend chart) ───────────────────────
  const buckets = new Map<string, { revenue: number; cost: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    buckets.set(dayKey(now - i * DAY), { revenue: 0, cost: 0, orders: 0 });
  }
  for (const o of settled30) {
    const k = dayKey(o.paidAt ?? now);
    const b = buckets.get(k);
    if (!b) continue;
    b.revenue += actualCommission(o) + shippingMargin(o);
    b.cost += courierCost(o) + BILLPLZ_FPX_FEE;
    b.orders += 1;
  }
  const series = [...buckets.entries()].map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    cost: Math.round(v.cost * 100) / 100,
    orders: v.orders,
  }));

  return {
    generatedAt: now,
    truncated: orderSnap.size >= SCAN_LIMIT,
    allTime,
    last30,
    thisMonth,
    series,
    subscriptions: {
      pro: proCount,
      vendor: vendorCount,
      // Vendor billing isn't built; the dashboard says so rather than
      // implying nobody has bought it.
      vendorImplemented: false,
    },
    float,
    tax,
    counts: {
      users: userSnap.size,
      orders: orderSnap.size,
      payoutsQueued: payouts.filter((p) => p.status === "queued").length,
    },
  };
});

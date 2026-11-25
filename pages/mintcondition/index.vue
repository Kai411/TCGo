<template>
  <div class="mc-page">
    <div v-if="!isAdmin" class="mc-card mc-card-pad">
      <p class="mc-h2">Your role doesn't include access to the dashboard.</p>
      <p class="mc-small mt-1">Ask an admin to grant it if you need it.</p>
    </div>

    <template v-else>
      <div class="mc-page-head">
        <div>
          <p class="mc-eyebrow mb-1">Money</p>
          <h1 class="mc-h1">Overview</h1>
          <p class="mc-meta mt-1">
            <span v-if="data">
              Updated {{ fmtTime(data.generatedAt) }} ·
              <span class="mc-num">{{ data.counts.users }}</span>
              {{ data.counts.users === 1 ? "account" : "accounts" }}
            </span>
            <span v-else>Platform revenue, costs and float.</span>
          </p>
        </div>
        <button :disabled="loading" class="mc-btn" @click="load">
          {{ loading ? "Loading…" : "Refresh" }}
        </button>
      </div>

      <p v-if="error" class="mc-callout mb-6" data-tone="bad">{{ error }}</p>

      <!-- Loading -->
      <div v-if="loading && !data" class="grid gap-3" aria-busy="true" aria-label="Loading">
        <div class="mc-skel h-[120px]" />
        <div class="mc-skel h-[104px]" />
        <div class="grid gap-3 lg:grid-cols-3">
          <div class="mc-skel h-[320px] lg:col-span-2" />
          <div class="mc-skel h-[320px]" />
        </div>
      </div>

      <div v-else-if="data && summary" class="grid gap-8">
        <p v-if="data.truncated" class="mc-callout">
          The scan limit was reached, so these figures cover only the most
          recent records. Time to move this to a nightly rollup.
        </p>

        <!-- 1. What needs doing. Current state, not affected by the period. -->
        <section aria-labelledby="mc-todo">
          <h2 id="mc-todo" class="mc-h2 mb-3">Needs attention</h2>
          <ul v-if="todos.length" class="mc-card mc-list">
            <li v-for="t in todos" :key="t.key" class="mc-list-row">
              <span class="mc-dot" :data-tone="t.tone" aria-hidden="true" />
              <div class="min-w-0">
                <p class="mc-list-title">{{ t.title }}</p>
                <p class="mc-small mt-0.5">{{ t.detail }}</p>
              </div>
              <NuxtLink v-if="t.to" :to="t.to" class="mc-btn mc-btn-sm">
                {{ t.action }}
              </NuxtLink>
              <span v-else />
            </li>
          </ul>
          <p v-else class="mc-card mc-small px-4 py-[18px]">
            Nothing needs you right now. No payouts are waiting and neither
            float needs a top-up.
          </p>
        </section>

        <!-- 2. Performance. Everything in here follows the period control. -->
        <section aria-labelledby="mc-perf" class="grid gap-3">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 id="mc-perf" class="mc-h2">Performance</h2>
              <p class="mc-small mt-0.5">{{ periodHint }}</p>
            </div>
            <div class="mc-seg" role="group" aria-label="Period">
              <button
                v-for="p in periods"
                :key="p.key"
                type="button"
                :aria-pressed="period === p.key"
                @click="period = p.key"
              >
                {{ p.label }}
              </button>
            </div>
          </div>

          <div class="mc-card mc-cells">
            <AdminStat
              label="Revenue"
              :value="`RM ${fmt(summary.revenue)}`"
              hint="What TCGo kept from fees"
            />
            <AdminStat
              label="Costs"
              :value="`RM ${fmt(summary.costs)}`"
              hint="Courier labels, FPX and payout fees"
            />
            <AdminStat
              label="Net profit"
              :value="money(summary.netProfit)"
              :hint="summary.margin !== null ? `${summary.margin}% margin` : 'No revenue yet'"
              :tone="summary.netProfit >= 0 ? 'good' : 'bad'"
            />
            <AdminStat
              label="Settled orders"
              :value="String(summary.orderCount)"
              :hint="summary.orderCount ? `RM ${fmt(summary.gmv / summary.orderCount)} average basket` : 'None in this period'"
            />
          </div>

          <div class="grid gap-3 lg:grid-cols-3">
            <!-- P&L: every row that feeds the totals, so the column adds up. -->
            <section class="mc-card mc-card-pad lg:col-span-2" aria-label="Profit and loss">
              <h3 class="mc-h3 text-[14px] mb-4">Profit and loss</h3>
              <dl class="grid gap-2.5">
                <AdminRow label="Commission" :value="summary.commission" />
                <AdminRow label="Postage collected" :value="summary.shippingRevenue" />
                <AdminRow
                  v-if="summary.withdrawalFeeRevenue > 0"
                  label="Withdrawal fees"
                  :value="summary.withdrawalFeeRevenue"
                />
                <AdminRow
                  v-if="summary.posRevenue > 0"
                  label="Counter fees"
                  :value="summary.posRevenue"
                />
                <AdminRow
                  label="Subscriptions"
                  :value="summary.subscriptionRevenue"
                  :note="subsNote"
                />
                <AdminRow label="Revenue" :value="summary.revenue" strong divider />
                <AdminRow
                  label="Courier labels"
                  :value="-summary.courierCost"
                  :note="`RM ${fmt(summary.shippingMargin)} left after postage`"
                />
                <AdminRow label="FPX collection fees" :value="-summary.billplzCollectionFees" />
                <AdminRow label="Payout fees" :value="-summary.billplzPayoutFees" />
                <AdminRow label="Costs" :value="-summary.costs" strong divider />
                <AdminRow label="Net profit" :value="summary.netProfit" strong divider highlight />
              </dl>
            </section>

            <!-- Sellers' money: moved through TCGo, never ours. -->
            <section class="mc-card mc-card-pad flex flex-col" aria-label="Sellers' money">
              <h3 class="mc-h3 text-[14px]">Sellers' money</h3>
              <p class="mc-small mt-1">Passes through TCGo. Not revenue.</p>
              <dl class="grid gap-2.5 mt-4">
                <AdminRow label="Online sales (GMV)" :value="summary.gmv" />
                <AdminRow
                  v-if="summary.posSaleCount > 0"
                  label="Counter sales"
                  :value="summary.posVolume"
                  :note="`${summary.posSaleCount} ${summary.posSaleCount === 1 ? 'sale' : 'sales'}`"
                />
                <AdminRow label="Paid out" :value="summary.payoutsPaid" />
              </dl>

              <div v-if="summary.betaGiveaway > 0" class="mc-divider pt-4 mt-4">
                <p class="mc-label">Beta discount</p>
                <p class="mc-num mt-1 text-[15px] font-semibold">
                  RM {{ fmt(summary.betaGiveaway) }}
                  <span class="mc-small font-normal">not charged</span>
                </p>
                <p class="mc-small mt-1.5">
                  Commission ran at the beta rate of {{ pct(BETA_RATE) }}. At
                  {{ pct(STANDARD_RATE) }} the same orders would have earned
                  RM {{ fmt(summary.commissionIfCharged) }}.
                </p>
              </div>

              <div class="mc-divider pt-4 mt-auto flex items-center justify-between gap-3">
                <p class="mc-small">
                  Commission is {{ pct(STANDARD_RATE) }} on every plan.
                </p>
                <NuxtLink to="/pricing" class="mc-btn mc-btn-sm shrink-0">Pricing</NuxtLink>
              </div>
            </section>
          </div>
        </section>

        <!-- 3. Balances. Current state, not affected by the period. -->
        <section aria-labelledby="mc-bal" class="grid gap-3">
          <div>
            <h2 id="mc-bal" class="mc-h2">Balances</h2>
            <p class="mc-small mt-0.5">Right now. Burn is measured over the last 30 days.</p>
          </div>
          <div class="mc-card mc-cells" data-cols="2">
            <AdminStat
              label="Owed to sellers"
              :value="`RM ${fmt(owed)}`"
              :hint="data.counts.payoutsQueued
                ? `${data.counts.payoutsQueued} ${data.counts.payoutsQueued === 1 ? 'batch' : 'batches'} waiting to be sent`
                : 'No batches waiting'"
              :tone="data.counts.payoutsQueued > 0 ? 'warn' : undefined"
            />
            <AdminStat
              label="Recurring revenue"
              :value="`RM ${fmt(mrr)} / mo`"
              :hint="`${data.subscriptions.pro} Pro ${data.subscriptions.pro === 1 ? 'seller' : 'sellers'} at RM ${fmt(MARKETPLACE_MONTHLY)}`"
            />
          </div>
          <div class="grid gap-3 lg:grid-cols-2">
            <AdminFloat
              name="Delyva wallet"
              purpose="Courier labels are bought from a prepaid wallet. If it empties, waybills stop printing."
              :projection="data.float.delyva"
            />
            <AdminFloat
              name="Billplz credit"
              purpose="FPX and payout fees are deducted from the credit balance. If it empties, payouts stop."
              :projection="data.float.billplz"
            />
          </div>
        </section>

        <!-- 4. Tax. Rolling 12 months, not affected by the period. -->
        <section aria-labelledby="mc-tax" class="mc-card mc-card-pad">
          <h2 id="mc-tax" class="mc-h2">Tax position</h2>
          <p class="mc-small mt-1">
            Rolling 12 months. Indicative: a provision, not a return.
          </p>

          <div class="mt-5 grid gap-6 lg:grid-cols-2">
            <div class="min-w-0">
              <div class="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                <span class="mc-h3">SST registration</span>
                <span class="mc-meta mc-num">
                  RM {{ fmt(data.tax.sst.taxableTurnover) }} of RM {{ fmt(data.tax.sst.threshold) }}
                </span>
              </div>
              <div
                class="mc-meter"
                :data-tone="data.tax.sst.registrationRequired ? 'bad' : undefined"
                role="meter"
                aria-label="SST threshold used"
                :aria-valuenow="data.tax.sst.percent"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span :style="{ width: `${Math.max(1, data.tax.sst.percent)}%` }" />
              </div>
              <p class="mc-small mt-2">
                {{ data.tax.sst.percent }}% of the threshold. Service tax applies
                to our fees, never to GMV. At {{ pct(SST_RATE) }} today that would be
                RM {{ fmt(data.tax.sst.taxIfRegistered) }}.
              </p>
            </div>

            <div class="min-w-0">
              <p class="mc-h3 mb-2">Income tax provision</p>
              <p class="text-[22px] font-[650] leading-tight mc-num">
                RM {{ fmt(data.tax.incomeTaxProvision) }}
              </p>
              <p class="mc-small mt-2">
                On {{ money(data.tax.rollingNet) }} trailing-year net, at resident
                SME rates (15% to RM150k, 17% to RM600k, 24% above). Confirm with
                your accountant before relying on it.
              </p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { MARKETPLACE_MONTHLY, BETA_RATE, STANDARD_RATE, SST_RATE } from "~/shared/pricing";
import type { FinanceSummary, TopUpProjection, SstPosition } from "~/shared/finance";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Operations — TCGo Admin" });

interface Overview {
  generatedAt: number;
  truncated: boolean;
  allTime: FinanceSummary;
  last30: FinanceSummary;
  thisMonth: FinanceSummary;
  series: { date: string; revenue: number; cost: number; orders: number }[];
  subscriptions: { pro: number };
  float: { delyva: TopUpProjection; billplz: TopUpProjection };
  tax: {
    sst: SstPosition;
    rollingRevenue: number;
    rollingNet: number;
    incomeTaxProvision: number;
  };
  counts: { users: number; orders: number; payoutsQueued: number };
}

const { me, can } = useStaffAuth();
const isAdmin = computed(() => can("finance.view"));
const { mcFetch } = useMcFetch();

const data = ref<Overview | null>(null);
const loading = ref(false);
const error = ref("");

type PeriodKey = "thisMonth" | "last30" | "allTime";
const periods: { key: PeriodKey; label: string }[] = [
  { key: "thisMonth", label: "This month" },
  { key: "last30", label: "30 days" },
  { key: "allTime", label: "All time" },
];
const period = ref<PeriodKey>("last30");
const periodHint = computed(() =>
  period.value === "thisMonth"
    ? "Since the 1st of this month."
    : period.value === "last30"
      ? "The last 30 days."
      : "Since launch.",
);

const summary = computed<FinanceSummary | null>(() =>
  data.value ? data.value[period.value] : null,
);

const mrr = computed(() =>
  data.value ? data.value.subscriptions.pro * MARKETPLACE_MONTHLY : 0,
);

// Money owed is a current balance. The period summaries filter payouts by
// executedAt, which a queued batch doesn't have yet, so they would hide
// exactly the batches still waiting. Read it from the unfiltered set.
const owed = computed(() => data.value?.allTime.payoutsPending ?? 0);

// SST: warn from here so registration is planned, not discovered.
const SST_WARN_PERCENT = 80;

interface Todo {
  key: string;
  tone: "warn" | "bad";
  title: string;
  detail: string;
  to?: string;
  action?: string;
}

// The short list an admin acts on. Each item is current state, so none of
// them move with the period control.
const todos = computed<Todo[]>(() => {
  const d = data.value;
  if (!d) return [];
  const out: Todo[] = [];
  const sst = d.tax.sst;
  if (sst.registrationRequired) {
    out.push({
      key: "sst",
      tone: "bad",
      title: "Register for SST",
      detail: `Taxable turnover passed RM ${fmt(sst.threshold)}. Registration is required within 30 days.`,
    });
  }
  const queued = d.counts.payoutsQueued;
  if (queued > 0) {
    out.push({
      key: "payouts",
      tone: "warn",
      title: `Send ${queued} payout ${queued === 1 ? "batch" : "batches"}`,
      detail: `RM ${fmt(owed.value)} owed to sellers.`,
      to: "/mintcondition/payouts",
      action: "Payout queue",
    });
  }
  const floats = [
    { key: "delyva", name: "Delyva wallet", p: d.float.delyva },
    { key: "billplz", name: "Billplz credit", p: d.float.billplz },
  ];
  for (const f of floats) {
    if (f.p.recommended <= 0) continue;
    out.push({
      key: f.key,
      tone: "warn",
      title: `Top up the ${f.name} by RM ${fmt(f.p.recommended)}`,
      detail: `Covers the next 30 days at RM ${fmt(f.p.dailyBurn)} a day, plus a buffer.`,
    });
  }
  if (!sst.registrationRequired && sst.percent >= SST_WARN_PERCENT) {
    out.push({
      key: "sst-near",
      tone: "warn",
      title: "SST threshold getting close",
      detail: `${sst.percent}% of RM ${fmt(sst.threshold)} used over the last 12 months.`,
    });
  }
  return out;
});

// Subscription revenue is a monthly run-rate, not a figure earned inside the
// selected window — say so rather than letting it read as period revenue.
const subsNote = computed(() =>
  summary.value && summary.value.subscriptionRevenue > 0
    ? "monthly run-rate"
    : undefined,
);

const load = async () => {
  if (!isAdmin.value) return;
  loading.value = true;
  error.value = "";
  try {
    data.value = await mcFetch<Overview>("/api/admin/overview");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load the dashboard.";
  } finally {
    loading.value = false;
  }
};

// Keyed on the staff session, not the Firebase user: a staff-only account
// never signs into Firebase, so watching `user` would leave this page
// permanently loading for exactly the people it's built for.
watch(() => me.value?.permissions, load, { immediate: true });

const fmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => `${n < 0 ? "−" : ""}RM ${fmt(Math.abs(n))}`;
const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
</script>


<template>
  <div class="max-w-6xl mx-auto">
    <div v-if="!isAdmin" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Access denied.</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 class="text-2xl font-bold text-ink dark:text-white">Operations</h1>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mt-0.5">
            <span v-if="data">
              Updated {{ fmtTime(data.generatedAt) }} · {{ data.counts.orders }} orders,
              {{ data.counts.users }} users
            </span>
            <span v-else>Platform revenue, costs and float.</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-0.5">
            <button
              v-for="p in periods"
              :key="p.key"
              class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
              :class="
                period === p.key
                  ? 'bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm'
                  : 'text-ink-muted dark:text-zinc-400'
              "
              @click="period = p.key"
            >
              {{ p.label }}
            </button>
          </div>
          <button
            :disabled="loading"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-black/[0.08] dark:border-white/[0.12] text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white disabled:opacity-50 transition-colors"
            @click="load"
          >
            {{ loading ? "Loading…" : "Refresh" }}
          </button>
        </div>
      </div>

      <div
        v-if="error"
        class="mb-6 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
      >
        {{ error }}
      </div>

      <div v-if="loading && !data" class="flex justify-center py-20">
        <div
          class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <template v-else-if="data && summary">
        <div
          v-if="data.truncated"
          class="mb-6 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
        >
          The scan limit was reached — these figures cover only the most recent
          records. Time to move this to a nightly rollup.
        </div>

        <!-- Headline -->
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <AdminStat
            label="Revenue"
            :value="`RM${fmt(summary.revenue)}`"
            :hint="`Commission, shipping margin and subscriptions`"
            tone="default"
          />
          <AdminStat
            label="Costs"
            :value="`RM${fmt(summary.costs)}`"
            hint="Courier labels, FPX and payout fees"
            tone="default"
          />
          <AdminStat
            label="Net profit"
            :value="`RM${fmt(summary.netProfit)}`"
            :hint="summary.margin !== null ? `${summary.margin}% margin` : 'No revenue yet'"
            :tone="summary.netProfit >= 0 ? 'good' : 'bad'"
          />
          <AdminStat
            label="GMV"
            :value="`RM${fmt(summary.gmv)}`"
            :hint="`${summary.orderCount} settled orders — sellers' money, not ours`"
            tone="muted"
          />
        </div>

        <!-- Beta giveaway -->
        <div
          v-if="summary.betaGiveaway > 0"
          class="mb-6 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5"
        >
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink dark:text-white">
                The beta discount cost RM{{ fmt(summary.betaGiveaway) }} this period
              </p>
              <p class="text-xs text-ink-muted dark:text-zinc-400 mt-1 max-w-xl leading-relaxed">
                Commission runs at the reduced beta rate of
                {{ (BETA_RATE * 100).toFixed(0) }}%, earning
                RM{{ fmt(summary.commission) }}. The same orders at launch rates
                would have earned RM{{ fmt(summary.commissionIfCharged) }}.
              </p>
            </div>
            <NuxtLink
              to="/pricing"
              class="shrink-0 text-xs font-semibold text-pokemon-red hover:underline"
            >
              Pricing →
            </NuxtLink>
          </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-3 mb-3">
          <!-- P&L -->
          <div
            class="lg:col-span-2 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5"
          >
            <h2 class="text-sm font-semibold text-ink dark:text-white mb-4">
              Profit &amp; loss — {{ periodLabel }}
            </h2>
            <dl class="space-y-2.5 text-sm">
              <AdminRow label="Commission" :value="summary.commission" />
              <AdminRow label="Postage collected" :value="summary.shippingRevenue" />
              <AdminRow
                label="Subscriptions"
                :value="summary.subscriptionRevenue"
                :note="subsNote"
              />
              <AdminRow label="Revenue" :value="summary.revenue" strong divider />
              <AdminRow
                label="Courier labels"
                :value="-summary.courierCost"
                :note="`RM${fmt(summary.shippingMargin)} left after postage`"
              />
              <AdminRow label="FPX collection fees" :value="-summary.billplzCollectionFees" />
              <AdminRow label="Payout fees" :value="-summary.billplzPayoutFees" />
              <AdminRow label="Costs" :value="-summary.costs" strong divider />
              <AdminRow label="Net profit" :value="summary.netProfit" strong divider highlight />
            </dl>
          </div>

          <!-- Subscriptions -->
          <div
            class="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5"
          >
            <h2 class="text-sm font-semibold text-ink dark:text-white mb-4">
              Subscriptions
            </h2>
            <div class="space-y-4">
              <div>
                <div class="flex items-baseline justify-between gap-3">
                  <span class="text-sm text-ink dark:text-zinc-200">Pro</span>
                  <span class="text-lg font-bold tabular-nums text-ink dark:text-white">{{
                    data.subscriptions.pro
                  }}</span>
                </div>
                <p class="text-xs text-ink-soft dark:text-zinc-500 mt-0.5">
                  RM{{ fmt(data.subscriptions.pro * MARKETPLACE_MONTHLY) }} / month
                </p>
              </div>
              <div>
                <div class="flex items-baseline justify-between gap-3">
                  <span class="text-sm text-ink dark:text-zinc-200">Vendor</span>
                  <span class="text-lg font-bold tabular-nums text-ink dark:text-white">{{
                    data.subscriptions.vendor
                  }}</span>
                </div>
                <p
                  v-if="!data.subscriptions.vendorImplemented"
                  class="text-xs text-amber-600 dark:text-amber-400 mt-0.5"
                >
                  Billing not built yet — this will read 0 regardless.
                </p>
              </div>
              <div class="pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                <p class="text-xs text-ink-soft dark:text-zinc-500">Recurring revenue</p>
                <p class="text-xl font-bold tabular-nums text-ink dark:text-white mt-0.5">
                  RM{{ fmt(mrr) }}<span class="text-xs font-medium text-ink-soft"> / mo</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Float -->
        <div class="grid gap-3 lg:grid-cols-2 mb-3">
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

        <!-- Tax -->
        <div
          class="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 mb-3"
        >
          <h2 class="text-sm font-semibold text-ink dark:text-white">Tax position</h2>
          <p class="text-xs text-ink-muted dark:text-zinc-400 mt-1">
            Rolling 12 months. Indicative — a provision, not a return.
          </p>

          <div class="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <div class="flex items-baseline justify-between gap-3 mb-2">
                <span class="text-sm font-medium text-ink dark:text-zinc-200"
                  >SST registration</span
                >
                <span class="text-xs tabular-nums text-ink-muted dark:text-zinc-400">
                  RM{{ fmt(data.tax.sst.taxableTurnover) }} / RM{{
                    fmt(data.tax.sst.threshold)
                  }}
                </span>
              </div>
              <div class="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="data.tax.sst.registrationRequired ? 'bg-red-500' : 'bg-emerald-500'"
                  :style="{ width: `${Math.max(1, data.tax.sst.percent)}%` }"
                />
              </div>
              <p class="text-xs mt-2 leading-relaxed" :class="data.tax.sst.registrationRequired ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-ink-muted dark:text-zinc-400'">
                <template v-if="data.tax.sst.registrationRequired">
                  Threshold passed — registration is required within 30 days.
                </template>
                <template v-else>
                  {{ data.tax.sst.percent }}% of the threshold. Service tax applies
                  to our fees, never to GMV. At 8% today that would be
                  RM{{ fmt(data.tax.sst.taxIfRegistered) }}.
                </template>
              </p>
            </div>

            <div>
              <p class="text-sm font-medium text-ink dark:text-zinc-200 mb-2">
                Income tax provision
              </p>
              <p class="text-2xl font-bold tabular-nums text-ink dark:text-white">
                RM{{ fmt(data.tax.incomeTaxProvision) }}
              </p>
              <p class="text-xs text-ink-muted dark:text-zinc-400 mt-1.5 leading-relaxed">
                On RM{{ fmt(data.tax.rollingNet) }} trailing-year net, at resident
                SME rates (15% to RM150k, 17% to RM600k, 24% above). Confirm with
                your accountant before relying on it.
              </p>
            </div>
          </div>
        </div>

        <!-- Money owed -->
        <div class="grid gap-3 sm:grid-cols-3">
          <AdminStat
            label="Owed to sellers"
            :value="`RM${fmt(summary.payoutsPending)}`"
            :hint="`${data.counts.payoutsQueued} batch(es) awaiting execution`"
            :tone="data.counts.payoutsQueued > 0 ? 'warn' : 'muted'"
          />
          <AdminStat
            label="Paid out"
            :value="`RM${fmt(summary.payoutsPaid)}`"
            hint="Transferred to sellers"
            tone="muted"
          />
          <NuxtLink
            to="/mintcondition/payouts"
            class="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 flex items-center justify-between gap-3 hover:border-black/20 dark:hover:border-white/25 transition-colors"
          >
            <div>
              <p class="text-sm font-semibold text-ink dark:text-white">Payout queue</p>
              <p class="text-xs text-ink-muted dark:text-zinc-400 mt-0.5">
                Review and execute
              </p>
            </div>
            <span class="text-ink-soft dark:text-zinc-500" aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { MARKETPLACE_MONTHLY, POS_MONTHLY, BETA_RATE } from "~/shared/pricing";
import type { FinanceSummary, TopUpProjection, SstPosition } from "~/shared/finance";

definePageMeta({ layout: "admin" });
useHead({ title: "Operations — TCGo Admin" });

interface Overview {
  generatedAt: number;
  truncated: boolean;
  allTime: FinanceSummary;
  last30: FinanceSummary;
  thisMonth: FinanceSummary;
  series: { date: string; revenue: number; cost: number; orders: number }[];
  subscriptions: { pro: number; vendor: number; vendorImplemented: boolean };
  float: { delyva: TopUpProjection; billplz: TopUpProjection };
  tax: {
    sst: SstPosition;
    rollingRevenue: number;
    rollingNet: number;
    incomeTaxProvision: number;
  };
  counts: { users: number; orders: number; payoutsQueued: number };
}

const { isAdmin } = useAdmin();
const { user } = useAuth();
const { authedFetch } = useAuthedFetch();

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
const periodLabel = computed(
  () => periods.find((p) => p.key === period.value)?.label ?? "",
);

const summary = computed<FinanceSummary | null>(() =>
  data.value ? data.value[period.value] : null,
);

const mrr = computed(() =>
  data.value
    ? data.value.subscriptions.pro * MARKETPLACE_MONTHLY +
      data.value.subscriptions.vendor * POS_MONTHLY
    : 0,
);

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
    data.value = await authedFetch<Overview>("/api/admin/overview");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load the dashboard.";
  } finally {
    loading.value = false;
  }
};

// isAdmin depends on the auth listener, so wait for the user before loading.
watch(user, load, { immediate: true });

const fmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
</script>

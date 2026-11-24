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
              <span class="mc-num">{{ data.counts.orders }}</span> orders,
              <span class="mc-num">{{ data.counts.users }}</span> users
            </span>
            <span v-else>Platform revenue, costs and float.</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
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
          <button :disabled="loading" class="mc-btn" @click="load">
            {{ loading ? "Loading…" : "Refresh" }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mc-callout mb-6" data-tone="bad">{{ error }}</p>

      <!-- Loading -->
      <div v-if="loading && !data" class="grid gap-3" aria-busy="true" aria-label="Loading">
        <div class="mc-skel h-[104px]" />
        <div class="grid gap-3 lg:grid-cols-3">
          <div class="mc-skel h-[320px] lg:col-span-2" />
          <div class="mc-skel h-[320px]" />
        </div>
      </div>

      <div v-else-if="data && summary" class="grid gap-6">
        <p v-if="data.truncated" class="mc-callout">
          The scan limit was reached, so these figures cover only the most
          recent records. Time to move this to a nightly rollup.
        </p>

        <!-- Headline -->
        <section class="mc-card mc-cells" aria-label="Headline figures">
          <AdminStat
            label="Revenue"
            :value="`RM ${fmt(summary.revenue)}`"
            hint="Commission, postage and subscriptions"
          />
          <AdminStat
            label="Costs"
            :value="`RM ${fmt(summary.costs)}`"
            hint="Courier labels, FPX and payout fees"
          />
          <AdminStat
            label="Net profit"
            :value="`${summary.netProfit < 0 ? '−' : ''}RM ${fmt(Math.abs(summary.netProfit))}`"
            :hint="summary.margin !== null ? `${summary.margin}% margin` : 'No revenue yet'"
            :tone="summary.netProfit >= 0 ? 'good' : 'bad'"
          />
          <AdminStat
            label="GMV"
            :value="`RM ${fmt(summary.gmv)}`"
            :hint="`${summary.orderCount} settled orders. Sellers' money, not ours`"
            muted
          />
        </section>

        <!-- Money owed -->
        <section>
          <div class="flex items-baseline justify-between gap-3 mb-3">
            <h2 class="mc-h2">Seller payouts</h2>
            <NuxtLink to="/mintcondition/payouts" class="mc-btn mc-btn-sm">
              Open payout queue
            </NuxtLink>
          </div>
          <div class="mc-card mc-cells" data-cols="3">
            <AdminStat
              label="Owed to sellers"
              :value="`RM ${fmt(summary.payoutsPending)}`"
              :hint="`${data.counts.payoutsQueued} ${data.counts.payoutsQueued === 1 ? 'batch' : 'batches'} awaiting execution`"
              :tone="data.counts.payoutsQueued > 0 ? 'warn' : undefined"
            />
            <AdminStat
              label="Paid out"
              :value="`RM ${fmt(summary.payoutsPaid)}`"
              hint="Transferred to sellers"
            />
            <AdminStat
              label="Recurring revenue"
              :value="`RM ${fmt(mrr)}`"
              :hint="`${data.subscriptions.pro} Pro ${data.subscriptions.pro === 1 ? 'seller' : 'sellers'} at RM ${fmt(MARKETPLACE_MONTHLY)} a month`"
            />
          </div>
        </section>

        <div class="grid gap-3 lg:grid-cols-3">
          <!-- P&L -->
          <section
            class="mc-card mc-card-pad"
            :class="summary.betaGiveaway > 0 ? 'lg:col-span-2' : 'lg:col-span-3'"
          >
            <h2 class="mc-h2 mb-4">Profit and loss, {{ periodLabel.toLowerCase() }}</h2>
            <dl class="grid gap-2.5">
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
                :note="`RM ${fmt(summary.shippingMargin)} left after postage`"
              />
              <AdminRow label="FPX collection fees" :value="-summary.billplzCollectionFees" />
              <AdminRow label="Payout fees" :value="-summary.billplzPayoutFees" />
              <AdminRow label="Costs" :value="-summary.costs" strong divider />
              <AdminRow label="Net profit" :value="summary.netProfit" strong divider highlight />
            </dl>
          </section>

          <!-- Beta discount + plan note -->
          <section v-if="summary.betaGiveaway > 0" class="mc-card mc-card-pad flex flex-col gap-4">
            <div>
              <h2 class="mc-h2">Beta discount</h2>
              <p class="mc-small mt-1">This period</p>
            </div>
            <p class="text-[22px] font-[650] leading-tight mc-num">
              RM {{ fmt(summary.betaGiveaway) }}
              <span class="mc-small font-normal">not charged</span>
            </p>
            <p class="mc-meta leading-relaxed">
              Commission runs at the beta rate of
              {{ (BETA_RATE * 100).toFixed(0) }}%, earning
              RM {{ fmt(summary.commission) }}. At launch rates the same orders
              would have earned RM {{ fmt(summary.commissionIfCharged) }}.
            </p>
            <div class="mc-divider pt-4 mt-auto flex items-center justify-between gap-3">
              <p class="mc-small">Pro is the only paid plan. Commission is 4% on every plan.</p>
              <NuxtLink to="/pricing" class="mc-btn mc-btn-sm shrink-0">Pricing</NuxtLink>
            </div>
          </section>
        </div>

        <!-- Float -->
        <section>
          <h2 class="mc-h2 mb-3">Float</h2>
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

        <!-- Tax -->
        <section class="mc-card mc-card-pad">
          <h2 class="mc-h2">Tax position</h2>
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
              <p
                v-if="data.tax.sst.registrationRequired"
                class="mc-callout mt-3"
                data-tone="bad"
              >
                Threshold passed. Registration is required within 30 days.
              </p>
              <p v-else class="mc-small mt-2">
                {{ data.tax.sst.percent }}% of the threshold. Service tax applies
                to our fees, never to GMV. At 8% today that would be
                RM {{ fmt(data.tax.sst.taxIfRegistered) }}.
              </p>
            </div>

            <div class="min-w-0">
              <p class="mc-h3 mb-2">Income tax provision</p>
              <p class="text-[22px] font-[650] leading-tight mc-num">
                RM {{ fmt(data.tax.incomeTaxProvision) }}
              </p>
              <p class="mc-small mt-2">
                On RM {{ fmt(data.tax.rollingNet) }} trailing-year net, at resident
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
import { MARKETPLACE_MONTHLY, BETA_RATE } from "~/shared/pricing";
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
const periodLabel = computed(
  () => periods.find((p) => p.key === period.value)?.label ?? "",
);

const summary = computed<FinanceSummary | null>(() =>
  data.value ? data.value[period.value] : null,
);

const mrr = computed(() =>
  data.value ? data.value.subscriptions.pro * MARKETPLACE_MONTHLY : 0,
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
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
</script>

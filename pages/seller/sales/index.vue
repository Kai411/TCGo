<template>
  <div class="sl-page">
    <SellerGate v-if="!user" message="Sign in to see your sales." />

    <template v-else>
      <SellerPageHead title="Sales">
        <template #description>
          Money you've taken, at the counter and online. Shipping and tracking
          live in <NuxtLink to="/seller/orders" class="underline underline-offset-2">Orders</NuxtLink>.
        </template>
        <NuxtLink to="/seller/pos" class="mc-btn mc-btn-primary">Open POS</NuxtLink>
      </SellerPageHead>

      <div v-if="loading" class="flex flex-col gap-4" aria-busy="true" aria-label="Loading sales">
        <div class="mc-skel h-[96px]" />
        <div class="mc-skel h-[220px]" />
      </div>

      <p v-else-if="error" class="mc-callout" data-tone="bad">{{ error }}</p>

      <div v-else-if="!data?.periods.allTime.saleCount" class="mc-card mc-empty flex items-center justify-between gap-3">
        <span>
          <span class="font-semibold text-[var(--ink-2)]">No sales yet.</span>
          Counter sales and completed marketplace orders both show here, with
          what each card actually went for.
        </span>
      </div>

      <template v-else>
        <!-- Period picker: each cell is a filter for everything below it. -->
        <div class="mc-card mc-cells" style="--cols: 4" role="group" aria-label="Period">
          <button
            v-for="p in periodCards"
            :key="p.key"
            type="button"
            class="mc-cell-btn"
            :aria-pressed="period === p.key"
            @click="period = p.key"
          >
            <span class="mc-label block">{{ p.label }}</span>
            <span class="mc-stat-value mc-num mt-1 block">{{ myr(p.totals.total) }}</span>
            <span class="mc-small mt-1 block">
              {{ p.totals.saleCount }} {{ p.totals.saleCount === 1 ? "sale" : "sales" }} ·
              {{ p.totals.itemCount }} {{ p.totals.itemCount === 1 ? "card" : "cards" }}
            </span>
          </button>
        </div>

        <!-- Detail for the chosen period. -->
        <div class="mc-card mc-cells mt-3" data-cols="3">
          <AdminStat label="Average sale" :value="myr(selected.averageSale)" />
          <AdminStat
            label="Label price total"
            :value="myr(selected.subtotal)"
            :hint="`sold for ${myr(selected.total)}`"
          />
          <AdminStat
            label="Discount given"
            :value="myr(selected.discountTotal)"
            :tone="selected.discountTotal > 0 ? 'warn' : undefined"
            :hint="`${selected.discountedLines} of ${selected.itemCount} cards below label`"
          />
        </div>

        <!-- Trend for the chosen period: days for the short ones, months for
             all time. Today is the period's own bar, so it is the red one. -->
        <section v-if="chart.points.length" class="mc-card mc-card-pad mt-3">
          <div class="flex items-baseline justify-between gap-3 mb-4">
            <h2 class="mc-h3">{{ chart.title }}</h2>
            <span class="mc-small">Paid sales, both channels</span>
          </div>
          <SalesBarChart :points="chart.points" :hot="chart.hot" :label-every="chart.labelEvery" />
        </section>

        <div
          v-if="data.byMethod.length || data.topCards.length > 1"
          class="grid grid-cols-1 lg:grid-cols-2 gap-3 mc-section"
        >
          <section v-if="data.byMethod.length" class="mc-card mc-card-pad">
            <h2 class="mc-h3 mb-3">How they paid</h2>
            <div class="flex flex-col gap-2.5">
              <div
                v-for="m in data.byMethod"
                :key="m.method"
                class="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3"
              >
                <span class="mc-label truncate">{{ m.label }}</span>
                <div class="mc-meter">
                  <span class="ss-bar" :style="{ width: methodPct(m.total) }" />
                </div>
                <span class="mc-num text-[13px] text-right">
                  {{ myr(m.total) }}
                  <span class="mc-small">· {{ m.count }}</span>
                </span>
              </div>
            </div>
          </section>

          <section v-if="data.topCards.length > 1" class="mc-card">
            <h2 class="mc-h3 mc-card-pad !pb-2">Sells fastest</h2>
            <div v-for="c in data.topCards" :key="c.cardName" class="mc-row !py-2">
              <img v-if="c.image" :src="c.image" alt="" class="mc-thumb" />
              <span v-else class="mc-thumb" aria-hidden="true" />
              <span class="mc-row-title !text-[13.5px]">{{ c.cardName }}</span>
              <span class="mc-num text-[13px]">
                <span class="mc-small">×{{ c.count }}</span> {{ myr(c.total) }}
              </span>
            </div>
          </section>
        </div>

        <section class="mc-section">
          <div class="mc-section-head">
            <h2 class="mc-h2">All sales</h2>
            <div class="flex items-center gap-2">
              <select v-model="channel" class="mc-select" aria-label="Channel">
                <option value="all">Both channels</option>
                <option value="in_person">In person</option>
                <option value="online">Online</option>
              </select>
              <!-- Status is filtered server-side (refetch); channel is local. -->
              <select v-model="status" class="mc-select" aria-label="Status" @change="load()">
                <option value="all">Any status</option>
                <option value="paid">Paid</option>
                <option value="awaiting_payment">Awaiting payment</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div class="mc-card overflow-hidden">
            <p v-if="!visibleSales.length" class="mc-empty">Nothing matches that filter.</p>
            <NuxtLink
              v-for="s in visibleSales"
              v-else
              :key="s.id"
              :to="s.channel === 'online' && s.orderId ? `/orders/${s.orderId}` : `/seller/sales/${s.id}`"
              class="mc-row"
            >
              <div class="flex -space-x-3 shrink-0">
                <img
                  v-for="(l, i) in s.lines.slice(0, 3)"
                  :key="i"
                  :src="l.image || FALLBACK"
                  alt=""
                  class="mc-thumb ss-stack"
                />
              </div>
              <div class="min-w-0">
                <p class="mc-row-title">{{ saleTitle(s) }}</p>
                <p class="mc-meta truncate">
                  {{ s.channel === "online" ? "Online" : "In person" }} ·
                  {{ s.lines.length }} {{ s.lines.length === 1 ? "card" : "cards" }} ·
                  {{ METHOD_LABELS[s.method] ?? s.method }} ·
                  {{ when(s.paidAt ?? s.createdAt) }}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="mc-num text-[14px] font-semibold">{{ myr(s.total) }}</p>
                <p v-if="s.status !== 'paid'" class="mc-small flex items-center justify-end gap-1.5 mt-0.5">
                  <span class="mc-dot ss-dot" :data-tone="statusTone(s.status)" aria-hidden="true" />
                  {{ STATUS_LABELS[s.status] ?? s.status }}
                </p>
                <p v-if="s.discountTotal > 0" class="mc-small mc-num mt-0.5">
                  {{ myr(s.discountTotal) }} off label
                </p>
              </div>
            </NuxtLink>
          </div>
          <p v-if="data.truncated" class="mc-small mt-3 text-center">
            Showing your most recent sales. Older ones aren't listed here yet.
          </p>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { METHOD_LABELS, STATUS_LABELS } from "~/shared/sales-summary";
import type { SalesPoint, SalesTotals } from "~/shared/sales-summary";

definePageMeta({ layout: "seller" });
useHead({ title: "Counter sales | TCGo" });

const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='48'%3E%3C/svg%3E";

const { user } = useAuth();
const { authedFetch } = useAuthedFetch();

const data = ref<any>(null);
const loading = ref(true);
const error = ref("");
const status = ref("all");
const channel = ref<"all" | "in_person" | "online">("all");
const period = ref<"today" | "last7" | "last30" | "allTime">("last7");

const load = async () => {
  if (!user.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    data.value = await authedFetch(`/api/pos/sales?status=${status.value}`);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load your sales.";
  } finally {
    loading.value = false;
  }
};
watch(user, load, { immediate: true });

// Filtered client-side: the channel split is a view of the page already
// loaded, and round-tripping for it would blank the list on every toggle.
const visibleSales = computed(() =>
  !data.value
    ? []
    : channel.value === "all"
      ? data.value.sales
      : data.value.sales.filter((s: any) => s.channel === channel.value),
);

const periodCards = computed(() =>
  !data.value
    ? []
    : ([
        { key: "today", label: "Today" },
        { key: "last7", label: "7 days" },
        { key: "last30", label: "30 days" },
        { key: "allTime", label: "All time" },
      ] as const).map((p) => ({ ...p, totals: data.value.periods[p.key] as SalesTotals })),
);

const selected = computed<SalesTotals>(
  () => data.value?.periods[period.value] ?? ({} as SalesTotals),
);

// Chart for the chosen period. Older API responses have no series; the
// section then simply doesn't render.
const chart = computed(() => {
  const daily: SalesPoint[] = data.value?.daily ?? [];
  const monthly: SalesPoint[] = data.value?.monthly ?? [];
  const day = (p: SalesPoint, fmt: Intl.DateTimeFormatOptions) => ({
    value: p.total,
    count: p.count,
    label: new Date(p.start).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" }),
    short: new Date(p.start).toLocaleDateString("en-MY", fmt),
  });
  if (period.value === "allTime") {
    return {
      title: "Last 12 months",
      points: monthly.map((p) => ({
        value: p.total,
        count: p.count,
        label: new Date(p.start).toLocaleDateString("en-MY", { month: "long", year: "numeric" }),
        short: new Date(p.start).toLocaleDateString("en-MY", { month: "short" }),
      })),
      hot: null,
      labelEvery: 2,
    };
  }
  if (period.value === "last30") {
    return {
      title: "Last 30 days",
      points: daily.map((p) => day(p, { day: "numeric" })),
      hot: null,
      labelEvery: 5,
    };
  }
  const week = daily.slice(-7);
  return {
    title: "Last 7 days",
    points: week.map((p) => day(p, { weekday: "short" })),
    hot: period.value === "today" ? week.length - 1 : null,
    labelEvery: 1,
  };
});

const myr = (n: number) =>
  `RM ${(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Bars are relative to the biggest method, not to the total — with one method
// a share-of-total bar would always read 100% and say nothing.
const methodPct = (total: number) => {
  const max = Math.max(...(data.value?.byMethod ?? []).map((m: any) => m.total), 0);
  return max > 0 ? `${Math.max(4, (total / max) * 100)}%` : "0%";
};

const saleTitle = (s: any) => {
  const first = s.lines[0]?.cardName ?? "Sale";
  return s.lines.length > 1 ? `${first} + ${s.lines.length - 1} more` : first;
};

const when = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
  // Today's sales are the ones being reconciled right now, so they get the
  // time; anything older gets the date, which is what you'd search by.
  return d.getTime() >= today.getTime()
    ? time
    : `${d.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}, ${time}`;
};

const statusTone = (s: string) =>
  s === "awaiting_payment" ? "warn" : s === "failed" ? "bad" : undefined;
</script>

<style>
.ss-bar {
  background: var(--ink-2) !important;
}
.ss-stack {
  outline: 2px solid var(--surface);
}
.ss-dot {
  width: 6px;
  height: 6px;
  box-shadow: none;
}
</style>

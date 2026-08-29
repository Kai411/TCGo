<template>
  <div class="space-y-7">
    <!-- ── Needs attention ─────────────────────────────────────────────
         Actionable queues come first: the dashboard's job is to tell a
         seller what to do next, not to lead with a vanity number. -->
    <section data-tour="dashboard-attention">
      <p class="eyebrow mb-2.5">Needs attention</p>
      <div class="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          v-for="tile in actionTiles"
          :key="tile.key"
          type="button"
          @click="$emit('select', tile.key)"
          class="group text-left rounded-2xl border p-3 sm:p-4 transition-all"
          :class="
            tile.count > 0
              ? `${tile.tone} hover:shadow-card`
              : 'border-black/[0.06] dark:border-white/[0.08] bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
          "
        >
          <component
            :is="tile.icon"
            class="w-4 h-4 mb-2"
            :class="tile.count > 0 ? tile.iconClass : 'text-ink-soft dark:text-zinc-600'"
          />
          <p
            class="text-2xl sm:text-3xl font-bold tabular-price leading-none"
            :class="tile.count > 0 ? 'text-ink dark:text-white' : 'text-ink-soft dark:text-zinc-600'"
          >
            {{ tile.count }}
          </p>
          <p class="mt-1 text-[11px] font-medium text-ink-muted dark:text-zinc-400 leading-tight">
            {{ tile.label }}
          </p>
        </button>
      </div>
    </section>

    <!-- ── Revenue + trend ─────────────────────────────────────────── -->
    <section data-tour="dashboard-sales" class="surface rounded-2xl p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="eyebrow">Completed sales</p>
          <p class="mt-2 text-3xl sm:text-4xl font-bold text-ink dark:text-white tabular-price leading-none tracking-tightest">
            RM {{ formatMyr(salesValue) }}
          </p>
          <p
            v-if="momDelta !== null"
            class="mt-2 text-xs font-semibold inline-flex items-center gap-1"
            :class="momDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                :d="momDelta >= 0 ? 'M6 9.5V2.5M6 2.5L3 5.5M6 2.5l3 3' : 'M6 2.5v7M6 9.5l-3-3M6 9.5l3-3'"
                stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
              />
            </svg>
            {{ Math.abs(momDelta) }}%
            <span class="font-normal text-ink-soft dark:text-zinc-500">vs last month</span>
          </p>
          <p v-else-if="pipelineValue > 0" class="mt-2 text-xs text-ink-soft dark:text-zinc-500">
            RM {{ formatMyr(pipelineValue) }} still in the pipeline
          </p>
        </div>

        <!-- Secondary figures: supporting, not competing with the headline -->
        <dl class="flex gap-5 sm:gap-7">
          <div>
            <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Items sold</dt>
            <dd class="mt-1 text-lg font-bold text-ink dark:text-white tabular-price">{{ itemsSold }}</dd>
          </div>
          <div>
            <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Avg order</dt>
            <dd class="mt-1 text-lg font-bold text-ink dark:text-white tabular-price">RM {{ formatMyr(avgOrder) }}</dd>
          </div>
          <div>
            <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Orders</dt>
            <dd class="mt-1 text-lg font-bold text-ink dark:text-white tabular-price">
              {{ completedCount }}
              <span v-if="posCount > 0" class="block text-[10px] font-normal text-ink-soft dark:text-zinc-500">
                incl. {{ posCount }} in-person
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Chart. One series, so no legend — the heading names it. -->
      <div class="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-semibold text-ink dark:text-white">Sales — last 8 weeks</p>
        </div>

        <div v-if="chartMax === 0" class="py-8 text-center text-xs text-ink-soft dark:text-zinc-500">
          No completed sales yet — your weekly trend will appear here.
        </div>

        <div v-else class="relative pl-12">
          <!-- Recessive gridlines + y-axis ticks -->
          <div class="absolute inset-y-0 left-0 right-0 pointer-events-none" aria-hidden="true">
            <div
              v-for="(tick, i) in yTicks"
              :key="i"
              class="absolute left-0 right-0 flex items-center gap-2"
              :style="{ bottom: `${(tick / axisMax) * 100}%` }"
            >
              <span class="w-10 shrink-0 text-right text-[9px] tabular-price text-ink-soft dark:text-zinc-600">
                {{ shortMyr(tick) }}
              </span>
              <span class="flex-1 border-t border-dashed border-black/[0.07] dark:border-white/[0.07]" />
            </div>
          </div>

          <!-- Bars -->
          <div class="relative flex items-end gap-2 h-32">
            <div
              v-for="(b, i) in weeklyBuckets"
              :key="i"
              class="relative flex-1 h-full flex items-end justify-center"
              @mouseenter="hovered = i"
              @mouseleave="hovered = null"
              @focusin="hovered = i"
              @focusout="hovered = null"
            >
              <button
                type="button"
                class="w-full max-w-[30px] rounded-t-[4px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-red/40"
                :class="b.value > 0 ? 'bg-pokemon-red' : 'bg-black/[0.06] dark:bg-white/[0.08]'"
                :style="{ height: barHeight(b.value) }"
                :aria-label="`${b.label}: RM ${formatMyr(b.value)}`"
              />

              <!-- Selective direct label: only the peak week, never every bar -->
              <span
                v-if="b.value > 0 && b.value === chartMax && hovered === null"
                class="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-price text-ink dark:text-white pointer-events-none"
                :style="{ bottom: `calc(${barHeight(b.value)} + 6px)` }"
              >
                {{ shortMyr(b.value) }}
              </span>

              <!-- Hover tooltip -->
              <div
                v-if="hovered === i"
                class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg bg-ink dark:bg-white px-2.5 py-1.5 shadow-card-hover pointer-events-none"
              >
                <p class="text-[10px] font-semibold text-white dark:text-ink">{{ b.label }}</p>
                <p class="text-[11px] font-bold text-white dark:text-ink tabular-price">
                  RM {{ formatMyr(b.value) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Baseline + x labels -->
          <div class="border-t border-black/[0.10] dark:border-white/[0.12]" />
          <div class="flex gap-2 mt-1.5">
            <span
              v-for="(b, i) in weeklyBuckets"
              :key="i"
              class="flex-1 text-center text-[9px] tabular-price"
              :class="hovered === i ? 'text-ink dark:text-white font-semibold' : 'text-ink-soft dark:text-zinc-600'"
            >
              {{ b.short }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Funds ───────────────────────────────────────────────────── -->
    <NuxtLink
      to="/seller/funds"
      class="flex items-center gap-4 rounded-2xl surface p-4 hover:shadow-card-hover transition-shadow"
    >
      <div class="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
        <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-zinc-400">Funds</p>
        <p class="text-lg font-bold text-ink dark:text-white tabular-price leading-tight">
          RM {{ formatMyr(fundsAvailable) }}
          <span class="text-xs font-semibold text-ink-soft dark:text-zinc-500">available</span>
        </p>
        <p v-if="fundsHeld > 0" class="text-[11px] text-ink-soft dark:text-zinc-500">
          + RM {{ formatMyr(fundsHeld) }} pending / locked
        </p>
      </div>
      <svg class="w-4 h-4 shrink-0 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </NuxtLink>

    <!-- ── Recent sales ────────────────────────────────────────────── -->
    <section>
      <div class="flex items-center justify-between mb-2.5">
        <p class="eyebrow">Recent sales</p>
        <button
          v-if="orders.length"
          @click="$emit('select', 'all')"
          class="text-[11px] font-semibold text-pokemon-red hover:underline inline-flex items-center gap-0.5"
        >
          View all
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <p v-if="!recentSales.length" class="text-sm text-ink-soft dark:text-zinc-500 py-3">
        No sales yet.
      </p>
      <div v-else class="surface rounded-2xl divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden">
        <component
          :is="sale.href ? 'NuxtLink' : 'div'"
          v-for="sale in recentSales"
          :key="sale.id"
          :to="sale.href || undefined"
          class="flex items-center gap-3 px-3 py-2.5"
          :class="sale.href ? 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors' : ''"
        >
          <div class="w-9 h-9 shrink-0 rounded-lg overflow-hidden">
            <CardImage :src="sale.image" :alt="sale.name" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink dark:text-white truncate">{{ sale.name }}</p>
            <p class="text-[11px] text-ink-muted dark:text-zinc-400">
              {{ sale.itemsCount }} {{ sale.itemsCount === 1 ? "item" : "items" }} · RM {{ formatMyr(sale.value) }}
            </p>
          </div>
          <span
            class="shrink-0 chip"
            :class="sale.source === 'pos'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              : statusColor('delivered')"
          >
            {{ sale.source === "pos" ? "In-person" : "Delivered" }}
          </span>
        </component>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";
import {
  type CompiledOrder,
  type CompiledOrderStatus,
  compiledOrderStatusColor,
} from "~/composables/useCompiledOrders";
import type { InventoryItem } from "~/composables/useInventory";
import { categorizeFunds } from "~/composables/useSellerFunds";
import { isAwaitingShipment } from "~/composables/useSellerOrders";

const props = withDefaults(
  defineProps<{
    orders: CompiledOrder[];
    // Count of mergeable groups (2+ paid unshipped orders, same buyer + address).
    mergeableCount: number;
    // Direct (POS / manual) inventory sales — folded into the sales stats.
    posSales?: InventoryItem[];
  }>(),
  { posSales: () => [] },
);

defineEmits<{
  (e: "select", queue: string): void;
}>();

const statusColor = (s: CompiledOrderStatus) => compiledOrderStatusColor(s);
const byStatus = (s: CompiledOrderStatus) => props.orders.filter((o) => o.status === s);
const deliveredOrders = computed(() => byStatus("delivered"));

// ── Icons (inline SVG, not emoji — these sit in a seller's daily tool) ──
const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};
const IconBox = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
    h("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
    h("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" }),
  ]);
const IconClock = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("circle", { cx: "12", cy: "12", r: "9" }),
    h("polyline", { points: "12 7 12 12 15.5 14" }),
  ]);
// Two branches converging into one stem — the shape of merging orders, arrow
// pointing right so it reads along the row rather than down out of the tile.
// Transposed from the vertical form (x/y swapped, so both arc sweep flags
// flip) rather than wrapped in a rotate() — keeps the geometry inspectable.
const IconMerge = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 5h5a3 3 0 0 1 2.5 1.4L14 12" }),
    h("path", { d: "M3 19h5a3 3 0 0 0 2.5-1.4L14 12" }),
    h("path", { d: "M14 12h7" }),
    h("path", { d: "m18 9 3 3-3 3" }),
  ]);

// ── Action tiles ──────────────────────────────────────────────────────
// Keys match OrderQueue in useSellerOrders so the parent can deep-link
// straight into the Orders page without a translation table.
const actionTiles = computed(() => [
  {
    key: "toship",
    label: "To ship",
    icon: IconBox,
    count: props.orders.filter(isAwaitingShipment).length,
    tone: "border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/[0.07]",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "awaiting",
    label: "Awaiting payment",
    icon: IconClock,
    count: byStatus("pending").length,
    tone: "border-black/[0.08] dark:border-white/[0.10] bg-black/[0.02] dark:bg-white/[0.04]",
    iconClass: "text-ink-muted dark:text-zinc-400",
  },
  {
    key: "mergeable",
    label: "Mergeable",
    icon: IconMerge,
    count: props.mergeableCount,
    tone: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/[0.07]",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
]);

// ── Unified completed sales (online delivered orders + direct/POS sales) ──
interface SaleEntry {
  id: string;
  name: string;
  itemsCount: number;
  value: number;
  ts: number;
  image: string;
  source: "online" | "pos";
  href: string | null;
}
const unifiedSales = computed<SaleEntry[]>(() => {
  const online: SaleEntry[] = deliveredOrders.value.map((o) => ({
    id: o.id,
    name: o.buyerName,
    itemsCount: o.items.length,
    value: o.subtotal,
    ts: o.deliveredAt ?? o.createdAt,
    image: o.items[0]?.imageUrl ?? "",
    source: "online",
    href: `/orders/${o.id}`,
  }));
  const pos: SaleEntry[] = (props.posSales ?? []).map((i) => ({
    id: i.id,
    name: i.cardName,
    itemsCount: 1,
    value: i.soldPrice ?? i.listPrice ?? 0,
    ts: i.soldAt ?? i.updatedAt ?? 0,
    image: i.primaryImage ?? "",
    source: "pos",
    href: null,
  }));
  return [...online, ...pos];
});

const salesValue = computed(() => unifiedSales.value.reduce((s, e) => s + e.value, 0));
const itemsSold = computed(() => unifiedSales.value.reduce((s, e) => s + e.itemsCount, 0));
const completedCount = computed(() => unifiedSales.value.length);
const posCount = computed(() => (props.posSales ?? []).length);
const avgOrder = computed(() =>
  completedCount.value ? salesValue.value / completedCount.value : 0,
);

// Value sitting in the pipeline (paid/confirmed/shipped, not yet delivered).
const pipelineValue = computed(() =>
  props.orders
    .filter((o) => isAwaitingShipment(o) || o.status === "shipped")
    .reduce((s, o) => s + o.subtotal, 0),
);

// Month-over-month momentum on completed-sale value, keyed by sale timestamp.
const momDelta = computed<number | null>(() => {
  const now = new Date();
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  let thisVal = 0;
  let lastVal = 0;
  for (const e of unifiedSales.value) {
    if (e.ts >= thisStart) thisVal += e.value;
    else if (e.ts >= lastStart && e.ts < thisStart) lastVal += e.value;
  }
  if (lastVal <= 0) return null;
  return Math.round(((thisVal - lastVal) / lastVal) * 100);
});

// ── Weekly trend (completed sale value, last 8 weeks) ─────────────────
interface Bucket {
  value: number;
  label: string;
  short: string;
}
const weeklyBuckets = computed<Bucket[]>(() => {
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const buckets: Bucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = now - i * WEEK;
    const d = new Date(end);
    buckets.push({
      value: 0,
      label: `Week of ${d.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`,
      short: d.toLocaleDateString("en-MY", { day: "numeric", month: "numeric" }),
    });
  }
  for (const e of unifiedSales.value) {
    const weeksAgo = Math.floor((now - e.ts) / WEEK);
    if (weeksAgo >= 0 && weeksAgo < 8) buckets[7 - weeksAgo]!.value += e.value;
  }
  return buckets;
});

const chartMax = computed(() =>
  weeklyBuckets.value.reduce((m, b) => Math.max(m, b.value), 0),
);

/** Round the axis up to a clean number so gridlines land on readable values. */
const axisMax = computed(() => {
  const m = chartMax.value;
  if (m <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(m));
  return Math.ceil(m / mag) * mag;
});
const yTicks = computed(() => [0, axisMax.value / 2, axisMax.value]);

const hovered = ref<number | null>(null);

const barHeight = (value: number) => {
  if (chartMax.value === 0 || value === 0) return "2px";
  // Floor at 4% so a small non-zero week is still visibly a bar, not a line.
  return `${Math.max(4, (value / axisMax.value) * 100)}%`;
};

// ── Recent sales (online + in-person, newest first) ──────────────────
const recentSales = computed(() =>
  [...unifiedSales.value].sort((a, b) => b.ts - a.ts).slice(0, 5),
);

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact form for axis ticks and the peak label — "1.2k" beats "1,200.00". */
const shortMyr = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
};

// ── Funds summary (online/Billplz payments held by the platform) ──────
const fundEntries = computed(() => categorizeFunds(props.orders));
const fundsAvailable = computed(() =>
  fundEntries.value.filter((e) => e.state === "available").reduce((t, e) => t + e.amount, 0),
);
const fundsHeld = computed(() =>
  fundEntries.value
    .filter((e) => e.state === "locked" || e.state === "queued")
    .reduce((t, e) => t + e.amount, 0),
);
</script>

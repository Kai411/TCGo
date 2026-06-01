<template>
  <div class="space-y-6">
    <!-- ── Needs attention ─────────────────────────────────────────── -->
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
        Needs attention
      </p>
      <div class="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          v-for="tile in actionTiles"
          :key="tile.key"
          @click="$emit('select', tile.key)"
          class="text-left rounded-xl border p-3 transition-colors"
          :class="
            tile.count > 0
              ? tile.activeClass
              : 'border-gray-200 dark:border-white/[0.08] bg-transparent'
          "
        >
          <div class="flex items-center gap-1.5">
            <span class="text-lg" v-html="tile.icon" />
          </div>
          <p
            class="text-2xl font-extrabold tabular-nums mt-1"
            :class="tile.count > 0 ? tile.numClass : 'text-gray-400 dark:text-zinc-600'"
          >
            {{ tile.count }}
          </p>
          <p class="text-[11px] font-medium text-gray-500 dark:text-zinc-400 leading-tight">
            {{ tile.label }}
          </p>
        </button>
      </div>

      <!-- Status overview (neutral, still tappable) -->
      <div class="grid grid-cols-3 gap-2 sm:gap-3 mt-2">
        <button
          v-for="tile in statusTiles"
          :key="tile.key"
          @click="$emit('select', tile.key)"
          class="text-left rounded-xl border border-gray-200 dark:border-white/[0.08] px-3 py-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
        >
          <span class="text-base font-bold tabular-nums text-ink dark:text-white">{{ tile.count }}</span>
          <span class="ml-1.5 text-[11px] text-gray-500 dark:text-zinc-400">{{ tile.label }}</span>
        </button>
      </div>
    </div>

    <!-- ── Performance metrics ─────────────────────────────────────── -->
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
        Performance · completed sales
      </p>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3">
          <p class="text-[11px] text-gray-500 dark:text-zinc-400">Sales value</p>
          <p class="text-lg font-extrabold text-ink dark:text-white tabular-nums mt-0.5">
            {{ formatMyr(salesValue) }}
            <span class="text-xs font-semibold text-gray-400">MYR</span>
          </p>
          <p v-if="momDelta !== null" class="text-[11px] font-semibold mt-0.5" :class="momDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">
            {{ momDelta >= 0 ? "▲" : "▼" }} {{ Math.abs(momDelta) }}% vs last month
          </p>
          <p v-else-if="pipelineValue > 0" class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
            +{{ formatMyr(pipelineValue) }} in pipeline
          </p>
        </div>

        <div class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3">
          <p class="text-[11px] text-gray-500 dark:text-zinc-400">Items sold</p>
          <p class="text-lg font-extrabold text-ink dark:text-white tabular-nums mt-0.5">{{ itemsSold }}</p>
        </div>

        <div class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3">
          <p class="text-[11px] text-gray-500 dark:text-zinc-400">Avg order</p>
          <p class="text-lg font-extrabold text-ink dark:text-white tabular-nums mt-0.5">
            {{ formatMyr(avgOrder) }}
            <span class="text-xs font-semibold text-gray-400">MYR</span>
          </p>
        </div>

        <div class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3">
          <p class="text-[11px] text-gray-500 dark:text-zinc-400">Completed</p>
          <p class="text-lg font-extrabold text-ink dark:text-white tabular-nums mt-0.5">{{ completedCount }}</p>
          <p v-if="posCount > 0" class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">incl. {{ posCount }} in-person</p>
        </div>
      </div>
    </div>

    <!-- ── Weekly sales trend ──────────────────────────────────────── -->
    <div class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-4">
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm font-semibold text-ink dark:text-white">Sales — last 8 weeks</p>
        <p v-if="chartMax > 0" class="text-[11px] text-gray-400 dark:text-zinc-500">
          peak {{ formatMyr(chartMax) }} MYR
        </p>
      </div>
      <div v-if="chartMax === 0" class="py-6 text-center text-xs text-gray-400 dark:text-zinc-500">
        No completed sales yet — your weekly trend will appear here.
      </div>
      <div v-else class="flex items-end gap-1.5 h-24">
        <div
          v-for="(b, i) in weeklyBuckets"
          :key="i"
          class="flex-1 flex flex-col items-center justify-end h-full group"
          :title="`${b.label}: ${formatMyr(b.value)} MYR`"
        >
          <div
            class="w-full rounded-t transition-colors"
            :class="b.value > 0 ? 'bg-pokemon-red/80 group-hover:bg-pokemon-red' : 'bg-gray-200 dark:bg-white/[0.06]'"
            :style="{ height: barHeight(b.value) }"
          />
          <span class="text-[9px] text-gray-400 dark:text-zinc-600 mt-1 tabular-nums">{{ b.short }}</span>
        </div>
      </div>
    </div>

    <!-- ── Recent sales ────────────────────────────────────────────── -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          Recent sales
        </p>
        <button
          v-if="orders.length"
          @click="$emit('select', 'all')"
          class="text-[11px] font-semibold text-pokemon-red hover:underline inline-flex items-center gap-0.5"
        >
          View all
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <p v-if="!recentSales.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
        No sales yet.
      </p>
      <div v-else class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06]">
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
            <p class="text-[11px] text-gray-500 dark:text-zinc-400">
              {{ sale.itemsCount }} {{ sale.itemsCount === 1 ? "item" : "items" }} · {{ formatMyr(sale.value) }} MYR
            </p>
          </div>
          <span
            class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            :class="sale.source === 'pos' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : statusColor('delivered')"
          >
            {{ sale.source === "pos" ? "In-person" : "Delivered" }}
          </span>
        </component>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  type CompiledOrder,
  type CompiledOrderStatus,
  compiledOrderStatusLabel,
  compiledOrderStatusColor,
} from "~/composables/useCompiledOrders";
import type { InventoryItem } from "~/composables/useInventory";

const props = withDefaults(
  defineProps<{
    orders: CompiledOrder[];
    // Count of mergeable groups (buyers with 2+ confirmed unshipped orders).
    mergeableCount: number;
    // Direct (POS / manual) inventory sales — folded into the sales stats.
    posSales?: InventoryItem[];
  }>(),
  { posSales: () => [] },
);

defineEmits<{
  (e: "select", filter: string): void;
}>();

const statusLabel = (s: CompiledOrderStatus) => compiledOrderStatusLabel(s);
const statusColor = (s: CompiledOrderStatus) => compiledOrderStatusColor(s);

const byStatus = (s: CompiledOrderStatus) =>
  props.orders.filter((o) => o.status === s);

const deliveredOrders = computed(() => byStatus("delivered"));

// ── Action tiles ──────────────────────────────────────────────────────
const actionTiles = computed(() => [
  {
    key: "pending",
    label: "Pending",
    icon: "⏳",
    count: byStatus("pending").length,
    activeClass: "border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/[0.07]",
    numClass: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "toship",
    label: "To ship",
    icon: "📦",
    count: byStatus("confirmed").length + byStatus("paid").length,
    activeClass: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-500/[0.07]",
    numClass: "text-indigo-700 dark:text-indigo-300",
  },
  {
    key: "mergeable",
    label: "Mergeable",
    icon: "🔗",
    count: props.mergeableCount,
    activeClass: "border-amber-400 dark:border-amber-500/50 bg-amber-100/70 dark:bg-amber-500/[0.10]",
    numClass: "text-amber-700 dark:text-amber-300",
  },
]);

const statusTiles = computed(() => [
  { key: "shipped", label: "Shipped", count: byStatus("shipped").length },
  { key: "delivered", label: "Delivered", count: deliveredOrders.value.length },
  { key: "cancelled", label: "Cancelled", count: byStatus("cancelled").length },
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

// Value sitting in the pipeline (confirmed/paid/shipped, not yet delivered).
const pipelineValue = computed(() =>
  props.orders
    .filter((o) => o.status === "confirmed" || o.status === "paid" || o.status === "shipped")
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

// ── Weekly trend (delivered subtotal, last 8 weeks by deliveredAt) ────
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
    const start = end - WEEK;
    const d = new Date(end);
    buckets.push({
      value: 0,
      label: `Week of ${d.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`,
      short: d.toLocaleDateString("en-MY", { day: "numeric", month: "numeric" }),
    });
  }
  for (const e of unifiedSales.value) {
    const weeksAgo = Math.floor((now - e.ts) / WEEK);
    if (weeksAgo >= 0 && weeksAgo < 8) {
      buckets[7 - weeksAgo].value += e.value;
    }
  }
  return buckets;
});
const chartMax = computed(() =>
  weeklyBuckets.value.reduce((m, b) => Math.max(m, b.value), 0),
);
const barHeight = (value: number) => {
  if (chartMax.value === 0) return "2px";
  if (value === 0) return "2px";
  return `${Math.max(6, (value / chartMax.value) * 100)}%`;
};

// ── Recent sales (online + in-person, newest first) ──────────────────
const recentSales = computed(() =>
  [...unifiedSales.value].sort((a, b) => b.ts - a.ts).slice(0, 5),
);

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

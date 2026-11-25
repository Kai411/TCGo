<template>
  <div class="sd">
    <!-- ── Needs attention ─────────────────────────────────────────────
         Actionable queues come first: the dashboard's job is to tell a
         seller what to do next, not to lead with a vanity number. -->
    <section data-tour="dashboard-attention">
      <h2 class="mc-h2 sd-section-title">Needs attention</h2>
      <div class="mc-card mc-cells" :style="{ '--cols': actionTiles.length }">
        <button
          v-for="tile in actionTiles"
          :key="tile.key"
          type="button"
          class="sd-tile"
          @click="$emit('select', tile.key)"
        >
          <span class="mc-label flex items-center gap-2">
            <component :is="tile.icon" class="w-4 h-4 shrink-0" />
            <span class="min-w-0 truncate">{{ tile.label }}</span>
          </span>
          <span class="mc-stat-value mc-num mt-1 block" :class="tile.count ? '' : 'mc-ink-3'">
            {{ tile.count }}
          </span>
          <span class="mc-small mt-1.5 flex items-center gap-2">
            <span v-if="tile.count" class="mc-dot" :data-tone="tile.tone" aria-hidden="true" />
            {{ tile.count ? "Open the queue" : "Nothing waiting" }}
          </span>
        </button>
      </div>
    </section>

    <!-- Other seller-home cards slot in here: after the work queue, before
         the money. See pages/seller/index.vue. -->
    <slot name="after-attention" />

    <!-- ── Revenue + trend ─────────────────────────────────────────── -->
    <section data-tour="dashboard-sales" class="mc-card">
      <div class="mc-card-pad">
        <p class="mc-label">Completed sales</p>
        <p class="mc-hero-value mc-num mt-1">RM {{ formatMyr(salesValue) }}</p>
        <p v-if="momDelta !== null" class="mc-small mt-1.5 flex items-center gap-2">
          <span class="mc-dot" :data-tone="momDelta >= 0 ? 'good' : 'bad'" aria-hidden="true" />
          <span>
            <span class="mc-num font-semibold text-[var(--ink-2)]">
              {{ momDelta >= 0 ? "Up" : "Down" }} {{ Math.abs(momDelta) }}%
            </span>
            vs last month
          </span>
        </p>
        <p v-else-if="pipelineValue > 0" class="mc-small mt-1.5">
          RM {{ formatMyr(pipelineValue) }} still in the pipeline
        </p>
      </div>

      <!-- Secondary figures: supporting, not competing with the headline -->
      <div
        class="mc-divider mc-cells"
        :data-cols="counterDiscount.total > 0 ? undefined : 3"
        :style="{ '--cols': counterDiscount.total > 0 ? 4 : 3 }"
      >
        <AdminStat label="Items sold" :value="String(itemsSold)" />
        <AdminStat label="Avg order" :value="`RM ${formatMyr(avgOrder)}`" />
        <AdminStat
          label="Orders"
          :value="String(completedCount)"
          :hint="posCount > 0 ? `incl. ${posCount} in-person` : undefined"
        />
        <!-- Haggling at the counter is invisible in revenue alone: a card
             sold at RM 80 off list still books as a sale. This is the
             margin actually given away. -->
        <AdminStat
          v-if="counterDiscount.total > 0"
          label="Discounts"
          :value="`RM ${formatMyr(counterDiscount.total)}`"
          :hint="`on ${counterDiscount.count} ${counterDiscount.count === 1 ? 'item' : 'items'}`"
          tone="warn"
        />
      </div>

      <!-- Chart. One series, so no legend — the heading names it. -->
      <div class="mc-divider mc-card-pad">
        <h3 class="mc-h3 mb-4">Sales, last 8 weeks</h3>

        <p v-if="chartMax === 0" class="mc-small py-6 text-center">
          No completed sales yet. Your weekly trend will appear here.
        </p>

        <div v-else class="relative pl-12">
          <!-- Bars -->
          <div class="relative flex items-end gap-2 h-32">
          <!-- Recessive gridlines + y-axis ticks -->
          <div class="absolute inset-y-0 -left-12 right-0 pointer-events-none" aria-hidden="true">
            <div
              v-for="(tick, i) in yTicks"
              :key="i"
              class="absolute left-0 right-0 flex items-center gap-2"
              :style="{ bottom: `${(tick / axisMax) * 100}%` }"
            >
              <span class="sd-axis w-10 shrink-0 text-right">{{ shortMyr(tick) }}</span>
              <span class="sd-grid flex-1" />
            </div>
          </div>

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
                class="sd-bar"
                :class="{ 'is-empty': b.value === 0, 'is-hot': hovered === i }"
                :style="{ height: barHeight(b.value) }"
                :aria-label="`${b.label}: RM ${formatMyr(b.value)}`"
              />

              <!-- Selective direct label: only the peak week, never every bar -->
              <span
                v-if="b.value > 0 && b.value === chartMax && hovered === null"
                class="sd-peak absolute left-1/2 -translate-x-1/2 pointer-events-none"
                :style="{ bottom: `calc(${barHeight(b.value)} + 6px)` }"
              >
                {{ shortMyr(b.value) }}
              </span>

              <!-- Hover tooltip -->
              <div
                v-if="hovered === i"
                class="sd-tip absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
              >
                <p class="mc-small">{{ b.label }}</p>
                <p class="mc-num text-[13px] font-semibold">RM {{ formatMyr(b.value) }}</p>
              </div>
            </div>
          </div>

          <!-- Baseline + x labels -->
          <div class="sd-baseline" />
          <div class="flex gap-2 mt-1.5">
            <span
              v-for="(b, i) in weeklyBuckets"
              :key="i"
              class="sd-axis flex-1 min-w-0 text-center"
              :class="{ 'is-hot': hovered === i, 'is-alt': (weeklyBuckets.length - 1 - i) % 2 === 1 }"
            >
              {{ b.short }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Funds ───────────────────────────────────────────────────── -->
    <NuxtLink to="/seller/funds" class="mc-card sd-link-row">
      <span class="sd-icon-box" aria-hidden="true">
        <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </span>
      <span class="min-w-0">
        <span class="mc-label block">Funds</span>
        <span class="block mc-num text-[17px] font-semibold leading-tight mt-0.5">
          RM {{ formatMyr(fundsAvailable) }}
          <span class="mc-small font-normal">available</span>
        </span>
        <span v-if="fundsHeld > 0" class="mc-small block mt-0.5">
          + RM {{ formatMyr(fundsHeld) }} pending or locked
        </span>
      </span>
      <svg class="w-4 h-4 mc-ink-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
    </NuxtLink>

    <!-- ── Recent sales ────────────────────────────────────────────── -->
    <section>
      <div class="sd-section-head">
        <h2 class="mc-h2">Recent sales</h2>
        <div class="flex items-center gap-1">
          <!-- Two destinations because this list mixes two things: counter
               sales have their own page with receipts, marketplace orders
               live in the order queue. One "View all" could only ever be
               right for half the rows. -->
          <NuxtLink v-if="posCount" to="/seller/sales" class="mc-btn mc-btn-ghost mc-btn-sm">
            Counter sales
          </NuxtLink>
          <button
            v-if="orders.length"
            type="button"
            class="mc-btn mc-btn-ghost mc-btn-sm"
            @click="$emit('select', 'all')"
          >
            Orders
          </button>
        </div>
      </div>
      <div class="mc-card overflow-hidden">
        <p v-if="!recentSales.length" class="sd-empty">No sales yet.</p>
        <component
          :is="sale.href ? 'NuxtLink' : 'div'"
          v-for="sale in recentSales"
          v-else
          :key="sale.id"
          :to="sale.href || undefined"
          class="sd-row"
          :class="{ 'is-link': sale.href }"
        >
          <div class="sd-thumb">
            <CardImage :src="sale.image" :alt="sale.name" />
          </div>
          <div class="min-w-0">
            <p class="sd-row-title truncate">{{ sale.name }}</p>
            <p class="mc-meta mc-num">
              {{ sale.itemsCount }} {{ sale.itemsCount === 1 ? "item" : "items" }} · RM {{ formatMyr(sale.value) }}
            </p>
          </div>
          <span class="mc-tag gap-1.5">
            <span class="mc-dot" :data-tone="sale.source === 'pos' ? undefined : 'good'" aria-hidden="true" />
            {{ sale.source === "pos" ? "In-person" : "Delivered" }}
          </span>
        </component>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";
import type { CompiledOrder, CompiledOrderStatus } from "~/composables/useCompiledOrders";
import type { InventoryItem } from "~/composables/useInventory";
import { categorizeFunds } from "~/composables/useSellerFunds";
import { isAwaitingShipment } from "~/composables/useSellerOrders";

const props = withDefaults(
  defineProps<{
    orders: CompiledOrder[];

    // Direct (POS / manual) inventory sales — folded into the sales stats.
    posSales?: InventoryItem[];
  }>(),
  { posSales: () => [] },
);

defineEmits<{
  (e: "select", queue: string): void;
}>();

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
    tone: "warn",
  },
  {
    key: "awaiting",
    label: "Awaiting payment",
    icon: IconClock,
    count: byStatus("pending").length,
    tone: undefined,
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
  // Grouped by the counter sale that produced them. These are inventory rows,
  // one per card, so a three-card sale used to render as three "1 item" lines
  // at three separate prices — which reads as three customers. posSaleId is
  // written by the POS when the sale settles, so it's the receipt to group on.
  //
  // Items with no posSaleId (marked sold by hand from the Items table) have no
  // receipt to group into or link to, so they stay one row each.
  const posGroups = new Map<string, InventoryItem[]>();
  for (const i of props.posSales ?? []) {
    const key = i.posSaleId || `item:${i.id}`;
    const bucket = posGroups.get(key);
    if (bucket) bucket.push(i);
    else posGroups.set(key, [i]);
  }

  const pos: SaleEntry[] = [...posGroups.entries()].map(([key, group]) => {
    const first = group[0]!;
    const saleId = first.posSaleId;
    return {
      id: key,
      name:
        group.length > 1
          ? `${first.cardName} + ${group.length - 1} more`
          : first.cardName,
      itemsCount: group.length,
      value: group.reduce((t, i) => t + (i.soldPrice ?? i.listPrice ?? 0), 0),
      ts: Math.max(...group.map((i) => i.soldAt ?? i.updatedAt ?? 0)),
      image: first.primaryImage ?? "",
      source: "pos",
      href: saleId ? `/seller/sales/${saleId}` : null,
    };
  });
  return [...online, ...pos];
});

const salesValue = computed(() => unifiedSales.value.reduce((s, e) => s + e.value, 0));
const itemsSold = computed(() => unifiedSales.value.reduce((s, e) => s + e.itemsCount, 0));
const completedCount = computed(() => unifiedSales.value.length);
const posCount = computed(() => (props.posSales ?? []).length);

// Counter discounts, straight off the inventory rows the dashboard already
// has: every sold item carries both the price its label was printed with and
// what it actually went for. No extra query, and it stays correct for cash
// sales as well as QR ones.
const counterDiscount = computed(() => {
  let total = 0;
  let count = 0;
  for (const item of props.posSales ?? []) {
    const off = (item.listPrice ?? 0) - (item.soldPrice ?? item.listPrice ?? 0);
    // Selling above the asking price is not a negative discount.
    if (off > 0.005) {
      total += off;
      count += 1;
    }
  }
  return { total: Math.round(total * 100) / 100, count };
});
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

<style>
.sd {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.sd-section-title {
  margin-bottom: 10px;
}
.sd-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

/* Queue tiles: cells of one card, each a button. */
.sd-tile {
  text-align: left;
  transition: background-color 120ms ease;
}
.sd-tile:first-child {
  border-radius: var(--radius) 0 0 var(--radius);
}
.sd-tile:last-child {
  border-radius: 0 var(--radius) var(--radius) 0;
}
@media (hover: hover) and (pointer: fine) {
  .sd-tile:hover {
    background: var(--surface-2);
  }
}

/* Chart */
.sd-axis {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}
/* Narrow phones: label every other week, newest always shown. */
@media (max-width: 480px) {
  .sd-axis.is-alt {
    visibility: hidden;
  }
}
.sd-axis.is-hot {
  color: var(--ink);
  font-weight: 600;
}
.sd-grid {
  border-top: 1px dashed var(--line);
}
.sd-baseline {
  border-top: 1px solid var(--line-strong);
}
.sd-bar {
  width: 100%;
  max-width: 30px;
  border-radius: 4px 4px 0 0;
  background: var(--ink-2);
  transition: background-color 120ms ease;
}
.sd-bar.is-hot {
  background: var(--ink);
}
.sd-bar.is-empty {
  background: var(--surface-3);
}
.sd-peak {
  font-size: 11px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.sd-tip {
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-2);
}

/* Funds row */
.sd-link-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  transition: background-color 120ms ease;
}
.sd-icon-box {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--ink-2);
}
@media (hover: hover) and (pointer: fine) {
  .sd-link-row:hover {
    background: var(--surface-2);
  }
}

/* Recent sales rows */
.sd-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  transition: background-color 120ms ease;
}
.sd-row + .sd-row {
  border-top: 1px solid var(--line);
}
@media (hover: hover) and (pointer: fine) {
  .sd-row.is-link:hover {
    background: var(--surface-2);
  }
}
.sd-thumb {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
}
.sd-row-title {
  font-size: 14px;
  font-weight: 550;
}
.sd-empty {
  padding: 18px 16px;
  color: var(--ink-3);
}
</style>

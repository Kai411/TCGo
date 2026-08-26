<template>
  <div>
    <!-- Honest empty state. The daily snapshot may not have reached this card
         yet; drawing a flat line would invent data that doesn't exist. -->
    <div
      v-if="!trend || trend.points.length < 2"
      class="rounded-xl border border-dashed border-black/[0.10] dark:border-white/[0.12] py-6 px-4 text-center"
    >
      <p class="text-xs text-ink-muted dark:text-zinc-400">
        {{ loading ? "Loading price history…" : "Not enough price history for this card yet." }}
      </p>
    </div>

    <div v-else>
      <!-- Headline: current price + change over the window -->
      <div v-if="showHeader" class="flex items-end justify-between gap-3 mb-3">
        <div>
          <p class="text-[11px] text-ink-muted dark:text-zinc-400">Market price</p>
          <p class="text-2xl font-bold text-ink dark:text-white tabular-price leading-none mt-1">
            RM {{ fmt(trend.last) }}
          </p>
        </div>
        <span
          v-if="trend.changePct !== null"
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-price"
          :class="up
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'"
        >
          <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              :d="up ? 'M6 9.5V2.5M6 2.5L3 5.5M6 2.5l3 3' : 'M6 2.5v7M6 9.5l-3-3M6 9.5l3-3'"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
          {{ Math.abs(trend.changePct).toFixed(1) }}%
        </span>
      </div>

      <!-- Plot -->
      <div
        ref="plot"
        class="relative select-none"
        :style="{ height: `${height}px` }"
        @mousemove="onMove"
        @mouseleave="active = null"
        @touchmove.passive="onTouch"
        @touchend="active = null"
      >
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          preserveAspectRatio="none"
          class="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.18" />
              <stop offset="100%" :stop-color="strokeColor" stop-opacity="0" />
            </linearGradient>
          </defs>

          <path :d="areaPath" :fill="`url(#${gradId})`" />
          <path
            :d="linePath"
            fill="none"
            :stroke="strokeColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />

          <!-- Crosshair -->
          <line
            v-if="active !== null"
            :x1="xAt(active)" :x2="xAt(active)" y1="0" :y2="H"
            :stroke="strokeColor" stroke-width="1" stroke-dasharray="3 3"
            vector-effect="non-scaling-stroke" opacity="0.5"
          />
        </svg>

        <!-- Active point marker (HTML so it stays circular under the
             non-uniform viewBox scaling) -->
        <span
          v-if="active !== null"
          class="absolute w-2.5 h-2.5 rounded-full ring-4 pointer-events-none"
          :class="up ? 'bg-emerald-500 ring-emerald-500/15' : 'bg-pokemon-red ring-pokemon-red/15'"
          :style="{
            left: `${(xAt(active) / W) * 100}%`,
            top: `${(yAt(active) / H) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }"
        />

        <!-- Tooltip -->
        <div
          v-if="active !== null"
          class="absolute z-20 -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap rounded-lg bg-ink dark:bg-white px-2.5 py-1.5 shadow-card-hover"
          :style="{
            left: `${clampPct((xAt(active) / W) * 100)}%`,
            top: `${Math.max(0, (yAt(active) / H) * 100 - 6)}%`,
          }"
        >
          <p class="text-[10px] text-white/70 dark:text-ink-muted">{{ labelAt(active) }}</p>
          <p class="text-[11px] font-bold text-white dark:text-ink tabular-price">
            RM {{ fmt(trend.points[active]!.market) }}
          </p>
        </div>
      </div>

      <!-- Range footer -->
      <div class="mt-2 flex items-center justify-between text-[10px] text-ink-soft dark:text-zinc-500 tabular-price">
        <span>{{ labelAt(0) }}</span>
        <span>Low RM {{ fmt(trend.min) }} · High RM {{ fmt(trend.max) }}</span>
        <span>{{ labelAt(trend.points.length - 1) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PriceTrend } from "~/composables/useCardCatalog";

const props = withDefaults(
  defineProps<{
    trend: PriceTrend | null;
    loading?: boolean;
    height?: number;
    showHeader?: boolean;
  }>(),
  { loading: false, height: 120, showHeader: true },
);

// Fixed drawing space; the SVG stretches to the container via preserveAspectRatio.
const W = 320;
const H = 100;
// Unique per instance so multiple charts on one page don't share a gradient id.
const gradId = `trend-${Math.random().toString(36).slice(2, 9)}`;

const up = computed(() => (props.trend?.changePct ?? 0) >= 0);
const strokeColor = computed(() => (up.value ? "#059669" : "#E3350D"));

/** Vertical padding keeps the line off the top/bottom edges. */
const PAD = 10;

const scaleY = (v: number) => {
  const t = props.trend!;
  const span = t.max - t.min;
  // A perfectly flat series would divide by zero — pin it to the middle.
  if (span <= 0) return H / 2;
  return PAD + (1 - (v - t.min) / span) * (H - PAD * 2);
};

const xAt = (i: number) => {
  const n = props.trend!.points.length;
  return n <= 1 ? W / 2 : (i / (n - 1)) * W;
};
const yAt = (i: number) => scaleY(props.trend!.points[i]!.market);

const linePath = computed(() => {
  const t = props.trend;
  if (!t || t.points.length < 2) return "";
  return t.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)},${scaleY(p.market).toFixed(2)}`)
    .join(" ");
});

const areaPath = computed(() =>
  linePath.value ? `${linePath.value} L${W},${H} L0,${H} Z` : "",
);

// ── Hover / touch ────────────────────────────────────────────────────
const plot = ref<HTMLElement>();
const active = ref<number | null>(null);

const pick = (clientX: number) => {
  const el = plot.value;
  const t = props.trend;
  if (!el || !t) return;
  const r = el.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  active.value = Math.round(ratio * (t.points.length - 1));
};
const onMove = (e: MouseEvent) => pick(e.clientX);
const onTouch = (e: TouchEvent) => {
  const t = e.touches[0];
  if (t) pick(t.clientX);
};

/** Keep the tooltip from hanging off either edge of the plot. */
const clampPct = (p: number) => Math.min(88, Math.max(12, p));

const labelAt = (i: number) => {
  const d = props.trend?.points[i]?.date;
  if (!d) return "";
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
};

const fmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<template>
  <!-- One series, so no legend: the heading beside it names what it shows. -->
  <p v-if="max === 0" class="mc-small py-8 text-center">{{ emptyText }}</p>
  <div v-else class="relative pl-11">
    <div class="relative flex items-end h-36" :class="points.length > 14 ? 'gap-[3px]' : 'gap-2'">
      <div class="absolute inset-y-0 -left-11 right-0 pointer-events-none" aria-hidden="true">
        <div
          v-for="(tick, i) in ticks"
          :key="i"
          class="absolute left-0 right-0 flex items-center gap-2"
          :style="{ bottom: `${(tick / axisMax) * 100}%` }"
        >
          <span class="sbc-axis w-9 shrink-0 text-right">{{ short(tick) }}</span>
          <span class="sbc-grid flex-1" />
        </div>
      </div>

      <div
        v-for="(p, i) in points"
        :key="i"
        class="relative flex-1 min-w-0 h-full flex items-end justify-center"
        @mouseenter="hovered = i"
        @mouseleave="hovered = null"
        @focusin="hovered = i"
        @focusout="hovered = null"
      >
        <button
          type="button"
          class="sbc-bar"
          :class="{ 'is-empty': p.value === 0, 'is-hot': hovered === i || (hovered === null && hot === i) }"
          :style="{ height: height(p.value) }"
          :aria-label="`${p.label}: RM ${money(p.value)}, ${p.count} ${p.count === 1 ? 'sale' : 'sales'}`"
        />
        <span
          v-if="hovered === null && p.value > 0 && i === peakIndex"
          class="sbc-peak absolute left-1/2 -translate-x-1/2 pointer-events-none"
          :style="{ bottom: `calc(${height(p.value)} + 6px)` }"
        >{{ short(p.value) }}</span>
        <div
          v-if="hovered === i"
          class="sbc-tip absolute bottom-full mb-2 z-20 pointer-events-none"
          :class="i < points.length / 3 ? 'left-0' : i > (points.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'"
        >
          <p class="mc-small">{{ p.label }}</p>
          <p class="mc-num text-[13px] font-semibold">RM {{ money(p.value) }}</p>
          <p class="mc-small">{{ p.count }} {{ p.count === 1 ? "sale" : "sales" }}</p>
        </div>
      </div>
    </div>

    <div class="sbc-baseline" />
    <div class="flex mt-1.5" :class="points.length > 14 ? 'gap-[3px]' : 'gap-2'">
      <span
        v-for="(p, i) in points"
        :key="i"
        class="sbc-axis flex-1 min-w-0 text-center whitespace-nowrap"
        :class="{ 'is-hot': hovered === i, 'is-hidden': (points.length - 1 - i) % labelEvery !== 0 }"
      >{{ p.short }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ChartPoint {
  value: number;
  count: number;
  /** Tooltip and screen-reader label, e.g. "Tue 25 Nov". */
  label: string;
  /** Axis label, e.g. "25". */
  short: string;
}

const props = withDefaults(
  defineProps<{
    points: ChartPoint[];
    /** Bar drawn darker when nothing is hovered, e.g. today. */
    hot?: number | null;
    /** Label every Nth bar, counted back from the newest. */
    labelEvery?: number;
    emptyText?: string;
  }>(),
  { hot: null, labelEvery: 1, emptyText: "No paid sales in this period." },
);

const hovered = ref<number | null>(null);

const max = computed(() => props.points.reduce((m, p) => Math.max(m, p.value), 0));
const peakIndex = computed(() => props.points.findIndex((p) => p.value === max.value));

/** Round the axis up to a clean number so gridlines land on readable values. */
const axisMax = computed(() => {
  const m = max.value;
  if (m <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(m));
  return Math.ceil(m / mag) * mag;
});
const ticks = computed(() => [0, axisMax.value / 2, axisMax.value]);

const height = (v: number) =>
  v === 0 ? "2px" : `${Math.max(4, (v / axisMax.value) * 100)}%`;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
</script>

<style>
.sbc-axis {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}
.sbc-axis.is-hidden {
  visibility: hidden;
}
.sbc-axis.is-hot {
  color: var(--ink);
  font-weight: 600;
  visibility: visible;
}
.sbc-grid {
  border-top: 1px dashed var(--line);
}
.sbc-baseline {
  border-top: 1px solid var(--line-strong);
}
.sbc-bar {
  width: 100%;
  max-width: 32px;
  border-radius: 4px 4px 0 0;
  background: var(--ink-2);
  transition: background-color 120ms ease;
}
.sbc-bar.is-hot {
  background: var(--accent);
}
.sbc-bar.is-empty {
  background: var(--surface-3);
}
.sbc-peak {
  font-size: 11px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.sbc-tip {
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-2);
}
</style>

<template>
  <div ref="root" class="surface rounded-3xl p-5 sm:p-7">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow !text-[9px] !tracking-[0.14em]">Total revenue</p>
        <p
          ref="total"
          class="mt-2 text-4xl sm:text-[2.75rem] font-bold text-ink tabular-price leading-none tracking-tightest"
        >
          RM 0
        </p>
        <p class="mt-2 text-xs text-ink-soft">
          <span class="font-semibold text-emerald-600">▲ 12.4%</span>
          vs last month
        </p>
      </div>
      <span class="chip shrink-0">Aug 2026</span>
    </div>

    <!-- Stacked bars: counter sales and online orders on one axis -->
    <div class="mt-7 flex items-end justify-between gap-1.5 sm:gap-2.5 h-32">
      <div
        v-for="day in days"
        :key="day.label"
        class="flex-1 flex flex-col items-center gap-2"
      >
        <div class="w-full flex flex-col justify-end h-32">
          <div class="bar w-full origin-bottom flex flex-col justify-end gap-[3px]">
            <div
              class="w-full rounded-t-[3px] bg-pokemon-red"
              :style="{ height: `${day.online}px` }"
            />
            <div
              class="w-full rounded-b-[3px] bg-ink/80"
              :style="{ height: `${day.counter}px` }"
            />
          </div>
        </div>
        <span class="text-[10px] font-medium text-ink-soft">{{ day.label }}</span>
      </div>
    </div>

    <!-- Legend / split -->
    <div class="mt-5 pt-4 border-t border-black/[0.06] grid grid-cols-2 gap-3">
      <div class="legend-item">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-pokemon-red" />
          <span class="text-[11px] text-ink-muted">Online</span>
        </div>
        <p class="mt-1 text-sm font-bold text-ink tabular-price">RM 29,140</p>
      </div>
      <div class="legend-item">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-ink/80" />
          <span class="text-[11px] text-ink-muted">Counter</span>
        </div>
        <p class="mt-1 text-sm font-bold text-ink tabular-price">RM 19,180</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Heights in px against the h-32 (128px) track. The split has to agree with the
// legend totals below — online is 29,140 of 48,320 (60.3%), so the red segments
// sum to ~60% of the stack too (308 of 511). Both channels peak on the weekend.
const days = [
  { label: "M", online: 32, counter: 21 },
  { label: "T", online: 28, counter: 19 },
  { label: "W", online: 38, counter: 24 },
  { label: "T", online: 35, counter: 23 },
  { label: "F", online: 52, counter: 34 },
  { label: "S", online: 66, counter: 44 },
  { label: "S", online: 57, counter: 38 },
];

const root = ref<HTMLElement>();
const total = ref<HTMLElement>();

useReveal(root, ({ gsap, reduced, countUp, root: el }) => {
  const fmt = (v: number) => `RM ${Math.round(v).toLocaleString("en-MY")}`;

  if (reduced) {
    total.value!.textContent = fmt(48320);
    return;
  }

  countUp(total.value!, 48320, fmt, { trigger: el, duration: 1.8 });

  gsap
    .timeline({ scrollTrigger: { trigger: el, start: "top 78%", once: true } })
    .from(".bar", { scaleY: 0, duration: 0.7, stagger: 0.07, ease: "power3.out" })
    .from(".legend-item", { opacity: 0, y: 10, stagger: 0.1, duration: 0.5 }, "-=0.4");
});
</script>

<template>
  <div class="mc-card mc-card-pad min-w-0">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="mc-h3 text-[14px]">{{ name }}</h3>
        <p class="mc-small mt-1">{{ purpose }}</p>
      </div>
      <span v-if="projection.recommended > 0" class="mc-tag shrink-0 gap-1.5">
        <span class="mc-dot" data-tone="warn" aria-hidden="true" />
        Top up
      </span>
    </div>

    <dl class="mt-4 grid grid-cols-3 gap-3">
      <div class="min-w-0">
        <dt class="mc-label">Daily burn</dt>
        <dd class="mc-num mt-0.5 text-[15px] font-semibold">RM {{ money(projection.dailyBurn) }}</dd>
      </div>
      <div class="min-w-0">
        <dt class="mc-label">Next 30 days</dt>
        <dd class="mc-num mt-0.5 text-[15px] font-semibold">RM {{ money(projection.projected) }}</dd>
      </div>
      <div class="min-w-0">
        <dt class="mc-label">Top up by</dt>
        <dd
          class="mc-num mt-0.5 text-[15px] font-semibold"
          :class="projection.recommended > 0 ? '' : 'text-[var(--ink-3)]'"
        >
          RM {{ money(projection.recommended) }}
        </dd>
      </div>
    </dl>

    <p v-if="projection.runwayDays !== null" class="mc-meta mt-3">
      About {{ projection.runwayDays }} days of runway left.
    </p>
    <p v-else class="mc-small mt-3">
      Runway needs a balance to measure against, and neither provider exposes
      one we poll. The burn above is measured, the balance isn't.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { TopUpProjection } from "~/shared/finance";

defineProps<{ name: string; purpose: string; projection: TopUpProjection }>();

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

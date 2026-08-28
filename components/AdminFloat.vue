<template>
  <div
    class="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-ink dark:text-white">{{ name }}</h3>
        <p class="text-xs text-ink-muted dark:text-zinc-400 mt-1 leading-relaxed">
          {{ purpose }}
        </p>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-3">
      <div>
        <p class="text-xs text-ink-soft dark:text-zinc-500">Daily burn</p>
        <p class="text-base font-bold tabular-nums text-ink dark:text-white mt-0.5">
          RM{{ money(projection.dailyBurn) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-soft dark:text-zinc-500">Next 30 days</p>
        <p class="text-base font-bold tabular-nums text-ink dark:text-white mt-0.5">
          RM{{ money(projection.projected) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-soft dark:text-zinc-500">Top up</p>
        <p
          class="text-base font-bold tabular-nums mt-0.5"
          :class="
            projection.recommended > 0
              ? 'text-pokemon-red'
              : 'text-ink-muted dark:text-zinc-400'
          "
        >
          RM{{ money(projection.recommended) }}
        </p>
      </div>
    </div>

    <p
      v-if="projection.runwayDays !== null"
      class="text-xs text-ink-muted dark:text-zinc-400 mt-3"
    >
      About {{ projection.runwayDays }} days of runway left.
    </p>
    <p v-else class="text-xs text-ink-soft dark:text-zinc-500 mt-3 leading-relaxed">
      Runway needs a balance to measure against, and neither provider exposes one
      we poll — the burn above is measured, the balance isn't.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { TopUpProjection } from "~/shared/finance";

defineProps<{ name: string; purpose: string; projection: TopUpProjection }>();

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

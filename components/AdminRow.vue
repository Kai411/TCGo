<template>
  <div
    class="flex items-baseline justify-between gap-4"
    :class="divider ? 'border-t border-black/[0.06] dark:border-white/[0.08] pt-2.5 mt-2.5' : ''"
  >
    <dt :class="strong ? 'font-semibold text-ink dark:text-white' : 'text-ink-muted dark:text-zinc-400'">
      {{ label }}
      <span v-if="note" class="text-xs font-normal text-ink-soft dark:text-zinc-500">
        · {{ note }}
      </span>
    </dt>
    <dd
      class="tabular-nums shrink-0"
      :class="[
        strong ? 'font-bold' : '',
        highlight
          ? value >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
          : 'text-ink dark:text-zinc-100',
      ]"
    >
      {{ value < 0 ? "−" : "" }}RM{{ money(Math.abs(value)) }}
    </dd>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: number;
    note?: string;
    strong?: boolean;
    divider?: boolean;
    highlight?: boolean;
  }>(),
  { strong: false, divider: false, highlight: false },
);

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

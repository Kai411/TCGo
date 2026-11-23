<template>
  <div
    class="flex items-baseline justify-between gap-4"
    :class="divider ? 'mc-divider pt-2.5 mt-1' : ''"
  >
    <dt class="min-w-0" :class="strong ? 'font-semibold' : 'text-[var(--ink-2)]'">
      {{ label }}
      <span v-if="note" class="mc-small font-normal whitespace-nowrap">· {{ note }}</span>
    </dt>
    <dd class="mc-num shrink-0 flex items-center gap-2" :class="strong ? 'font-semibold' : ''">
      <span
        v-if="highlight"
        class="mc-dot"
        :data-tone="value >= 0 ? 'good' : 'bad'"
        aria-hidden="true"
      />
      {{ value < 0 ? "−" : "" }}RM {{ money(Math.abs(value)) }}
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

<template>
  <div class="min-w-0">
    <p class="mc-label">{{ label }}</p>
    <p
      class="mc-stat-value mc-num mt-1"
      :class="muted ? 'text-[var(--ink-2)]' : ''"
    >
      {{ value }}
    </p>
    <p v-if="hint" class="mc-small mt-1.5 flex items-center gap-2">
      <span v-if="tone" class="mc-dot" :data-tone="tone" aria-hidden="true" />
      <span class="min-w-0">{{ hint }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
// A figure inside a .mc-cells card. Status colour appears only as the dot
// beside the hint, never as a filled card.
withDefaults(
  defineProps<{
    label: string;
    value: string;
    hint?: string;
    tone?: "good" | "bad" | "warn";
    muted?: boolean;
  }>(),
  { muted: false },
);
</script>

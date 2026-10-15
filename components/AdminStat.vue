<template>
  <div
    class="rounded-2xl border p-4"
    :class="toneClass"
  >
    <p class="text-xs font-medium text-ink-muted dark:text-zinc-400">{{ label }}</p>
    <p class="text-2xl font-bold tabular-nums mt-1" :class="valueClass">{{ value }}</p>
    <p v-if="hint" class="text-xs text-ink-soft dark:text-zinc-500 mt-1 leading-snug">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "good" | "bad" | "warn" | "muted";
  }>(),
  { tone: "default" },
);

const toneClass = computed(() => {
  switch (props.tone) {
    case "good":
      return "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/[0.08]";
    case "bad":
      return "border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/[0.08]";
    case "warn":
      return "border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.08]";
    default:
      return "border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04]";
  }
});

const valueClass = computed(() => {
  switch (props.tone) {
    case "good":
      return "text-emerald-700 dark:text-emerald-300";
    case "bad":
      return "text-red-700 dark:text-red-300";
    case "warn":
      return "text-amber-700 dark:text-amber-300";
    case "muted":
      return "text-ink-muted dark:text-zinc-400";
    default:
      return "text-ink dark:text-white";
  }
});
</script>

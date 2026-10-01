<template>
  <div class="surface rounded-2xl py-16 px-6 text-center">
    <div
      v-if="$slots.icon"
      class="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] text-ink-muted dark:text-zinc-400"
    >
      <slot name="icon" />
    </div>
    <p class="text-base font-semibold text-ink dark:text-white">
      {{ headline }}
    </p>
    <p
      v-if="caption"
      class="mt-1 text-sm text-ink-muted dark:text-zinc-400 max-w-md mx-auto"
    >
      {{ caption }}
    </p>
    <div v-if="$slots.default" class="mt-6 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  headline: string;
  caption?: string;
}>();
</script>

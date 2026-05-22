<template>
  <button
    type="button"
    @click="$emit('click')"
    class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
    :class="
      active
        ? 'bg-ink text-white dark:bg-white dark:text-ink'
        : 'bg-black/[0.04] text-ink-muted dark:bg-white/[0.06] dark:text-zinc-300 hover:text-ink dark:hover:text-white'
    "
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{ active?: boolean }>();
defineEmits<{ (e: "click"): void }>();
</script>

<template>
  <button
    type="button"
    @click="$emit('click')"
    class="rounded-full font-semibold transition-colors"
    :class="[
      size === 'sm'
        ? 'px-2 py-0.5 text-[11px]'
        : 'px-3 py-1.5 text-xs',
      active
        ? 'bg-ink text-white dark:bg-white dark:text-ink'
        : 'bg-black/[0.04] text-ink-muted dark:bg-white/[0.06] dark:text-zinc-300 hover:text-ink dark:hover:text-white',
    ]"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{ active?: boolean; size?: 'sm' | 'md' }>();
defineEmits<{ (e: "click"): void }>();
</script>

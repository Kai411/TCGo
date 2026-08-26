<template>
  <section class="border-t border-black/[0.06] dark:border-white/[0.08]">
    <button
      type="button"
      :aria-expanded="open"
      @click="$emit('toggle')"
      class="w-full flex items-center gap-2 py-3 text-left group"
    >
      <span class="sb-label !mb-0 flex-1">{{ label }}</span>
      <span
        v-if="count > 0"
        class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold tabular-nums"
      >
        {{ count }}
      </span>
      <svg
        class="w-3.5 h-3.5 shrink-0 text-ink-soft dark:text-zinc-500 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-show="open" class="pb-4">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * One collapsible group in the marketplace filter rail.
 *
 * v-show rather than v-if: the groups hold live inputs (price range, set
 * search) and unmounting them would drop focus and re-run their transitions
 * every time a shopper opened the group again.
 */
defineProps<{
  label: string;
  /** Active selections inside this group — shown as a badge when collapsed. */
  count: number;
  open: boolean;
}>();

defineEmits<{ (e: "toggle"): void }>();
</script>

<style scoped>
.sb-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.55;
}
</style>

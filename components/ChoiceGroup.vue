<template>
  <div class="grid gap-2" :class="colsClass" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="opt in normalised"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === opt.value"
      @click="$emit('update:modelValue', opt.value)"
      class="rounded-lg border text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-red/40"
      :class="[
        sizeClass,
        modelValue === opt.value
          ? 'border-pokemon-red bg-pokemon-red/[0.06] text-pokemon-red font-bold'
          : 'border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-ink-muted dark:text-zinc-300 font-medium hover:border-black/25 dark:hover:border-white/25',
      ]"
    >
      <span class="block">{{ opt.label }}</span>
      <span
        v-if="opt.hint"
        class="block text-[10px] font-normal mt-0.5"
        :class="modelValue === opt.value ? 'text-pokemon-red/70' : 'text-ink-soft dark:text-zinc-500'"
      >
        {{ opt.hint }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * A single-select set of chips.
 *
 * Product type, condition, grading provider and grade were four copies of the
 * same bordered-button grid, each with its own class string — so they drifted
 * (different padding, weights and one using `bg-red-50`, which doesn't adapt
 * to dark mode).
 */
export interface Choice {
  value: string;
  label: string;
  hint?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: readonly (string | Choice)[];
    /** Tailwind grid-cols classes for this group. */
    cols?: string;
    size?: "sm" | "md";
    ariaLabel?: string;
  }>(),
  { cols: "grid-cols-3", size: "md" },
);

defineEmits<{ (e: "update:modelValue", v: string): void }>();

const normalised = computed<Choice[]>(() =>
  props.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
);

const colsClass = computed(() => props.cols);
const sizeClass = computed(() =>
  props.size === "sm" ? "py-1.5 px-2 text-[11px]" : "py-2.5 px-3 text-sm",
);
</script>

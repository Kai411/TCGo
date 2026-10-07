<template>
  <div>
    <label class="flex items-center gap-1.5 mb-1.5">
      <span class="text-[13px] font-semibold text-ink-subtle dark:text-zinc-200">
        {{ label }}
      </span>
      <span v-if="required" class="text-pokemon-red text-[13px] leading-none">*</span>
      <span v-if="optional" class="text-[11px] font-normal text-ink-soft dark:text-zinc-500">
        optional
      </span>
    </label>

    <slot />

    <p v-if="hint && !error" class="mt-1 text-[11px] text-ink-soft dark:text-zinc-500">
      {{ hint }}
    </p>
    <p v-if="error" class="mt-1 text-[11px] font-medium text-pokemon-red">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * One label + control + hint/error unit.
 *
 * The seller forms each hand-rolled their own label markup with slightly
 * different sizes, weights and spacing, so fields drifted apart across pages.
 * Pairing this with the `.tcgo-input` class in tailwind.css gives every field
 * one shape.
 */
defineProps<{
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
}>();
</script>

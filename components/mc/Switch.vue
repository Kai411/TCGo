<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    class="relative inline-flex h-7 w-[46px] shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:opacity-50"
    :class="modelValue ? 'bg-emerald-500' : 'bg-black/[0.12] dark:bg-white/[0.16]'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out"
      :class="modelValue ? 'translate-x-[18px]' : 'translate-x-0'"
    />
  </button>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

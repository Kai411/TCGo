<template>
  <div
    class="inline-flex p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl max-w-full overflow-x-auto"
    role="tablist"
  >
    <button
      v-for="t in tabs"
      :key="t.id"
      @click="$emit('update:modelValue', t.id)"
      class="px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
      :class="
        modelValue === t.id
          ? 'bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm'
          : 'text-gray-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white'
      "
    >
      {{ t.label }}
      <span
        v-if="t.count"
        class="ml-1 text-xs opacity-70 tabular-nums"
      >
        {{ t.count }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface TabItem {
  id: string;
  label: string;
  count?: number;
}

defineProps<{
  modelValue: string;
  tabs: TabItem[];
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>

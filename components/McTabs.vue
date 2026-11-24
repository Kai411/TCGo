<template>
  <!-- Calm underline tabs (inside a `.mc` scope). Same API as TabStrip. -->
  <div class="mc-tabs" role="tablist">
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === t.id"
      @click="$emit('update:modelValue', t.id)"
    >
      {{ t.label }}
      <span v-if="t.count" class="mc-count">{{ t.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T;
  tabs: { id: T; label: string; count?: number }[];
}>();
defineEmits<{ (e: "update:modelValue", v: T): void }>();
</script>

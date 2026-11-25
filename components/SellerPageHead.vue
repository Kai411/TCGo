<template>
  <!-- One page head for every seller page: optional back link, eyebrow,
       title and a one-line description on the left, actions on the right. -->
  <header class="mc-page-head">
    <div>
      <NuxtLink v-if="back" :to="back" class="sph-back" @click.prevent="goBack">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        {{ backLabel }}
      </NuxtLink>
      <p v-else-if="eyebrow" class="mc-eyebrow">{{ eyebrow }}</p>
      <h1 class="mc-h1" :class="back || eyebrow ? 'mt-1' : ''">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="mc-desc">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.default" class="sph-actions">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string;
    eyebrow?: string;
    description?: string;
    back?: string;
    backLabel?: string;
  }>(),
  { eyebrow: "Seller", backLabel: "Back" },
);

const goBack = useGoBack(props.back ?? "/seller");
</script>

<style>
.sph-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: -2px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ink-3);
  transition: color 120ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .sph-back:hover {
    color: var(--ink);
  }
}
.sph-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>

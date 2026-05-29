<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="alt || 'Card'"
    class="w-full h-full object-cover"
    loading="lazy"
    @error="failed = true"
  />
  <div
    v-else
    class="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-zinc-600 select-none"
  >
    <!-- Card-back-ish placeholder mark -->
    <svg
      class="w-1/3 max-w-[40px] opacity-60"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
    <span class="text-[10px] font-medium px-1 text-center leading-tight">No image</span>
  </div>
</template>

<script setup lang="ts">
// Reusable card thumbnail that degrades gracefully when the source URL is
// empty OR returns an error (e.g. TCGPlayer CDN products with no image yet,
// which 403/404). Fills its container — the parent owns the aspect box.
const props = defineProps<{
  src?: string | null;
  alt?: string;
}>();

const failed = ref(false);

// Reset the error flag when the src changes so a previously-broken slot can
// recover if it's reused for a different (valid) card.
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

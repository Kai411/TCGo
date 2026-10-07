<template>
  <!-- Back to the Account page, plus an optional title, for pages reached
       from it. Pages whose card already names itself skip the title. -->
  <div class="mb-3">
    <NuxtLink
      :to="back"
      class="-ml-2 inline-flex items-center gap-1 min-h-[44px] px-2 text-sm font-medium text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {{ backLabel }}
    </NuxtLink>
    <h1 v-if="title" class="text-2xl font-bold text-ink dark:text-white">{{ title }}</h1>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ title?: string; back?: string; backLabel?: string }>(),
  { back: "/account", backLabel: "Account" },
);
</script>

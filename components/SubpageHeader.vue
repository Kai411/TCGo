<template>
  <!-- Back to the Account page, plus an optional title, for pages reached
       from it. Pages whose card already names itself skip the title.
       With a title it's one row, like a native nav bar: a chevron that
       goes back, then the title, so the back link costs no extra height. -->
  <div v-if="title" class="mb-3 select-none flex items-center gap-1">
    <NuxtLink
      :to="back"
      :aria-label="`Back to ${backLabel}`"
      class="-ml-3 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-ink dark:text-white transition-transform duration-150 active:scale-90"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
    </NuxtLink>
    <h1 class="text-xl font-bold text-ink dark:text-white truncate">{{ title }}</h1>
  </div>
  <div v-else class="mb-3 select-none">
    <NuxtLink
      :to="back"
      class="-ml-2 inline-flex items-center gap-1 min-h-[44px] px-2 text-sm font-medium text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {{ backLabel }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ title?: string; back?: string; backLabel?: string }>(),
  { back: "/account", backLabel: "Account" },
);
</script>

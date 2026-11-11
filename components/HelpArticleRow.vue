<template>
  <!-- One article in a Help list: title, a one-line summary, a chevron. -->
  <NuxtLink
    :to="`/account/help/${article.slug}`"
    class="press flex items-center gap-4 lg:px-4 py-3 min-h-[60px]"
  >
    <span class="flex-1 min-w-0">
      <span class="block text-sm font-medium text-ink dark:text-white">{{ article.title }}</span>
      <span class="block mt-0.5 text-xs text-ink-soft dark:text-zinc-500">{{ article.summary }}</span>
    </span>
    <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { HelpArticle } from "~/shared/help";

defineProps<{ article: HelpArticle }>();
</script>

<style scoped>
/* Same pressed feedback as the Account rows: scale on press, never on hover. */
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
</style>

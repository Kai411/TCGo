<template>
  <!-- One Help article: a summary, numbered steps, then what to know and
       where to go next. Content lives in shared/help.ts. -->
  <div class="max-w-xl mx-auto space-y-4">
    <template v-if="found">
      <SubpageHeader
        :title="found.article.title"
        back="/account/help"
        back-label="Help Center"
        desktop-title
      />
      <p class="text-sm text-ink-muted dark:text-zinc-400 -mt-2">{{ found.article.summary }}</p>

      <section class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
        <ol class="space-y-4">
          <li
            v-for="(step, i) in found.article.steps"
            :key="i"
            class="flex gap-3"
          >
            <span
              class="w-6 h-6 shrink-0 rounded-full bg-black/[0.06] dark:bg-white/10 text-xs font-bold text-ink dark:text-white flex items-center justify-center tabular-nums"
              aria-hidden="true"
            >
              {{ i + 1 }}
            </span>
            <span class="pt-0.5 text-[15px] leading-relaxed text-ink dark:text-zinc-100">{{ step }}</span>
          </li>
        </ol>
      </section>

      <section
        v-if="found.article.notes?.length"
        aria-label="Good to know"
        class="rounded-2xl bg-black/[0.035] dark:bg-white/[0.05] p-4 space-y-2"
      >
        <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">Good to know</p>
        <p
          v-for="(note, i) in found.article.notes"
          :key="i"
          class="text-sm leading-relaxed text-ink dark:text-zinc-200"
        >
          {{ note }}
        </p>
      </section>

      <section
        v-if="found.article.links?.length"
        class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden"
      >
        <NuxtLink
          v-for="link in found.article.links"
          :key="link.to"
          :to="link.to"
          class="press flex items-center justify-between gap-4 lg:px-4 min-h-[52px] text-sm font-medium text-ink dark:text-white"
        >
          {{ link.label }}
          <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </NuxtLink>
      </section>

      <section
        v-if="related.length"
        aria-labelledby="help-related"
        class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden lg:pt-3"
      >
        <h2 id="help-related" class="lg:px-4 pb-1 text-base font-bold text-ink dark:text-white">
          More in {{ found.topic.title }}
        </h2>
        <div class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          <HelpArticleRow v-for="a in related" :key="a.slug" :article="a" />
        </div>
      </section>
    </template>

    <template v-else>
      <SubpageHeader title="Help" back="/account/help" back-label="Help Center" desktop-title />
      <div class="text-center py-12 space-y-4">
        <p class="text-sm text-ink-muted dark:text-zinc-400">This help article doesn't exist.</p>
        <NuxtLink
          to="/account/help"
          class="inline-flex items-center min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
        >
          All help topics
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { findHelpArticle } from "~/shared/help";

const route = useRoute();
const found = computed(() => findHelpArticle(String(route.params.slug ?? "")));
const related = computed(() =>
  found.value
    ? found.value.topic.articles.filter((a) => a.slug !== found.value!.article.slug)
    : [],
);

useHead(() => ({
  title: found.value ? `${found.value.article.title} | TCGo Help` : "Help | TCGo",
}));
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
</style>

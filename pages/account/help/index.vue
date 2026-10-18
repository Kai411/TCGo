<template>
  <!-- Help: the guide's topic groups, each listing its short articles.
       Content lives in shared/help.ts. Reachable signed out too, since help
       is most useful before someone has an account. -->
  <div class="max-w-xl mx-auto space-y-4 select-none">
    <SubpageHeader title="Help" desktop-title />

    <label class="flex items-center gap-2 h-11 px-4 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-ink-soft dark:text-zinc-500">
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span class="sr-only">Search help</span>
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        placeholder="Search help"
        class="flex-1 min-w-0 bg-transparent text-base text-ink dark:text-white placeholder:text-ink-soft dark:placeholder:text-zinc-500 outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
    </label>

    <!-- Search results replace the topic list while there is a query. -->
    <section
      v-if="query.trim()"
      class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden"
    >
      <p
        v-if="!results.length"
        class="lg:px-4 py-6 text-sm text-ink-muted dark:text-zinc-400"
      >
        Nothing matches “{{ query.trim() }}”. Try another word, like order, bid or payout.
      </p>
      <div v-else class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
        <HelpArticleRow v-for="a in results" :key="a.slug" :article="a" />
      </div>
    </section>

    <template v-else>
      <section
        v-for="topic in HELP_TOPICS"
        :key="topic.id"
        :aria-labelledby="`help-${topic.id}`"
        class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden lg:pt-3"
      >
        <h2
          :id="`help-${topic.id}`"
          class="lg:px-4 pb-1 text-base font-bold text-ink dark:text-white"
        >
          {{ topic.title }}
        </h2>
        <div class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          <HelpArticleRow v-for="a in topic.articles" :key="a.slug" :article="a" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { HELP_TOPICS, searchHelp } from "~/shared/help";

useHead({ title: "Help | TCGo" });

const query = ref("");
const results = computed(() => searchHelp(query.value));
</script>

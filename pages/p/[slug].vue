<template>
  <!-- Microsites made in Mint Condition → Content. No app header or tab bar:
       the page is the content, with one back button floating over it that
       behaves like the phone's back gesture (composables/useGoBack.ts). -->
  <div
    class="min-h-[100dvh]"
    :class="site?.type === 'image' ? 'bg-black text-white' : 'bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100'"
  >
    <button
      type="button"
      aria-label="Back"
      class="fixed left-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90"
      :class="floatingBack ? 'bg-black/45 text-white backdrop-blur-md' : 'text-ink dark:text-white'"
      style="top: calc(env(safe-area-inset-top) + 10px)"
      @click="goBack"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>

    <span
      v-if="isDraft"
      class="fixed right-3 z-30 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-ink"
      style="top: calc(env(safe-area-inset-top) + 18px)"
    >
      Draft preview
    </span>

    <div v-if="loading" class="flex min-h-[100dvh] items-center justify-center">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-ink/10 border-t-pokemon-red" />
    </div>

    <!-- Image only: the image is the page. Full width on phones, centred and
         capped on wide screens so a poster isn't blown up past its pixels. -->
    <div
      v-else-if="site?.type === 'image'"
      class="flex min-h-[100dvh] items-center justify-center"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <img
        :src="cdnUrl(site.imageUrl, 1600)"
        :alt="site.title"
        class="block h-auto w-full max-w-3xl select-none"
        draggable="false"
      />
    </div>

    <!-- Article: full-bleed banner, then the text in a readable column. -->
    <article
      v-else-if="site"
      style="padding-bottom: calc(env(safe-area-inset-bottom) + 4rem)"
    >
      <img
        v-if="site.imageUrl"
        :src="cdnUrl(site.imageUrl, 1600)"
        alt=""
        class="block aspect-[16/9] w-full object-cover lg:aspect-[3/1]"
        draggable="false"
      />
      <div
        class="mx-auto max-w-2xl px-4"
        :class="site.imageUrl ? 'pt-6' : 'pt-[calc(env(safe-area-inset-top)+64px)]'"
      >
        <h1 class="text-[26px] font-bold leading-tight text-ink dark:text-white [text-wrap:balance] sm:text-3xl">
          {{ site.title }}
        </h1>
        <ArticleBody :body="site.body" class="mt-5" />
      </div>
    </article>

    <div v-else class="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
      <p class="text-lg font-semibold text-ink dark:text-white">This page isn't available</p>
      <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">It may have ended or moved.</p>
      <NuxtLink to="/" class="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-ink">
        Go to Shop
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";
import type { Microsite } from "~/shared/site-content";

definePageMeta({ layout: false });

const route = useRoute();
const goBack = useGoBack("/");
const { mcFetch } = useMcFetch();

const site = ref<Microsite | null>(null);
const loading = ref(true);
const isDraft = ref(false);

// Over an image the back button needs its own backdrop to stay visible.
const floatingBack = computed(
  () => site.value?.type === "image" || (site.value?.type === "article" && !!site.value.imageUrl),
);

const load = async () => {
  loading.value = true;
  const slug = String(route.params.slug || "").toLowerCase();
  site.value = await fetchMicrosite(slug);
  isDraft.value = false;
  // ?preview from the console: staff can see a draft before publishing.
  if (!site.value && route.query.preview !== undefined) {
    try {
      const res = await mcFetch<{ microsite: Microsite }>(
        `/api/mc/content/microsites?slug=${encodeURIComponent(slug)}`,
      );
      site.value = res.microsite;
      isDraft.value = !res.microsite.published;
    } catch {
      // Not staff, or no such page: the not-found state says enough.
    }
  }
  loading.value = false;
};

useHead(() => ({
  title: site.value ? `${site.value.title} — TCGo` : "TCGo",
  meta: isDraft.value ? [{ name: "robots", content: "noindex" }] : [],
}));

watch(() => route.params.slug, load);
onMounted(load);
</script>

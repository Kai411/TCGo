<template>
  <div class="max-w-5xl">
    <h1 class="text-xl font-bold text-ink dark:text-white">Content</h1>
    <p class="mb-4 text-sm text-ink-muted dark:text-zinc-400">
      The banners above the Shop and Auctions listings, and pages of your own.
    </p>
    <McContentTabs />

    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-ink-muted dark:text-zinc-400">
        Pages at tcgo.shop/p/…, for a banner to link to or to share.
      </p>
      <NuxtLink
        to="/mintcondition/content/microsites/edit"
        class="inline-flex min-h-[44px] shrink-0 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97] dark:bg-white dark:text-ink"
      >
        New page
      </NuxtLink>
    </div>

    <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-ink/10 border-t-pokemon-red" />
    </div>
    <div v-else-if="!microsites.length" class="py-16 text-center text-sm text-ink-muted dark:text-zinc-400">
      No microsites yet.
    </div>

    <ul v-else class="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:divide-white/[0.08] dark:border-white/[0.08] dark:bg-white/[0.04]">
      <li v-for="m in microsites" :key="m.slug">
        <NuxtLink
          :to="`/mintcondition/content/microsites/edit?slug=${m.slug}`"
          class="flex items-center gap-3 px-4 py-3 transition-colors active:bg-black/[0.03] dark:active:bg-white/[0.04]"
        >
          <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/[0.05] dark:bg-white/[0.08]">
            <img v-if="m.imageUrl" :src="cdnUrl(m.imageUrl, 120)" alt="" class="h-full w-full object-cover" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink dark:text-white">{{ m.title }}</p>
            <p class="truncate font-mono text-[11px] text-ink-soft dark:text-zinc-500">/p/{{ m.slug }}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="m.published ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-black/[0.05] text-ink-muted dark:bg-white/[0.08] dark:text-zinc-300'"
            >
              {{ m.published ? "Published" : "Draft" }}
            </span>
            <span class="text-[11px] text-ink-soft dark:text-zinc-500">{{ m.type === "image" ? "Image only" : "Article" }}</span>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";
import type { MicrositeType } from "~/shared/site-content";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Microsites — TCGo Admin" });

const { mcFetch } = useMcFetch();
const microsites = ref<{ slug: string; title: string; type: MicrositeType; imageUrl: string; published: boolean }[]>([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    microsites.value = (await mcFetch<{ microsites: typeof microsites.value }>("/api/mc/content/microsites")).microsites;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load the microsites.";
  } finally {
    loading.value = false;
  }
});
</script>

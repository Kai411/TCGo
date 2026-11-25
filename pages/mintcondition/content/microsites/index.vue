<template>
  <div class="mc-page">
    <div class="mc-page-head !mb-4">
      <div>
        <p class="mc-eyebrow mb-1">Site</p>
        <h1 class="mc-h1">Content</h1>
        <p class="mc-meta mt-1">The banners above the Marketplace and Auctions listings, and pages of your own.</p>
      </div>
    </div>
    <McContentTabs />

    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-[var(--ink-2)]">
        Pages at tcgo.shop/p/…, for a banner to link to or to share.
      </p>
      <NuxtLink
        to="/mintcondition/content/microsites/edit"
        class="mc-btn mc-btn-primary shrink-0"
      >
        New page
      </NuxtLink>
    </div>

    <p v-if="error" class="mb-4 text-sm text-[var(--danger)]">{{ error }}</p>
    <div v-if="loading" class="flex justify-center py-16">
      <div class="mc-spin" aria-label="Loading" />
    </div>
    <div v-else-if="!microsites.length" class="py-16 text-center text-sm text-[var(--ink-2)]">
      No microsites yet.
    </div>

    <ul v-else class="divide-y divide-[var(--line)] overflow-hidden mc-card">
      <li v-for="m in microsites" :key="m.slug">
        <NuxtLink
          :to="`/mintcondition/content/microsites/edit?slug=${m.slug}`"
          class="flex items-center gap-3 px-4 py-3 transition-colors active:bg-[var(--surface-2)]"
        >
          <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
            <img v-if="m.imageUrl" :src="cdnUrl(m.imageUrl, 120)" alt="" class="h-full w-full object-cover" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-[var(--ink)]">{{ m.title }}</p>
            <p class="truncate font-mono text-micro text-[var(--ink-3)]">/p/{{ m.slug }}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span class="mc-tag">
              <span class="mc-dot" :data-tone="m.published ? 'good' : undefined" aria-hidden="true" />{{ m.published ? "Published" : "Draft" }}
            </span>
            <span class="text-micro text-[var(--ink-3)]">{{ m.type === "image" ? "Image only" : "Article" }}</span>
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

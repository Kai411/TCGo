<template>
  <div class="max-w-5xl">
    <h1 class="text-xl font-bold text-ink dark:text-white">Content</h1>
    <p class="mb-4 text-sm text-ink-muted dark:text-zinc-400">
      The banners above the Marketplace and Auctions listings, and pages of your own.
    </p>
    <McContentTabs />

    <p v-if="loadError" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-ink/10 border-t-pokemon-red" />
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <section
        v-for="p in BANNER_PLACEMENTS"
        :key="p"
        class="panel min-w-0 rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.04]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-ink dark:text-white">
              {{ BANNER_PLACEMENT_LABELS[p] }} banners
            </h2>
            <p class="text-xs text-ink-muted dark:text-zinc-400">
              {{ saved[p].visible ? `Showing on ${BANNER_PLACEMENT_LABELS[p]}` : "Hidden" }}
              · {{ countLabel(saved[p].slides.length) }}
              <span v-if="saved[p].updatedAt"> · saved {{ fmt(saved[p].updatedAt) }}</span>
            </p>
          </div>
          <McSwitch
            :model-value="saved[p].visible"
            :label="`Show the ${BANNER_PLACEMENT_LABELS[p]} banners`"
            :disabled="busy[p]"
            @update:model-value="(v) => setVisible(p, v)"
          />
        </div>

        <!-- What people will see, at the width of the listing. -->
        <div class="mt-4">
          <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-500">
            Preview<span v-if="previewCount(p) > 1"> · loops every {{ BANNER_INTERVAL_MS / 1000 }} seconds</span>
          </p>
          <ListingBanner v-if="previewCount(p)" :banner="form[p]" class="!mb-0" />
          <div
            v-else
            class="flex aspect-[3/1] items-center justify-center rounded-xl border border-dashed border-black/[0.12] text-xs text-ink-soft dark:border-white/[0.14] dark:text-zinc-500"
          >
            No banners yet
          </div>
        </div>

        <!-- The rotation, in order. One banner open for editing at a time
             keeps the list short on a phone. -->
        <ol class="mt-5 space-y-2">
          <li
            v-for="(s, i) in form[p].slides"
            :key="s.id"
            class="rounded-xl border border-black/[0.08] dark:border-white/[0.10]"
          >
            <div class="flex items-center gap-2 p-2">
              <button
                type="button"
                class="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left"
                :aria-expanded="open[p] === s.id"
                @click="open[p] = open[p] === s.id ? '' : s.id"
              >
                <span class="h-9 w-[54px] shrink-0 overflow-hidden rounded-md bg-black/[0.05] dark:bg-white/[0.08]">
                  <img v-if="s.imageUrl" :src="cdnUrl(s.imageUrl, 160)" alt="" class="h-full w-full object-cover" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[11px] font-semibold text-ink-soft dark:text-zinc-500">Banner {{ i + 1 }}</span>
                  <span class="block truncate text-sm font-semibold text-ink dark:text-white">
                    {{ s.headline || (s.imageUrl ? "Image only" : "Empty") }}
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="inline-flex h-11 w-9 items-center justify-center text-ink-muted disabled:opacity-25 dark:text-zinc-400"
                :disabled="i === 0"
                :aria-label="`Move banner ${i + 1} earlier`"
                @click="move(p, i, -1)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
              </button>
              <button
                type="button"
                class="inline-flex h-11 w-9 items-center justify-center text-ink-muted disabled:opacity-25 dark:text-zinc-400"
                :disabled="i === form[p].slides.length - 1"
                :aria-label="`Move banner ${i + 1} later`"
                @click="move(p, i, 1)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <button
                type="button"
                class="inline-flex h-11 w-9 items-center justify-center text-red-600 dark:text-red-400"
                :aria-label="`Remove banner ${i + 1}`"
                @click="remove(p, i)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
              </button>
            </div>

            <div v-if="open[p] === s.id" class="space-y-4 border-t border-black/[0.06] p-3 dark:border-white/[0.08]">
              <McImageField
                v-model="s.imageUrl"
                label="Image"
                hint="3:1, for example 1500 × 500. Computers trim a little off the top and bottom, so keep words near the middle; the headline sits bottom left."
              />
              <div>
                <div class="mb-1.5 flex items-baseline justify-between">
                  <label class="text-xs font-semibold text-ink dark:text-white" :for="`${s.id}-headline`">Headline (optional)</label>
                  <span class="text-[11px] tabular-nums text-ink-soft">{{ s.headline.length }}/{{ BANNER_HEADLINE_MAX }}</span>
                </div>
                <input :id="`${s.id}-headline`" v-model="s.headline" :maxlength="BANNER_HEADLINE_MAX" type="text" class="mc-inp" placeholder="Weekend auction drop" />
              </div>
              <div>
                <div class="mb-1.5 flex items-baseline justify-between">
                  <label class="text-xs font-semibold text-ink dark:text-white" :for="`${s.id}-subtext`">Subtext (optional)</label>
                  <span class="text-[11px] tabular-nums text-ink-soft">{{ s.subtext.length }}/{{ BANNER_SUBTEXT_MAX }}</span>
                </div>
                <input :id="`${s.id}-subtext`" v-model="s.subtext" :maxlength="BANNER_SUBTEXT_MAX" type="text" class="mc-inp" placeholder="Graded slabs from RM 50" />
              </div>
              <McLinkPicker
                :key="`${s.id}-${version}`"
                v-model="s.linkPath"
                :microsites="microsites"
                @invalid="(v) => (linkInvalid[s.id] = v)"
              />
            </div>
          </li>
        </ol>

        <button
          v-if="form[p].slides.length < BANNER_SLIDES_MAX"
          type="button"
          class="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/[0.15] text-sm font-semibold text-ink-muted transition-colors active:bg-black/[0.03] dark:border-white/[0.18] dark:text-zinc-300"
          @click="add(p)"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add banner
        </button>
        <p v-else class="mt-2 text-center text-xs text-ink-soft dark:text-zinc-500">
          {{ BANNER_SLIDES_MAX }} banners is the most a page can rotate.
        </p>

        <p v-if="errors[p]" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ errors[p] }}</p>

        <div class="mt-5 flex items-center gap-3">
          <button
            type="button"
            class="min-h-[44px] rounded-lg bg-ink px-5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-ink"
            :disabled="busy[p] || !dirty(p) || anyLinkInvalid(p)"
            @click="save(p)"
          >
            {{ busy[p] ? "Saving…" : "Save" }}
          </button>
          <button
            v-if="dirty(p)"
            type="button"
            class="min-h-[44px] px-2 text-sm font-semibold text-ink-muted dark:text-zinc-400"
            :disabled="busy[p]"
            @click="discard(p)"
          >
            Discard changes
          </button>
          <span v-else-if="justSaved[p]" class="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";
import {
  BANNER_HEADLINE_MAX,
  BANNER_INTERVAL_MS,
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  BANNER_SLIDES_MAX,
  BANNER_SUBTEXT_MAX,
  emptyBanner,
  emptySlide,
  normaliseBanner,
  slideHasContent,
  type Banner,
  type BannerPlacement,
} from "~/shared/site-content";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Content — TCGo Admin" });

type ByPlacement<T> = Record<BannerPlacement, T>;
const per = <T,>(f: () => T) => Object.fromEntries(BANNER_PLACEMENTS.map((p) => [p, f()])) as ByPlacement<T>;

const { mcFetch } = useMcFetch();
const loading = ref(true);
const loadError = ref("");
const saved = reactive(per<Banner>(emptyBanner));
const form = reactive(per<Banner>(emptyBanner));
const busy = reactive(per(() => false));
const errors = reactive(per(() => ""));
const justSaved = reactive(per(() => false));
/** Which banner is open for editing, by slide id. */
const open = reactive(per(() => ""));
const linkInvalid = reactive<Record<string, boolean>>({});
const microsites = ref<{ slug: string; title: string; published: boolean }[]>([]);
const version = ref(0);

const clone = (b: Banner): Banner => ({ ...b, slides: b.slides.map((s) => ({ ...s })) });
const contentOf = (b: Banner) =>
  JSON.stringify(b.slides.map((s) => [s.imageUrl, s.headline.trim(), s.subtext.trim(), s.linkPath]));
const dirty = (p: BannerPlacement) => contentOf(form[p]) !== contentOf(saved[p]);
const previewCount = (p: BannerPlacement) => form[p].slides.filter(slideHasContent).length;
const anyLinkInvalid = (p: BannerPlacement) => form[p].slides.some((s) => linkInvalid[s.id]);
const countLabel = (n: number) => (n === 0 ? "none saved" : n === 1 ? "1 banner" : `${n} banners`);

const take = (p: BannerPlacement, b: Banner) => {
  saved[p] = normaliseBanner(b);
  form[p] = clone(saved[p]);
  if (!form[p].slides.some((s) => s.id === open[p])) open[p] = "";
};

const load = async () => {
  loading.value = true;
  loadError.value = "";
  try {
    const [b, m] = await Promise.all([
      mcFetch<{ banners: ByPlacement<Banner> }>("/api/mc/content/banners"),
      mcFetch<{ microsites: typeof microsites.value }>("/api/mc/content/microsites"),
    ]);
    for (const p of BANNER_PLACEMENTS) take(p, b.banners[p]);
    microsites.value = m.microsites;
    version.value++;
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't load the banners.";
  } finally {
    loading.value = false;
  }
};

const add = (p: BannerPlacement) => {
  const s = emptySlide();
  form[p].slides.push(s);
  open[p] = s.id;
};
const move = (p: BannerPlacement, i: number, by: -1 | 1) => {
  const list = form[p].slides;
  const [s] = list.splice(i, 1);
  list.splice(i + by, 0, s!);
};
const remove = (p: BannerPlacement, i: number) => {
  const s = form[p].slides[i]!;
  if (slideHasContent(s) && !confirm(`Remove banner ${i + 1}? It goes once you save.`)) return;
  form[p].slides.splice(i, 1);
  delete linkInvalid[s.id];
};

const post = async (p: BannerPlacement, body: Banner) => {
  busy[p] = true;
  errors[p] = "";
  try {
    const res = await mcFetch<{ banner: Banner }>("/api/mc/content/banner", {
      method: "POST",
      body: { placement: p, visible: body.visible, slides: body.slides },
    });
    return res.banner;
  } catch (e: any) {
    errors[p] = e?.data?.message || e?.message || "Couldn't save the banners.";
    return null;
  } finally {
    busy[p] = false;
  }
};

const save = async (p: BannerPlacement) => {
  const banner = await post(p, { ...form[p], visible: saved[p].visible });
  if (!banner) return;
  take(p, banner);
  justSaved[p] = true;
  setTimeout(() => (justSaved[p] = false), 2000);
};

// The switch takes effect at once with the saved banners, so hiding them is
// one tap. Unsaved edits stay in the form.
const setVisible = async (p: BannerPlacement, visible: boolean) => {
  const banner = await post(p, { ...saved[p], visible });
  if (!banner) return;
  saved[p] = normaliseBanner(banner);
};

const discard = (p: BannerPlacement) => {
  form[p] = clone(saved[p]);
  errors[p] = "";
  version.value++;
};

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>

<template>
  <div class="max-w-5xl">
    <h1 class="text-xl font-bold text-ink dark:text-white">Content</h1>
    <p class="mb-4 text-sm text-ink-muted dark:text-zinc-400">
      The banners above the Shop and Auctions listings, and pages of your own.
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
        class="panel rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.04]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-ink dark:text-white">
              {{ BANNER_PLACEMENT_LABELS[p] }} banner
            </h2>
            <p class="text-xs text-ink-muted dark:text-zinc-400">
              {{ saved[p].visible ? `Showing on ${BANNER_PLACEMENT_LABELS[p]}` : "Hidden" }}
              <span v-if="saved[p].updatedAt"> · saved {{ fmt(saved[p].updatedAt) }}</span>
            </p>
          </div>
          <McSwitch
            :model-value="saved[p].visible"
            :label="`Show the ${BANNER_PLACEMENT_LABELS[p]} banner`"
            :disabled="busy[p]"
            @update:model-value="(v) => setVisible(p, v)"
          />
        </div>

        <!-- What people will see, at the width of the listing. -->
        <div class="mt-4">
          <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-500">Preview</p>
          <ListingBanner v-if="hasContent(form[p])" :banner="form[p]" class="!mb-0" />
          <div
            v-else
            class="flex aspect-[3/1] items-center justify-center rounded-xl border border-dashed border-black/[0.12] text-xs text-ink-soft dark:border-white/[0.14] dark:text-zinc-500"
          >
            Add an image or a headline
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <McImageField
            v-model="form[p].imageUrl"
            label="Image"
            hint="3:1, for example 1500 × 500. Computers trim a little off the top and bottom, so keep words near the middle; the headline sits bottom left."
          />
          <div>
            <div class="mb-1.5 flex items-baseline justify-between">
              <label class="text-xs font-semibold text-ink dark:text-white" :for="`${p}-headline`">Headline (optional)</label>
              <span class="text-[11px] tabular-nums text-ink-soft">{{ form[p].headline.length }}/{{ BANNER_HEADLINE_MAX }}</span>
            </div>
            <input :id="`${p}-headline`" v-model="form[p].headline" :maxlength="BANNER_HEADLINE_MAX" type="text" class="mc-inp" placeholder="Weekend auction drop" />
          </div>
          <div>
            <div class="mb-1.5 flex items-baseline justify-between">
              <label class="text-xs font-semibold text-ink dark:text-white" :for="`${p}-subtext`">Subtext (optional)</label>
              <span class="text-[11px] tabular-nums text-ink-soft">{{ form[p].subtext.length }}/{{ BANNER_SUBTEXT_MAX }}</span>
            </div>
            <input :id="`${p}-subtext`" v-model="form[p].subtext" :maxlength="BANNER_SUBTEXT_MAX" type="text" class="mc-inp" placeholder="Graded slabs from RM 50" />
          </div>
          <McLinkPicker
            :key="`${p}-${version}`"
            v-model="form[p].linkPath"
            :microsites="microsites"
            @invalid="(v) => (linkInvalid[p] = v)"
          />
        </div>

        <p v-if="errors[p]" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ errors[p] }}</p>

        <div class="mt-5 flex items-center gap-3">
          <button
            type="button"
            class="min-h-[44px] rounded-lg bg-ink px-5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-ink"
            :disabled="busy[p] || !dirty(p) || linkInvalid[p]"
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
import {
  BANNER_HEADLINE_MAX,
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  BANNER_SUBTEXT_MAX,
  emptyBanner,
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
const linkInvalid = reactive(per(() => false));
const microsites = ref<{ slug: string; title: string; published: boolean }[]>([]);
const version = ref(0);

const FIELDS = ["imageUrl", "headline", "subtext", "linkPath"] as const;
const dirty = (p: BannerPlacement) => FIELDS.some((k) => form[p][k].trim() !== saved[p][k]);
const hasContent = (b: Banner) => !!(b.imageUrl || b.headline.trim());

const take = (p: BannerPlacement, b: Banner) => {
  saved[p] = { ...emptyBanner(), ...b };
  form[p] = { ...saved[p] };
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

const post = async (p: BannerPlacement, body: Banner) => {
  busy[p] = true;
  errors[p] = "";
  try {
    const res = await mcFetch<{ banner: Banner }>("/api/mc/content/banner", {
      method: "POST",
      body: { placement: p, ...body },
    });
    return res.banner;
  } catch (e: any) {
    errors[p] = e?.data?.message || e?.message || "Couldn't save the banner.";
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

// The switch takes effect at once with the saved content, so hiding a banner
// is one tap. Unsaved edits stay in the form.
const setVisible = async (p: BannerPlacement, visible: boolean) => {
  const banner = await post(p, { ...saved[p], visible });
  if (!banner) return;
  saved[p] = { ...emptyBanner(), ...banner };
};

const discard = (p: BannerPlacement) => {
  form[p] = { ...saved[p] };
  errors[p] = "";
  version.value++;
};

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>

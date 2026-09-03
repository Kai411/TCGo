<template>
  <div class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 lg:col-span-2">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-ink dark:text-zinc-100">Find your card</h3>
        <p class="text-xs text-ink-soft dark:text-zinc-500 mt-0.5">
          Search the TCGo catalogue to auto-fill the details and see the market price.
        </p>
      </div>
      <span v-if="picked" class="chip chip-accent shrink-0">Matched</span>
    </div>

    <!-- Search -->
    <form class="flex gap-2 mt-3" @submit.prevent="runSearch()">
      <input
        v-model="q"
        type="search"
        enterkeyhint="search"
        placeholder='e.g. "charizard 151" or "pikachu 025/165"'
        class="flex-1 min-w-0 bg-white border border-gray-300 dark:border-white/[0.10] rounded-lg px-4 py-2 text-sm text-ink dark:text-zinc-100 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
      />
      <button
        type="submit"
        :disabled="loading || q.trim().length < 2"
        class="shrink-0 bg-ink text-white dark:bg-white dark:text-ink text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {{ loading ? "Searching…" : "Search" }}
      </button>
    </form>

    <!-- Suggestions driven by what the seller typed into the form below.
         This is the "manual entry" path: they fill in a name/number by hand
         and we surface catalogue rows that match so one click still gets them
         a verified card and a price trend. -->
    <div
      v-if="!results.length && !picked && suggestions.length"
      class="mt-3"
    >
      <p class="text-[11px] font-semibold text-ink-muted dark:text-zinc-400 mb-2">
        Matches for what you typed — click one to confirm
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <CardSearchResult
          v-for="c in suggestions"
          :key="c.productId"
          :card="c"
          @select="choose(c)"
        />
      </div>
    </div>

    <!-- Search results -->
    <div v-if="loading" class="flex justify-center py-6">
      <div class="animate-spin rounded-full h-5 w-5 border-2 border-ink/10 border-t-pokemon-red" />
    </div>
    <p
      v-else-if="searched && !results.length"
      class="mt-3 text-xs text-ink-muted dark:text-zinc-400"
    >
      No catalogue match. You can still fill the details in by hand below.
    </p>
    <div v-else-if="results.length" class="mt-3">
      <!-- Pager sits above the grid: it's the control you reach for after
           scanning a page, and putting it below meant scrolling past the
           results every single time. -->
      <div class="mb-2 flex items-center justify-between gap-3">
        <p class="text-[11px] text-ink-muted dark:text-zinc-400 tabular-price">
          {{ total }} result{{ total === 1 ? "" : "s" }}
        </p>
        <div v-if="totalPages > 1" class="flex items-center gap-1">
          <button
            type="button"
            :disabled="page === 0 || loading"
            @click="goToPage(page - 1)"
            aria-label="Previous page"
            class="p-1 rounded-md text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span class="text-[11px] font-semibold tabular-price text-ink dark:text-white min-w-[3.5rem] text-center">
            {{ page + 1 }} / {{ totalPages }}
          </span>
          <button
            type="button"
            :disabled="page >= totalPages - 1 || loading"
            @click="goToPage(page + 1)"
            aria-label="Next page"
            class="p-1 rounded-md text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <CardSearchResult
          v-for="c in results"
          :key="c.productId"
          :card="c"
          :selected="picked?.productId === c.productId"
          @select="choose(c)"
        />
      </div>
    </div>

    <!-- Picked card + real price trend -->
    <div
      v-if="picked"
      class="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]"
    >
      <div class="flex items-start gap-3 mb-4">
        <div class="w-14 shrink-0 rounded-lg overflow-hidden bg-canvas-sunken">
          <CardImage :src="picked.imageUrl ?? ''" :alt="picked.name" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-ink dark:text-white truncate">{{ picked.name }}</p>
          <p class="text-xs text-ink-muted dark:text-zinc-400 truncate">
            {{ picked.setName }}<span v-if="picked.number"> · {{ picked.number }}</span>
          </p>
          <p v-if="picked.price" class="text-xs text-ink-soft dark:text-zinc-500 mt-0.5 tabular-price">
            Range RM {{ picked.price.low.toFixed(2) }}–{{ picked.price.high.toFixed(2) }}
            <span class="opacity-70">({{ picked.price.subtype }})</span>
          </p>
        </div>
        <button
          type="button"
          @click="clear"
          class="shrink-0 text-[11px] font-semibold text-ink-muted dark:text-zinc-400 hover:text-pokemon-red transition-colors"
        >
          Change
        </button>
      </div>

      <PriceTrendChart :trend="trend" :loading="trendLoading" :height="110" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CatalogMatch, PriceTrend } from "~/composables/useCardCatalog";

const props = defineProps<{
  /** Free-text built from the form fields, used for the manual-entry suggestions. */
  manualQuery?: string;
  language?: string;
}>();

const emit = defineEmits<{ (e: "select", card: CatalogMatch): void }>();

const { searchCatalog, getPriceHistory, listSets } = useCardCatalog();

// Set names, fetched once and reused, so a worded set in the query ("pikachu
// surging sparks") can be recognised. Failure is silent and harmless: without
// the list the query simply falls back to name-only matching.
const setNames = ref<string[]>([]);
const loadSets = async () => {
  if (setNames.value.length) return;
  try {
    setNames.value = (await listSets(lang.value)).map((s) => s.name).filter(Boolean);
  } catch {
    setNames.value = [];
  }
};

const q = ref("");
const results = ref<CatalogMatch[]>([]);
const suggestions = ref<CatalogMatch[]>([]);
const loading = ref(false);
const searched = ref(false);
const picked = ref<CatalogMatch | null>(null);
const trend = ref<PriceTrend | null>(null);
const trendLoading = ref(false);

const lang = computed(() => (props.language === "JP" ? "JP" : "EN") as "EN" | "JP");

/** Results per page. */
const PAGE_SIZE = 8;

const total = ref(0);
const page = ref(0);
// Frozen at search time: `q` keeps changing as the seller types, but paging
// must keep querying whatever was actually searched.
const lastQuery = ref("");
// The set and rarity pulled out of the typed query.
//
// The catalogue RPC matches `q` against the card NAME only — set and rarity
// are separate arguments. Sending the whole phrase as a name is why
// "pikachu IR" and "pikachu surging sparks" returned nothing here while the
// same words worked on the collection page: no card is *named* those things.
// parseSmartQuery is what that page uses, and this now uses it too.
const lastSetHint = ref<string | null>(null);
const lastRarityHint = ref<string | null>(null);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

/** Fetch one page, replacing what's on screen. */
const fetchPage = async (n: number) => {
  loading.value = true;
  try {
    const { results: r, total: t } = await searchCatalog(lastQuery.value, {
      limit: PAGE_SIZE,
      page: n,
      language: lang.value,
      setMatch: lastSetHint.value,
      rarityMatch: lastRarityHint.value,
    });
    results.value = r;
    // Trust the latest count so "x / y" can't drift mid-browse.
    total.value = t || total.value;
    page.value = n;
  } finally {
    loading.value = false;
  }
};

const runSearch = async () => {
  const raw = q.value.trim();
  if (raw.length < 2) return;

  await loadSets();
  // Set name first — it can be several words, so taking it off the end leaves
  // parseSmartQuery a cleaner string to read rarity and numeric hints from.
  const { name: withoutSet, setHint } = splitKnownSet(raw, setNames.value);
  const parsed = parseSmartQuery(withoutSet || raw);
  // A query that is ONLY a filter is still searchable — "surging sparks"
  // with no card name should list the set. searchCatalog allows a short name
  // when a filter is present.
  if (parsed.name.trim().length < 2 && !setHint && !parsed.setHint && !parsed.rarityHint) return;

  searched.value = true;
  lastQuery.value = parsed.name.trim();
  lastSetHint.value = setHint ?? parsed.setHint;
  lastRarityHint.value = parsed.rarityHint;
  total.value = 0;
  await fetchPage(0);
};

const goToPage = async (n: number) => {
  if (loading.value) return;
  const target = Math.min(Math.max(0, n), totalPages.value - 1);
  if (target === page.value) return;
  await fetchPage(target);
};

const choose = async (card: CatalogMatch) => {
  picked.value = card;
  results.value = [];
  suggestions.value = [];
  total.value = 0;
  page.value = 0;
  emit("select", card);

  trendLoading.value = true;
  trend.value = null;
  try {
    trend.value = await getPriceHistory(card.productId, 90);
  } finally {
    trendLoading.value = false;
  }
};

const clear = () => {
  picked.value = null;
  trend.value = null;
  searched.value = false;
  total.value = 0;
  page.value = 0;
};

// ── Manual-entry suggestions ─────────────────────────────────────────
// Debounced so typing a card name by hand doesn't fire a query per keystroke.
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.manualQuery,
  (val) => {
    clearTimeout(timer);
    const query = (val ?? "").trim();
    // Don't compete with an explicit search or an already-confirmed card.
    if (picked.value || results.value.length || query.length < 3) {
      suggestions.value = [];
      return;
    }
    timer = setTimeout(async () => {
      await loadSets();
      const { name: noSet, setHint: sh } = splitKnownSet(query, setNames.value);
      const parsed = parseSmartQuery(noSet || query);
      const { results: r } = await searchCatalog(parsed.name.trim(), {
        limit: 4,
        language: lang.value,
        setMatch: sh ?? parsed.setHint,
        rarityMatch: parsed.rarityHint,
      });
      // The field may have changed again while the request was in flight.
      if (!picked.value && !results.value.length) suggestions.value = r;
    }, 450);
  },
);

onUnmounted(() => clearTimeout(timer));
</script>

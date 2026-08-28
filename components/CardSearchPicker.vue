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
      <p class="mb-2 text-[11px] text-ink-muted dark:text-zinc-400 tabular-price">
        Showing {{ results.length }} of {{ total }}
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <CardSearchResult
          v-for="c in results"
          :key="c.productId"
          :card="c"
          :selected="picked?.productId === c.productId"
          @select="choose(c)"
        />
      </div>

      <!-- Append rather than replace: the seller is scanning for one specific
           printing, and paging would throw away everything already on screen
           (and their scroll position) each time. -->
      <button
        v-if="hasMore"
        type="button"
        :disabled="loadingMore"
        @click="loadMore"
        class="mt-3 w-full py-2 rounded-lg text-xs font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink-muted dark:text-zinc-300 hover:text-ink dark:hover:text-white hover:border-black/25 dark:hover:border-white/25 transition-colors disabled:opacity-50"
      >
        {{ loadingMore ? "Loading…" : `Load ${nextBatchSize} more` }}
      </button>
      <p
        v-else-if="results.length >= PAGE_SIZE"
        class="mt-3 text-center text-[11px] text-ink-soft dark:text-zinc-500"
      >
        That's everything matching "{{ lastQuery }}".
      </p>
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

const { searchCatalog, getPriceHistory } = useCardCatalog();

const q = ref("");
const results = ref<CatalogMatch[]>([]);
const suggestions = ref<CatalogMatch[]>([]);
const loading = ref(false);
const searched = ref(false);
const picked = ref<CatalogMatch | null>(null);
const trend = ref<PriceTrend | null>(null);
const trendLoading = ref(false);

const lang = computed(() => (props.language === "JP" ? "JP" : "EN") as "EN" | "JP");

/** Results per request. Also the "Load N more" batch size. */
const PAGE_SIZE = 8;

const total = ref(0);
const page = ref(0);
const loadingMore = ref(false);
// Frozen at search time: `q` keeps changing as the seller types, and the
// "that's everything" line should name what was actually searched.
const lastQuery = ref("");

const hasMore = computed(() => results.value.length < total.value);
const nextBatchSize = computed(() =>
  Math.min(PAGE_SIZE, Math.max(0, total.value - results.value.length)),
);

const runSearch = async () => {
  const query = q.value.trim();
  if (query.length < 2) return;
  loading.value = true;
  searched.value = true;
  page.value = 0;
  lastQuery.value = query;
  try {
    const { results: r, total: t } = await searchCatalog(query, {
      limit: PAGE_SIZE,
      page: 0,
      language: lang.value,
    });
    results.value = r;
    total.value = t;
  } finally {
    loading.value = false;
  }
};

const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  const next = page.value + 1;
  try {
    const { results: r, total: t } = await searchCatalog(lastQuery.value, {
      limit: PAGE_SIZE,
      page: next,
      language: lang.value,
    });
    // The RPC re-counts per page; trust the latest figure so the "of N" line
    // doesn't drift if the catalogue changes mid-browse.
    total.value = t || total.value;
    // Guard against a page that overlaps the previous one — a duplicate
    // productId would break the :key and render the same card twice.
    const seen = new Set(results.value.map((c) => c.productId));
    results.value = [...results.value, ...r.filter((c) => !seen.has(c.productId))];
    page.value = next;
    // A page that adds nothing new means we're at the end whatever the count
    // claims; stop offering more.
    if (!r.length) total.value = results.value.length;
  } finally {
    loadingMore.value = false;
  }
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
      const { results: r } = await searchCatalog(query, { limit: 4, language: lang.value });
      // The field may have changed again while the request was in flight.
      if (!picked.value && !results.value.length) suggestions.value = r;
    }, 450);
  },
);

onUnmounted(() => clearTimeout(timer));
</script>

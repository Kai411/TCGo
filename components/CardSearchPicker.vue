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

const runSearch = async () => {
  const query = q.value.trim();
  if (query.length < 2) return;
  loading.value = true;
  searched.value = true;
  try {
    const { results: r } = await searchCatalog(query, { limit: 8, language: lang.value });
    results.value = r;
  } finally {
    loading.value = false;
  }
};

const choose = async (card: CatalogMatch) => {
  picked.value = card;
  results.value = [];
  suggestions.value = [];
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

<template>
  <div>
    <!-- ── Sticky top: summary + search/filter ─────────────────────── -->
    <div
      class="sticky top-16 lg:top-[116px] z-30 -mx-4 px-4 bg-canvas/95 dark:bg-canvas-inverse/95 backdrop-blur border-b border-black/[0.06] dark:border-white/[0.08]"
    >
      <!-- Summary strip → links to the full collection on the profile -->

      <div class="min-w-0">
        <p class="font-bold text-ink dark:text-white leading-tight py-2"></p>
      </div>

      <!-- Search row: [scanner] [search] [filter] -->
      <div class="flex items-center gap-2 pb-3">
        <!-- Scanner placeholder — not yet implemented -->
        <button
          type="button"
          disabled
          title="Card scanner — coming soon"
          class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 dark:border-white/[0.10] text-gray-400 dark:text-zinc-600 opacity-60 cursor-not-allowed"
          aria-label="Scan card (coming soon)"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"
            />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>

        <!-- Search input — Enter dispatches the search -->
        <div class="relative flex-1 min-w-0">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="searchInput"
            type="search"
            enterkeyhint="search"
            placeholder='Search — e.g. "pikachu 151", "charizard ir"'
            class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white focus:border-pokemon-blue focus:outline-none"
            @keydown.enter.prevent="runSearch"
          />
        </div>

        <!-- Filter toggle -->
        <button
          type="button"
          @click="filtersOpen = !filtersOpen"
          class="relative shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border transition-colors"
          :class="
            filtersOpen || hasActiveFilters
              ? 'border-pokemon-red text-pokemon-red bg-pokemon-red/5'
              : 'border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300'
          "
          aria-label="Sort and filter"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          <span
            v-if="hasActiveFilters"
            class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pokemon-red"
          />
        </button>

        <!-- "Your collection" only exists once there's an account. A guest
             gets the same row pointed at sign-in rather than a dead link to
             /profile/undefined. -->
        <NuxtLink
          :to="user ? `/profile/${user.uid}?tab=collection` : { path: '/login', query: { next: $route.fullPath } }"
          class="flex items-center justify-between gap-3 py-3 group"
        >
          <span
            class="shrink-0 inline-flex items-center gap-0.5 text-ink-muted dark:text-zinc-400 group-hover:text-pokemon-red transition-colors"
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </NuxtLink>
      </div>

      <!-- Expandable Sort + Filter panel -->
      <Transition
        enter-active-class="transition-all duration-200"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition-all duration-150"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="filtersOpen" class="pb-3">
          <div
            class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 space-y-3"
          >
            <!-- Sort -->
            <div>
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5"
              >
                Sort
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="opt in sortOptions"
                  :key="opt.value"
                  type="button"
                  @click="sortBy = opt.value"
                  class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors"
                  :class="
                    sortBy === opt.value
                      ? 'bg-pokemon-red text-white border-pokemon-red'
                      : 'border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300'
                  "
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Filter -->
            <div>
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5"
              >
                Filter
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  v-model="setFilter"
                  class="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
                >
                  <option value="">All sets</option>
                  <option v-for="s in sets" :key="s.name" :value="s.name">
                    {{ s.name }} ({{ s.count }})
                  </option>
                </select>
                <select
                  v-model="rarityFilter"
                  class="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
                >
                  <option value="">All rarities</option>
                  <option v-for="r in rarities" :key="r.name" :value="r.name">
                    {{ r.name }} ({{ r.count }})
                  </option>
                </select>
              </div>
            </div>

            <div class="flex gap-2 pt-1">
              <button
                type="button"
                @click="resetFilters"
                class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200"
              >
                Reset
              </button>
              <button
                type="button"
                @click="applyFilters"
                class="flex-1 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Portfolio value + trend ─────────────────────────────────
         Hidden while searching: the point of a search is to look at
         candidates, not at what you already own. -->
    <section v-if="!showingSearch && count > 0" class="pt-5">
      <div class="surface rounded-2xl p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Estimated value</p>
            <p
              class="mt-2 text-3xl sm:text-4xl font-bold text-ink dark:text-white tabular-price leading-none tracking-tightest"
            >
              RM {{ formatMyr(totalValue) }}
            </p>
            <p class="mt-1.5 text-xs text-ink-soft dark:text-zinc-500">
              {{ count }} card{{ count === 1 ? "" : "s"
              }}<template v-if="totalCopies !== count">
                · {{ totalCopies }} copies</template
              >
              <template
                v-if="
                  valueTrend.trackedCards && valueTrend.trackedCards < count
                "
              >
                · trend from {{ valueTrend.trackedCards }} with price history
              </template>
            </p>
          </div>
        </div>

        <div class="mt-4">
          <PriceTrendChart
            :trend="valueTrend.trend"
            :loading="trendLoading"
            :height="120"
            :show-header="false"
          />
        </div>
      </div>
    </section>

    <!-- ── Your collection ─────────────────────────────────────────── -->
    <section v-if="!showingSearch" class="pt-5">
      <div v-if="collectionLoading" class="flex justify-center py-16">
        <div
          class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <div v-else-if="!collectionCards.length" class="text-center py-16">
        <p class="text-ink dark:text-white font-semibold">
          Your collection is empty
        </p>
        <p
          class="text-sm text-ink-muted dark:text-zinc-400 mt-1 max-w-sm mx-auto"
        >
          Search the TCGo catalogue above and tap + on any card to start
          tracking it.
        </p>
      </div>

      <template v-else>
        <div class="flex items-center justify-between mb-3">
          <h2
            class="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-zinc-400"
          >
            Your collection
          </h2>
          <span
            class="text-[11px] text-ink-soft dark:text-zinc-500 tabular-price"
          >
            {{ collectionCards.length }} card{{
              collectionCards.length === 1 ? "" : "s"
            }}
          </span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CollectionItemCard
            v-for="card in collectionCards"
            :key="card.productId"
            :card="card"
            :in-collection="true"
            show-quantity
            :quantity="quantityOf(card.productId)"
            :busy="busyIds.has(card.productId)"
            @increment="handleIncrement(card.productId)"
            @decrement="handleDecrement(card.productId)"
          />
        </div>
      </template>
    </section>

    <!-- ── Search results ──────────────────────────────────────────── -->
    <div v-else class="pt-5">
      <div
        v-if="searchLoading && searchResults.length === 0"
        class="flex justify-center py-16"
      >
        <div
          class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <p
        v-else-if="searchResults.length === 0"
        class="text-center text-ink-soft dark:text-zinc-500 py-16"
      >
        No matches. Try a different name, set, or rarity.
      </p>

      <template v-else>
        <div class="flex items-center justify-between mb-3 gap-3">
          <h2
            class="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-zinc-400"
          >
            Search results
          </h2>
          <div class="flex items-center gap-3">
            <span
              class="text-[11px] text-ink-soft dark:text-zinc-500 tabular-price"
            >
              {{ searchResults.length }} of {{ searchTotal }}
            </span>
            <button
              type="button"
              @click="clearSearch"
              class="text-[11px] font-semibold text-pokemon-red hover:underline"
            >
              Back to collection
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CollectionItemCard
            v-for="card in searchResults"
            :key="card.productId"
            :card="card"
            :in-collection="isInCollection(card.productId)"
            :quantity="quantityOf(card.productId)"
            :busy="busyIds.has(card.productId)"
            @toggle="handleToggle(card.productId)"
          />
        </div>
        <div v-if="hasMoreResults" class="mt-4 flex justify-center">
          <button
            @click="loadMore"
            :disabled="searchLoading"
            class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-60"
          >
            <span v-if="searchLoading">Loading…</span>
            <span v-else
              >Load
              {{
                Math.min(SEARCH_PAGE_SIZE, searchTotal - searchResults.length)
              }}
              more</span
            >
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  parseSmartQuery,
  type CatalogMatch,
  type CatalogSort,
  type CollectionPriceTrend,
} from "~/composables/useCardCatalog";

useHead({ title: "Add Cards | TCGo Marketplace" });

const SEARCH_PAGE_SIZE = 28;

const { user } = useAuth();
const { requireSignIn } = useSignInGate();
const {
  searchCatalog,
  getCardsByIds,
  listSets,
  listRarities,
  getCollectionPriceTrend,
} = useCardCatalog();
const {
  entries,
  count,
  totalCopies,
  isInCollection,
  quantities,
  quantityOf,
  addCopy,
  removeCopy,
  toggleInCollection,
  listenMyCollection,
} = useUserCollection();

onMounted(() => {
  if (user.value) listenMyCollection();
  loadDropdowns();
});
watch(user, (u) => {
  if (u) listenMyCollection();
});

// ── Filter dropdown data ──────────────────────────────────────────────
const sets = ref<Array<{ name: string; count: number }>>([]);
const rarities = ref<Array<{ name: string; count: number }>>([]);
const loadDropdowns = async () => {
  const [s, r] = await Promise.all([listSets("EN"), listRarities("EN")]);
  sets.value = s;
  rarities.value = r;
};

// ── Search + filter state ─────────────────────────────────────────────
const sortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "best", label: "Best match" },
  { value: "name", label: "Name A–Z" },
  { value: "price_desc", label: "Price ↓" },
  { value: "price_asc", label: "Price ↑" },
];

const searchInput = ref("");
const appliedQuery = ref("");
const setFilter = ref("");
const rarityFilter = ref("");
const sortBy = ref<CatalogSort>("best");
const filtersOpen = ref(false);

const hasActiveFilters = computed(
  () => !!setFilter.value || !!rarityFilter.value || sortBy.value !== "best",
);

const parsed = computed(() => parseSmartQuery(appliedQuery.value));
const effectiveSetMatch = computed(
  () => parsed.value.setHint || setFilter.value || null,
);
const effectiveRarityMatch = computed(
  () => parsed.value.rarityHint || rarityFilter.value || null,
);

const searchResults = ref<CatalogMatch[]>([]);
const searchTotal = ref(0);
const searchPage = ref(0);
const searchLoading = ref(false);
const hasRunSearch = ref(false);

// Search replaces the collection view rather than stacking below it — the
// page is either "what I own" or "what I might add", never both at once.
const showingSearch = computed(() => hasRunSearch.value);

const clearSearch = () => {
  searchInput.value = "";
  appliedQuery.value = "";
  searchResults.value = [];
  searchTotal.value = 0;
  searchPage.value = 0;
  hasRunSearch.value = false;
};

const hasMoreResults = computed(
  () => searchResults.value.length < searchTotal.value,
);

const runSearch = async () => {
  appliedQuery.value = searchInput.value;
  const trimmed = parsed.value.name.trim();
  // Need a name (≥2) OR a filter to search.
  if (
    trimmed.length < 2 &&
    !effectiveSetMatch.value &&
    !effectiveRarityMatch.value
  ) {
    return;
  }
  searchPage.value = 0;
  hasRunSearch.value = true;
  searchLoading.value = true;
  const { results, total } = await searchCatalog(trimmed, {
    limit: SEARCH_PAGE_SIZE,
    page: 0,
    language: "EN",
    setMatch: effectiveSetMatch.value,
    rarityMatch: effectiveRarityMatch.value,
    sort: sortBy.value,
  });
  searchResults.value = results;
  searchTotal.value = total;
  searchLoading.value = false;
};

const loadMore = async () => {
  if (searchLoading.value || !hasMoreResults.value) return;
  searchLoading.value = true;
  const nextPage = searchPage.value + 1;
  const { results } = await searchCatalog(parsed.value.name.trim(), {
    limit: SEARCH_PAGE_SIZE,
    page: nextPage,
    language: "EN",
    setMatch: effectiveSetMatch.value,
    rarityMatch: effectiveRarityMatch.value,
    sort: sortBy.value,
  });
  searchResults.value = [...searchResults.value, ...results];
  searchPage.value = nextPage;
  searchLoading.value = false;
};

const applyFilters = () => {
  filtersOpen.value = false;
  runSearch();
};

const resetFilters = () => {
  setFilter.value = "";
  rarityFilter.value = "";
  sortBy.value = "best";
  if (hasRunSearch.value) runSearch();
};

// ── Collection summary (for the sticky header) ────────────────────────
// Hydrate the pivot productIds so we can sum a live estimated value.
const collectionCards = ref<CatalogMatch[]>([]);
const collectionLoading = ref(false);
const collectionProductIds = computed(() =>
  [...entries.value]
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((e) => e.productId),
);

// Portfolio trend over the same basket. getCollectionPriceTrend holds the
// basket fixed across every point, so a card with a short history can't fake a
// jump by entering the series midway — see useCardCatalog.
const valueTrend = ref<CollectionPriceTrend>({
  trend: null,
  trackedCards: 0,
  historyCards: 0,
  totalCards: 0,
});
const trendLoading = ref(false);

watch(
  collectionProductIds,
  async (ids) => {
    if (!ids.length) {
      collectionCards.value = [];
      valueTrend.value = {
        trend: null,
        trackedCards: 0,
        historyCards: 0,
        totalCards: 0,
      };
      return;
    }
    collectionLoading.value = true;
    trendLoading.value = true;
    try {
      // getCardsByIds does not guarantee input order, so re-sort into the
      // newest-first order the ids were built in.
      const cards = await getCardsByIds(ids);
      const rank = new Map(ids.map((id, i) => [id, i]));
      collectionCards.value = [...cards].sort(
        (a, b) => (rank.get(a.productId) ?? 0) - (rank.get(b.productId) ?? 0),
      );
    } finally {
      collectionLoading.value = false;
    }
    try {
      valueTrend.value = await getCollectionPriceTrend(
        ids,
        30,
        quantities.value,
      );
    } finally {
      trendLoading.value = false;
    }
  },
  { immediate: true },
);
const totalValue = computed(() =>
  // Weighted by copies — owning four of a card is four times the value.
  collectionCards.value.reduce(
    (sum, c) => sum + (c.price?.market ?? 0) * quantityOf(c.productId),
    0,
  ),
);

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Per-card in-flight guard. A shared boolean would freeze the whole grid
// while one card saved.
const busyIds = ref<Set<number>>(new Set());

const withBusy = async (productId: number, fn: () => Promise<void>) => {
  if (busyIds.value.has(productId)) return;
  busyIds.value = new Set(busyIds.value).add(productId);
  try {
    await fn();
  } catch (err) {
    console.error("[collection] update failed:", err);
  } finally {
    const next = new Set(busyIds.value);
    next.delete(productId);
    busyIds.value = next;
  }
};

const handleToggle = (productId: number) => {
  // Browsing is open; adding needs an account.
  if (!requireSignIn()) return;
  withBusy(productId, () => toggleInCollection(productId));
};

const handleIncrement = (productId: number) =>
  withBusy(productId, () => addCopy(productId));

const handleDecrement = (productId: number) =>
  withBusy(productId, () => removeCopy(productId));
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">
        Sign in to track your collection.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-ink dark:text-white">My Collection</h1>
          <p class="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {{ count }} {{ count === 1 ? "card" : "cards" }}
            <span v-if="totalValue !== null" class="ml-2">
              · est. value
              <span class="font-semibold text-ink dark:text-white">{{ formatMyr(totalValue) }} MYR</span>
            </span>
          </p>
        </div>
      </div>

      <!-- Search panel -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 mb-6">
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
          Add a card to your collection
        </label>

        <form @submit.prevent="runSearch" class="space-y-3">
          <!-- Search input + button row -->
          <div class="flex gap-2">
            <div class="relative flex-1">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                v-model="searchInput"
                type="text"
                placeholder='Try "pikachu", "pikachu 151", "charizard ir"…'
                class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white focus:border-pokemon-blue focus:outline-none"
              />
            </div>
            <button
              type="submit"
              class="px-4 py-2.5 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
            >
              Search
            </button>
          </div>

          <!-- Filter row -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            <select
              v-model="sortBy"
              class="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
            >
              <option value="best">Best match</option>
              <option value="name">Name (A–Z)</option>
              <option value="price_desc">Price (high → low)</option>
              <option value="price_asc">Price (low → high)</option>
            </select>
          </div>

          <!-- Active filter chips (auto-parsed + explicit). Surfaces what
               the smart parser found so the user can see why results look
               the way they do. -->
          <div
            v-if="activeChips.length"
            class="flex flex-wrap items-center gap-2 pt-1"
          >
            <span class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Filters:
            </span>
            <span
              v-for="chip in activeChips"
              :key="chip.label"
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-pokemon-blue/10 text-pokemon-blue dark:bg-pokemon-blue/20 dark:text-blue-300"
            >
              {{ chip.label }}
              <button
                v-if="chip.clear"
                type="button"
                @click="chip.clear"
                class="hover:text-blue-700 dark:hover:text-white"
                aria-label="Clear"
              >×</button>
            </span>
          </div>
        </form>

        <!-- Results -->
        <div v-if="searchLoading && searchResults.length === 0" class="flex justify-center py-6">
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-ink/10 border-t-pokemon-red"/>
        </div>
        <p
          v-else-if="hasRunSearch && searchResults.length === 0"
          class="text-sm text-gray-400 dark:text-zinc-500 text-center py-6"
        >
          No matches. Try a different name, set, or rarity.
        </p>
        <template v-else-if="searchResults.length > 0">
          <p class="mt-4 text-[11px] text-gray-500 dark:text-zinc-400">
            Showing {{ searchResults.length }} of {{ searchTotal }} result{{ searchTotal === 1 ? "" : "s" }}
          </p>
          <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <CollectionItemCard
              v-for="card in searchResults"
              :key="card.productId"
              :card="card"
              :in-collection="isInCollection(card.productId)"
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
              <span v-else>Load {{ Math.min(SEARCH_PAGE_SIZE, searchTotal - searchResults.length) }} more</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Collection grid -->
      <div v-if="collectionLoading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <template v-else-if="count === 0">
        <div class="surface rounded-2xl py-16 text-center">
          <p class="text-lg font-semibold text-ink dark:text-white">Your collection is empty</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Use the search above to add cards you own.
          </p>
        </div>
      </template>

      <template v-else>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
          My cards
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <CollectionItemCard
            v-for="card in collectionCards"
            :key="card.productId"
            :card="card"
            in-collection
            @toggle="handleToggle(card.productId)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  parseSmartQuery,
  type CatalogMatch,
  type CatalogSort,
} from "~/composables/useCardCatalog";

useHead({ title: "My Collection | TCGo Marketplace" });

const SEARCH_PAGE_SIZE = 28;

const { user, signInWithGoogle } = useAuth();
const { searchCatalog, getCardsByIds, listSets, listRarities } = useCardCatalog();
const {
  entries,
  loading: collectionLoading,
  count,
  isInCollection,
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

// ── Filter dropdowns ──────────────────────────────────────────────────
const sets = ref<Array<{ name: string; count: number }>>([]);
const rarities = ref<Array<{ name: string; count: number }>>([]);

const loadDropdowns = async () => {
  // Fire both in parallel; first load is the only one that costs a round-trip.
  const [s, r] = await Promise.all([listSets("EN"), listRarities("EN")]);
  sets.value = s;
  rarities.value = r;
};

// ── Form state ────────────────────────────────────────────────────────
// `searchInput` is the live text in the box (does NOT trigger search).
// `appliedQuery` is what's actually being searched, set on submit.
const searchInput = ref("");
const appliedQuery = ref("");
const setFilter = ref("");
const rarityFilter = ref("");
const sortBy = ref<CatalogSort>("best");

// The parser feeds derived hints we display as chips alongside dropdown
// choices. Parser hints take priority over the dropdown when both are set
// (smart typing wins).
const parsed = computed(() => parseSmartQuery(appliedQuery.value));

const effectiveSetMatch = computed(
  () => parsed.value.setHint || setFilter.value || null,
);
const effectiveRarityMatch = computed(
  () => parsed.value.rarityHint || rarityFilter.value || null,
);

interface FilterChip {
  label: string;
  clear?: () => void;
}
const activeChips = computed<FilterChip[]>(() => {
  const chips: FilterChip[] = [];
  if (parsed.value.name) {
    chips.push({ label: `Name: ${parsed.value.name}` });
  }
  if (parsed.value.setHint) {
    chips.push({ label: `Set: ${parsed.value.setHint} (from query)` });
  } else if (setFilter.value) {
    chips.push({
      label: `Set: ${setFilter.value}`,
      clear: () => {
        setFilter.value = "";
        runSearch();
      },
    });
  }
  if (parsed.value.rarityHint) {
    chips.push({ label: `Rarity: ${parsed.value.rarityHint} (from query)` });
  } else if (rarityFilter.value) {
    chips.push({
      label: `Rarity: ${rarityFilter.value}`,
      clear: () => {
        rarityFilter.value = "";
        runSearch();
      },
    });
  }
  if (sortBy.value !== "best") {
    const labels: Record<CatalogSort, string> = {
      best: "Best match",
      name: "Name (A–Z)",
      price_asc: "Price (low → high)",
      price_desc: "Price (high → low)",
    };
    chips.push({
      label: `Sort: ${labels[sortBy.value]}`,
      clear: () => {
        sortBy.value = "best";
        runSearch();
      },
    });
  }
  return chips;
});

// ── Run search (form submit / chip clear) ────────────────────────────
const searchResults = ref<CatalogMatch[]>([]);
const searchTotal = ref(0);
const searchPage = ref(0);
const searchLoading = ref(false);
const hasRunSearch = ref(false);

const hasMoreResults = computed(
  () => searchResults.value.length < searchTotal.value,
);

const runSearch = async () => {
  appliedQuery.value = searchInput.value;
  searchPage.value = 0;
  hasRunSearch.value = true;
  searchLoading.value = true;
  const { results, total } = await searchCatalog(parsed.value.name, {
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
  const { results } = await searchCatalog(parsed.value.name, {
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

// ── Collection details ────────────────────────────────────────────────
const collectionCards = ref<CatalogMatch[]>([]);
const collectionProductIds = computed(() =>
  [...entries.value]
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((e) => e.productId),
);

watch(
  collectionProductIds,
  async (ids) => {
    if (ids.length === 0) {
      collectionCards.value = [];
      return;
    }
    collectionCards.value = await getCardsByIds(ids);
  },
  { immediate: true },
);

const totalValue = computed<number | null>(() => {
  if (collectionCards.value.length === 0) return null;
  return collectionCards.value.reduce(
    (sum, c) => sum + (c.price?.market ?? 0),
    0,
  );
});

// Thousands separators + 2 decimals, e.g. 1234.5 → "1,234.50".
const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const handleToggle = async (productId: number) => {
  try {
    await toggleInCollection(productId);
  } catch (err: any) {
    console.error("[collection] toggle failed:", err);
  }
};
</script>

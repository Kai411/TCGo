<template>
  <div class="lg:flex lg:gap-8">
    <!-- ── Filter sidebar (desktop only) ─────────────────────────────── -->
    <aside
      v-if="!loading"
      class="hidden lg:block w-48 shrink-0 sticky top-[5.5rem] self-start"
    >
      <ListingFilters :filters="filters" :sidebar="true" />
    </aside>

    <!-- ── Main content ───────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0">
      <PremiumBanner />

      <!-- TCG filter pills -->
      <div
        v-if="!loading && tcgCounts.length > 1"
        class="-mx-4 px-4 mb-3 sm:mb-4 overflow-x-auto"
      >
        <div class="flex items-center gap-2 whitespace-nowrap">
          <button
            v-for="{ type, count } in tcgCounts"
            :key="type"
            type="button"
            @click="activeTcg = type"
            :aria-pressed="activeTcg === type"
            class="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ease-premium shrink-0"
            :class="
              activeTcg === type
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'bg-black/[0.04] text-ink-muted dark:bg-white/[0.06] dark:text-zinc-400 hover:text-ink dark:hover:text-white'
            "
          >
            {{ type }}
            <span class="ml-1 text-xs opacity-70 tabular-nums">{{ count }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile filter trigger (hidden on desktop where sidebar is shown) -->
      <div v-if="!loading" class="lg:hidden mb-2">
        <ListingFilters :filters="filters" />
      </div>

      <!-- Loading: skeleton tiles in the same grid, so the page doesn't
           jump when listings arrive. -->
      <div
        v-if="loading"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
        role="status"
        aria-label="Loading listings"
      >
        <CardTileSkeleton v-for="n in 8" :key="n" />
      </div>

      <!-- Empty because filters hid everything: offer a way back out. -->
      <EmptyState
        v-else-if="availableCards.length === 0 && hasNarrowing"
        headline="No cards match these filters"
        caption="Try removing a filter or switching back to all games."
      >
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 5h18l-7 8v6l-4-2v-4z" />
          </svg>
        </template>
        <button
          type="button"
          @click="clearAll"
          class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
        >
          Clear filters
        </button>
      </EmptyState>

      <!-- Empty marketplace -->
      <EmptyState
        v-else-if="availableCards.length === 0"
        headline="No cards listed yet"
        caption="Be the first collector to list one."
      >
        <NuxtLink
          v-if="user"
          to="/cards/create"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow ease-premium"
        >
          List your first card
        </NuxtLink>
      </EmptyState>

      <!-- Grid -->
      <template v-else>
        <p class="mb-3 text-xs text-ink-muted dark:text-zinc-400" aria-live="polite">
          {{ availableCards.length }}
          {{ availableCards.length === 1 ? "card" : "cards" }} for sale
        </p>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
        >
          <CardTile v-for="card in availableCards" :key="card.id" :card="card" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";

useHead({
  title: "Shop Pokemon Cards | TCGo Marketplace",
  meta: [
    {
      name: "description",
      content:
        "Browse and buy Pokemon TCG cards from collectors across Malaysia. Find rare cards, vintage sets, and modern releases at fair prices.",
    },
  ],
});

const { user } = useAuth();
const { cards, loading } = useCards();
const filters = useListingFilters();

const activeTcg = ref<string>("All");
const tcgOf = (c: Card) => c.tcgType || "Pokemon";

const tcgCounts = computed(() => {
  const live = cards.value.filter((c: Card) => !c.sold);
  const counts = new Map<string, number>();
  counts.set("All", live.length);
  for (const c of live) {
    const t = tcgOf(c);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const rest = [...counts.entries()]
    .filter(([type]) => type !== "All")
    .sort((a, b) => b[1] - a[1]);
  return [["All", counts.get("All") ?? 0] as [string, number], ...rest].map(
    ([type, count]) => ({ type, count }),
  );
});

const hasNarrowing = computed(
  () => activeTcg.value !== "All" || filters.activeCount.value > 0,
);
const clearAll = () => {
  activeTcg.value = "All";
  filters.reset();
};

const availableCards = computed(() => {
  const base = cards.value
    .filter((c: Card) => !c.sold)
    .filter(
      (c: Card) => activeTcg.value === "All" || tcgOf(c) === activeTcg.value,
    );
  return filters.apply(base);
});
</script>

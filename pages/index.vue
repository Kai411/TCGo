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
      <!-- TCG filter pills -->
      <div
        v-if="!loading && tcgCounts.length > 1"
        class="-mx-4 px-4 mb-3 sm:mb-4 overflow-x-auto"
      >
        <div class="flex items-center gap-2 whitespace-nowrap">
          <button
            v-for="{ type, count } in tcgCounts"
            :key="type"
            @click="activeTcg = type"
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

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-24">
        <div
          class="animate-spin rounded-full h-8 w-8 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <!-- Empty -->
      <div
        v-else-if="availableCards.length === 0"
        class="surface rounded-2xl py-20 text-center"
      >
        <p class="text-lg font-semibold text-ink dark:text-white">
          No cards listed yet
        </p>
        <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
          Be the first collector to list one.
        </p>
        <NuxtLink
          v-if="user"
          to="/cards/create"
          class="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow ease-premium"
        >
          List your first card
        </NuxtLink>
      </div>

      <!-- Grid -->
      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
      >
        <CardTile v-for="card in availableCards" :key="card.id" :card="card" />
      </div>
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

const availableCards = computed(() => {
  const base = cards.value
    .filter((c: Card) => !c.sold)
    .filter(
      (c: Card) => activeTcg.value === "All" || tcgOf(c) === activeTcg.value,
    );
  return filters.apply(base);
});
</script>

<template>
  <div>
    <!-- TCG filter pills. Hidden while loading so we don't flash an empty
         filter row above the spinner. -->
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

    <ListingFilters v-if="!loading" :filters="filters" />

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
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
    >
      <NuxtLink
        v-for="card in availableCards"
        :key="card.id"
        :to="`/cards/${card.id}`"
        class="group block"
      >
        <article
          class="surface rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow duration-300 ease-premium h-full flex flex-col"
        >
          <!-- Image well -->
          <div class="p-2 sm:p-2.5 bg-white dark:bg-white/[0.04]">
            <div
              class="relative aspect-[3.55/5] rounded-lg overflow-hidden bg-canvas-sunken dark:bg-white/[0.02]"
            >
              <img
                v-if="card.imageUrls?.length || card.imageUrl"
                :src="cdnUrl(card.imageUrls?.[0] || card.imageUrl, 400)"
                :alt="card.cardName"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-premium"
              />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-xs text-ink-soft dark:text-zinc-500"
              >
                No image
              </div>

              <!-- Top-left: photo count -->
              <span
                v-if="(card.imageUrls?.length || 0) > 1"
                class="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
              >
                <svg
                  class="w-2.5 h-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <rect x="3" y="6" width="18" height="14" rx="2" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                {{ card.imageUrls?.length }}
              </span>

              <!-- Top-right: grade/condition badge on image -->
              <span
                v-if="conditionLabel(card)"
                class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm"
                :class="gradeBadgeClasses(card)"
              >
                {{ conditionLabel(card) }}
              </span>

              <!-- Bottom-left: language badge -->
              <span
                v-if="card.language && card.language !== 'EN'"
                class="absolute left-1.5 bottom-1.5 bg-black/75 text-white text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded"
              >
                {{ card.language }}
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="px-3.5 sm:px-4 pt-2 pb-3.5 sm:pb-4 flex-1 flex flex-col">
            <h3
              class="font-semibold text-[15px] leading-tight text-ink dark:text-white truncate"
            >
              {{ card.cardName }}
            </h3>
            <p
              v-if="card.cardSet"
              class="mt-0.5 text-xs text-ink-muted dark:text-zinc-400 truncate"
            >
              {{ card.cardSet }}
            </p>

            <div class="mt-auto pt-3">
              <div class="flex items-end justify-between">
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-zinc-500"
                  >
                    RM
                  </span>
                  <p
                    class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white"
                  >
                    {{ formatPrice(card.price) }}
                  </p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span
                    v-if="card.interestedCount > 0"
                    class="text-[10px] text-ink-soft dark:text-zinc-500"
                  >
                    🔥 {{ card.interestedCount }}
                  </span>
                  <FavouriteButton
                    :item-id="card.id"
                    item-type="card"
                    :count="card.favouriteCount || 0"
                    size="sm"
                  />
                </div>
              </div>
              <div class="mt-1.5">
                <span
                  v-if="card.seller"
                  class="text-[11px] text-ink-muted dark:text-zinc-400 truncate"
                >
                  @{{ card.seller }}
                </span>
              </div>
            </div>
          </div>
        </article>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import { cdnUrl } from "~/composables/useStorage";

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

// TCG filter — defaults to "All". Cards pre-dating the tcgType field
// are bucketed as "Pokemon" so the legacy catalog stays visible.
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
  // Order: All first, then by count desc.
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

// Short pill label that always fits on a tile. Ungraded labels in the
// constants list are written as "Near Mint (NM)", "Moderately Played (MP)",
// etc. — strip down to just the abbreviation in the parens. Graded labels
// like "PSA 10" are already short. Sealed becomes "SEALED".
const conditionLabel = (card: Card): string => {
  if (card.productType === "Graded") {
    const provider =
      card.gradingProvider === "Others"
        ? card.customGradingProvider
        : card.gradingProvider;
    return `${provider || ""} ${card.grade || ""}`.trim();
  }
  if (card.productType === "Sealed") return "SEALED";
  const m = (card.condition || "").match(/\(([^)]+)\)/);
  return m ? m[1] : card.condition || "";
};

const gradeBadgeClasses = (card: Card): string => {
  if (card.productType === "Graded")
    return "bg-amber-400 text-amber-950 border border-amber-600";
  if (card.productType === "Sealed")
    return "bg-blue-500 text-white border border-blue-700";
  return "bg-white text-ink border border-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600";
};

const formatPrice = (price: number): string => {
  return price.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
</script>

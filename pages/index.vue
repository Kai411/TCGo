<template>
  <div>
    <!-- Hero -->
    <section class="pt-2 pb-10 lg:pb-14">
      <div class="max-w-3xl">
        <span class="eyebrow">Marketplace</span>
        <h1
          class="mt-3 font-display text-hero font-extrabold tracking-hero text-ink dark:text-white"
        >
          Trade rare cards,
          <span class="text-pokemon-red">smarter.</span>
        </h1>
        <p class="mt-4 max-w-xl text-base sm:text-lg text-ink-muted dark:text-zinc-400 leading-relaxed">
          The Pokémon TCG marketplace for Malaysian collectors. Discover graded
          slabs, fresh pulls, and vintage finds from the community.
        </p>

        <!-- Stats row -->
        <dl class="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt class="eyebrow">Listed</dt>
            <dd class="mt-1 tabular-price text-2xl font-bold text-ink dark:text-white">
              {{ availableCards.length.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="eyebrow">Sold</dt>
            <dd class="mt-1 tabular-price text-2xl font-bold text-ink dark:text-white">
              {{ soldCount.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="eyebrow">Collectors</dt>
            <dd class="mt-1 tabular-price text-2xl font-bold text-ink dark:text-white">
              {{ collectorCount.toLocaleString() }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- Section header -->
    <div class="flex items-end justify-between mb-5">
      <div>
        <span class="eyebrow">Latest listings</span>
        <h2 class="mt-1 text-2xl sm:text-3xl font-bold tracking-tightest text-ink dark:text-white">
          Fresh on the market
        </h2>
      </div>

      <NuxtLink
        v-if="user"
        to="/cards/create"
        class="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity ease-premium"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        List Card
      </NuxtLink>
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
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
    >
      <NuxtLink
        v-for="card in availableCards"
        :key="card.id"
        :to="`/cards/${card.id}`"
        class="group block"
      >
        <article
          class="surface rounded-2xl overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 ease-premium"
        >
          <div
            class="relative aspect-[3/4] bg-canvas-sunken dark:bg-white/[0.02] overflow-hidden"
          >
            <img
              v-if="card.imageUrls?.length || card.imageUrl"
              :src="card.imageUrls?.[0] || card.imageUrl"
              :alt="card.cardName"
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-premium"
            />
            <div
              v-else
              class="absolute inset-0 flex items-center justify-center text-xs text-ink-soft dark:text-zinc-500"
            >
              No image
            </div>

            <!-- Condition chip overlay -->
            <span
              v-if="conditionLabel(card)"
              class="absolute top-2 left-2 chip"
              :class="conditionChipVariant(card)"
            >
              {{ conditionLabel(card) }}
            </span>
          </div>

          <div class="p-3.5 sm:p-4">
            <h3
              class="font-semibold text-[15px] leading-tight text-ink dark:text-white truncate"
            >
              {{ card.cardName }}
            </h3>
            <p
              v-if="card.cardSet"
              class="mt-1 text-xs text-ink-muted dark:text-zinc-400 truncate"
            >
              {{ card.cardSet }}
            </p>

            <div class="mt-3 flex items-end justify-between">
              <div class="min-w-0">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-zinc-500">
                  RM
                </span>
                <p
                  class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white"
                >
                  {{ card.price.toFixed(2) }}
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

            <p
              class="mt-2 text-[11px] text-ink-soft dark:text-zinc-500 truncate"
            >
              by {{ card.seller }}
            </p>
          </div>
        </article>
      </NuxtLink>
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

const availableCards = computed(() =>
  cards.value
    .filter((c: Card) => !c.sold)
    .sort((a: Card, b: Card) => b.createdAt - a.createdAt),
);

const soldCount = computed(() => cards.value.filter((c: Card) => c.sold).length);
const collectorCount = computed(() => {
  const sellers = new Set(cards.value.map((c: Card) => c.sellerUid));
  return sellers.size;
});

const conditionLabel = (card: Card): string => {
  if (card.productType === "Graded") {
    const provider =
      card.gradingProvider === "Others"
        ? card.customGradingProvider
        : card.gradingProvider;
    return `${provider || ""} ${card.grade || ""}`.trim();
  }
  if (card.productType === "Sealed") return "Sealed";
  return card.condition || "";
};

const conditionChipVariant = (card: Card): string => {
  if (card.productType === "Graded") return "chip-gold";
  if (card.productType === "Sealed") return "chip-accent";
  return "";
};
</script>

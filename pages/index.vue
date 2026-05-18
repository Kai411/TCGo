<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Shop Cards</h1>
      <NuxtLink
        v-if="user"
        to="/cards/create"
        class="bg-pokemon-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        + List Card for Sale
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="availableCards.length === 0" class="text-center py-12">
      <p class="text-gray-500 text-lg">No cards for sale yet.</p>
      <p class="text-gray-400 mt-1 text-sm">Be the first to list a card!</p>
    </div>

    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    >
      <NuxtLink
        v-for="card in availableCards"
        :key="card.id"
        :to="`/cards/${card.id}`"
        class="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-pokemon-blue hover:shadow-md transition-all group cursor-pointer block"
      >
        <div
          class="aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden"
        >
          <img
            v-if="card.imageUrls?.length || card.imageUrl"
            :src="card.imageUrls?.[0] || card.imageUrl"
            :alt="card.cardName"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <span v-else class="text-gray-400 text-xs">No Image</span>
        </div>
        <div class="p-3">
          <h3 class="font-semibold text-sm truncate">{{ card.cardName }}</h3>
          <p class="text-xs text-gray-500 truncate">
            <span v-if="card.cardSet">{{ card.cardSet }}</span>
            <span v-if="card.cardSet && conditionLabel(card)"> · </span>
            <span>{{ conditionLabel(card) }}</span>
          </p>
          <p class="text-xs text-gray-400 truncate mt-0.5">
            {{ card.seller }}
          </p>
          <div class="flex items-center justify-between mt-2">
            <p class="text-pokemon-red font-bold text-sm">
              RM {{ card.price.toFixed(2) }}
            </p>
            <div class="flex items-center gap-1">
              <span
                v-if="card.interestedCount > 0"
                class="text-xs text-gray-400"
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
        </div>
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
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to manage your listings.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-5">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Listings</h1>
        <NuxtLink
          to="/inventory/listings/new"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          List a card
        </NuxtLink>
      </div>

      <TabStrip v-model="tab" :tabs="tabs" />

      <div v-if="cardsLoading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <template v-else>
        <!-- Active -->
        <div v-if="tab === 'active'" class="mt-5">
          <p v-if="!activeCards.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No cards listed.
            <NuxtLink to="/inventory/listings/new" class="text-pokemon-red hover:underline ml-1">List one →</NuxtLink>
          </p>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <ActivityRow
              v-for="card in activeCards"
              :key="card.id"
              :image="card.imageUrls?.[0] || card.imageUrl"
              :title="card.cardName"
              :subtitle="`${card.cardSet || ''} · ${card.condition || ''}`"
              :to="`/cards/${card.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">RM {{ card.price.toFixed(2) }}</span>
              </template>
              <template #actions>
                <div class="flex items-center gap-1.5">
                  <NuxtLink
                    :to="`/inventory/listings/${card.id}/edit`"
                    @click.stop
                    class="text-xs bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-white/[0.10] px-3 py-1.5 rounded-lg font-medium"
                  >
                    Edit
                  </NuxtLink>
                  <button
                    @click.stop.prevent="handleMarkAsSold(card.id)"
                    :disabled="markingAsSold === card.id"
                    class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                  >
                    {{ markingAsSold === card.id ? "..." : "Mark sold" }}
                  </button>
                </div>
              </template>
            </ActivityRow>
          </div>
        </div>

        <!-- Sold -->
        <div v-if="tab === 'sold'" class="mt-5">
          <p v-if="!soldCards.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No completed sales yet.
          </p>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <ActivityRow
              v-for="card in soldCards"
              :key="card.id"
              :image="card.imageUrls?.[0] || card.imageUrl"
              :title="card.cardName"
              :subtitle="`${card.cardSet || ''} · ${card.condition || ''}`"
              :to="`/cards/${card.id}`"
              :dim="true"
            >
              <template #meta>
                <span class="text-gray-500 dark:text-zinc-400">RM {{ card.price.toFixed(2) }}</span>
              </template>
              <template #actions>
                <span class="text-xs bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-zinc-400 px-3 py-1.5 rounded-lg font-medium">Sold</span>
              </template>
            </ActivityRow>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

definePageMeta({ layout: "inventory" });
useHead({ title: "Inventory · Listings | TCGo" });

const { user, signInWithGoogle } = useAuth();
const { cards, loading: cardsLoading, markAsSold } = useCards();
const { markSoldByListingId } = useInventory();

const tab = ref<"active" | "sold">("active");

const myCards = computed(() =>
  cards.value
    .filter((c: Card) => c.sellerUid === user.value?.uid)
    .sort((a: Card, b: Card) => b.createdAt - a.createdAt),
);
const activeCards = computed(() => myCards.value.filter((c: Card) => !c.sold));
const soldCards = computed(() => myCards.value.filter((c: Card) => c.sold));

const tabs = computed<TabItem[]>(() => [
  { id: "active", label: "Active", count: activeCards.value.length },
  { id: "sold", label: "Sold", count: soldCards.value.length },
]);

const markingAsSold = ref<string | null>(null);
const handleMarkAsSold = async (cardId: string) => {
  if (!confirm("Mark this card as sold?")) return;
  markingAsSold.value = cardId;
  try {
    await markAsSold(cardId);
    // Keep the linked inventory item (if any) in sync.
    await markSoldByListingId(cardId);
  } finally {
    markingAsSold.value = null;
  }
};
</script>

<template>
  <div class="sl-page">
    <SellerGate v-if="!user" message="Sign in to manage your listings." />

    <template v-else>
      <SellerPageHead
        title="Listings"
        description="Cards on sale at a fixed price on the marketplace."
      >
        <NuxtLink to="/seller/listings/new" class="mc-btn mc-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Add card
        </NuxtLink>
      </SellerPageHead>

      <McTabs v-model="tab" :tabs="tabs" class="mb-4" />

      <div v-if="cardsLoading" class="mc-skel h-[200px]" aria-busy="true" aria-label="Loading listings" />

      <div v-else class="mc-card overflow-hidden">
        <template v-if="tab === 'active'">
          <div v-if="!activeCards.length" class="mc-empty flex items-center justify-between gap-3">
            <span>No cards listed yet.</span>
            <NuxtLink to="/seller/listings/new" class="mc-btn mc-btn-sm">List a card</NuxtLink>
          </div>
          <div v-for="card in activeCards" v-else :key="card.id" class="mc-row mc-row--split">
            <NuxtLink :to="`/cards/${card.id}`" class="mc-row-link">
              <img :src="card.imageUrls?.[0] || card.imageUrl" alt="" class="mc-thumb" loading="lazy" />
              <div class="min-w-0">
                <p class="mc-row-title">{{ card.cardName }}</p>
                <p class="mc-meta truncate">
                  <span class="mc-num font-semibold text-[var(--ink)]">RM {{ card.price.toFixed(2) }}</span>
                  · {{ [card.cardSet, card.condition].filter(Boolean).join(" · ") }}
                </p>
              </div>
            </NuxtLink>
            <div class="flex items-center gap-1.5">
              <NuxtLink :to="`/seller/listings/${card.id}/edit`" class="mc-btn mc-btn-sm">Edit</NuxtLink>
              <button
                type="button"
                class="mc-btn mc-btn-sm"
                :disabled="markingAsSold === card.id"
                @click="handleMarkAsSold(card.id)"
              >
                {{ markingAsSold === card.id ? "Saving…" : "Mark sold" }}
              </button>
            </div>
          </div>
        </template>

        <template v-if="tab === 'sold'">
          <p v-if="!soldCards.length" class="mc-empty">No completed sales yet.</p>
          <NuxtLink v-for="card in soldCards" v-else :key="card.id" :to="`/cards/${card.id}`" class="mc-row is-done">
            <img :src="card.imageUrls?.[0] || card.imageUrl" alt="" class="mc-thumb" loading="lazy" />
            <div class="min-w-0">
              <p class="mc-row-title">{{ card.cardName }}</p>
              <p class="mc-meta truncate">{{ [card.cardSet, card.condition].filter(Boolean).join(" · ") }}</p>
            </div>
            <span class="text-right">
              <span class="mc-num block">RM {{ card.price.toFixed(2) }}</span>
              <span class="mc-small">Sold</span>
            </span>
          </NuxtLink>
        </template>
      </div>
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

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Listings | TCGo" });

const {user} = useAuth();
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
    await markSoldByListingId(
      cardId,
      cards.value.find((c: Card) => c.id === cardId)?.price,
    );
  } finally {
    markingAsSold.value = null;
  }
};
</script>

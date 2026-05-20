<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 text-lg mb-4">
        Sign in to start your personal collection.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">My Collection</h1>
          <p class="text-sm text-gray-500">
            {{ cards.length }} card{{ cards.length === 1 ? "" : "s" }} scanned
          </p>
        </div>
        <button
          @click="scannerOpen = true"
          class="bg-pokemon-red text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Scan Card
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div
          class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
        ></div>
      </div>

      <div
        v-else-if="cards.length === 0"
        class="text-center py-16 bg-white rounded-xl border border-gray-200"
      >
        <p class="text-gray-700 font-medium mb-2">Your collection is empty</p>
        <p class="text-sm text-gray-500 mb-6">
          Tap "Scan Card" to add your first card.
        </p>
        <button
          @click="scannerOpen = true"
          class="bg-pokemon-blue text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Scan your first card
        </button>
      </div>

      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        <div
          v-for="card in cards"
          :key="card.id"
          class="bg-white border border-gray-200 rounded-lg overflow-hidden group relative"
        >
          <img
            :src="card.imageUrl"
            :alt="card.cardName"
            class="w-full aspect-[2.5/3.5] object-cover"
          />
          <div class="p-2">
            <p class="text-xs font-semibold text-gray-900 truncate">
              {{ card.cardName }}
            </p>
            <p class="text-[10px] text-gray-500 truncate">
              {{ card.cardSet }} · {{ card.cardNumber }}
            </p>
            <p
              v-if="card.rarity"
              class="text-[10px] text-gray-400 truncate"
            >
              {{ card.rarity }}
            </p>
          </div>
          <button
            @click="confirmRemove(card)"
            class="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      </div>
    </template>

    <CardScanner
      v-if="scannerOpen"
      @close="scannerOpen = false"
      @added="scannerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { CollectionCard } from "~/composables/useCollection";

const { user, signInWithGoogle } = useAuth();
const { cards, loading, removeCard } = useCollection();

const scannerOpen = ref(false);

const confirmRemove = async (card: CollectionCard) => {
  if (!window.confirm(`Remove "${card.cardName}" from your collection?`)) return;
  await removeCard(card.id);
};
</script>

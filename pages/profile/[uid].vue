<template>
  <div>
    <div v-if="profileLoading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="!profile" class="text-center py-12">
      <p class="text-gray-500 text-lg">User not found.</p>
      <NuxtLink
        to="/auctions"
        class="text-pokemon-red hover:underline mt-2 inline-block text-sm"
      >
        ← Back to auctions
      </NuxtLink>
    </div>

    <template v-else>
      <div class="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <img
              :src="profile.photoURL || ''"
              :alt="profile.customName"
              class="w-16 h-16 rounded-full border-2 border-gray-200"
            />
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold">
                  {{ profile.customName || profile.displayName }}
                </h1>
                <span
                  v-if="profile.whatsappVerified"
                  class="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Verified Contact
                </span>

                <span
                  v-if="profile.whatsappNumber"
                  class="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Contact Added
                </span>
              </div>
              <p class="text-sm text-gray-500">
                Member since {{ formatDate(profile.createdAt) }}
              </p>
            </div>
          </div>
          <NuxtLink
            v-if="isOwnProfile"
            to="/profile"
            class="text-sm bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-gray-700 transition-colors"
          >
            Edit Profile
          </NuxtLink>
        </div>
        <div class="flex gap-6 mt-4 text-sm text-gray-500">
          <span>{{ userCards.length }} card(s) for sale</span>
          <span>{{ userAuctions.length }} auction(s)</span>
        </div>
      </div>

      <!-- Toggle -->
      <div
        class="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit"
      >
        <button
          @click="activeTab = 'cards'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="
            activeTab === 'cards'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          Cards for Sale ({{ userCards.length }})
        </button>
        <button
          @click="activeTab = 'auctions'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="
            activeTab === 'auctions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          Auctions ({{ userAuctions.length }})
        </button>
      </div>

      <!-- Cards for Sale -->
      <div v-if="activeTab === 'cards'">
        <div v-if="userCards.length === 0" class="text-gray-400 text-sm py-4">
          No cards for sale.
        </div>
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          <NuxtLink
            v-for="card in userCards"
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
              <h3 class="font-semibold text-sm truncate">
                {{ card.cardName }}
              </h3>
              <p class="text-xs text-gray-500 truncate">
                {{ card.cardSet }} · {{ card.condition }}
              </p>
              <div class="flex items-center justify-between mt-2">
                <p class="text-pokemon-red font-bold text-sm">
                  RM {{ card.price.toFixed(2) }}
                </p>
                <span
                  class="text-xs px-1.5 py-0.5 rounded-full"
                  :class="
                    card.sold
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-green-100 text-green-700'
                  "
                >
                  {{ card.sold ? "Sold" : "Available" }}
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Auctions -->
      <div v-if="activeTab === 'auctions'">
        <div
          v-if="userAuctions.length === 0"
          class="text-gray-400 text-sm py-4"
        >
          No auctions listed.
        </div>
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          <NuxtLink
            v-for="auction in userAuctions"
            :key="auction.id"
            :to="`/auctions/${auction.id}`"
            class="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-pokemon-red hover:shadow-md transition-all group cursor-pointer block"
          >
            <div
              class="aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="auction.imageUrls?.length || auction.imageUrl"
                :src="auction.imageUrls?.[0] || auction.imageUrl"
                :alt="auction.cardName"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <span v-else class="text-gray-400 text-xs">No Image</span>
            </div>
            <div class="p-3">
              <h3 class="font-semibold text-sm truncate">
                {{ auction.cardName }}
              </h3>
              <p class="text-xs text-gray-500 truncate">
                {{ auction.cardSet }}
              </p>
              <div class="flex items-center justify-between mt-2">
                <p class="text-pokemon-red font-bold text-sm">
                  RM {{ auction.currentPrice.toFixed(2) }}
                </p>
                <span
                  class="text-xs px-1.5 py-0.5 rounded-full"
                  :class="
                    isActive(auction)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  "
                >
                  {{ isActive(auction) ? "Active" : "Ended" }}
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";

const route = useRoute();
const uid = route.params.uid as string;

const { profile, loading: profileLoading } = useProfile(uid);
const { user } = useAuth();
const { auctions } = useAuctions();
const { cards } = useCards();

const isOwnProfile = computed(() => user.value?.uid === uid);

const activeTab = ref<"cards" | "auctions">("cards");

const userCards = computed(() =>
  cards.value
    .filter((c: any) => c.sellerUid === uid)
    .sort((a: any, b: any) => b.createdAt - a.createdAt),
);

const userAuctions = computed(() =>
  auctions.value
    .filter((a: any) => a.sellerUid === uid)
    .sort((a: any, b: any) => b.createdAt - a.createdAt),
);

const isActive = (auction: Auction) => auction.endsAt > Date.now();

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
</script>

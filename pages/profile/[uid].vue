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
      <div
        class="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 mb-8 overflow-hidden"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img
              :src="profile.photoURL || ''"
              :alt="profile.customName"
              class="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-full border-2 border-gray-200 object-cover"
            />
            <div class="min-w-0 flex-1">
              <h1 class="text-base sm:text-2xl font-bold truncate">
                {{ profile.customName || profile.displayName }}
              </h1>
              <div class="flex flex-wrap gap-1 mt-0.5">
                <span
                  v-if="profile.whatsappVerified"
                  class="inline-flex items-center gap-0.5 bg-green-100 text-green-700 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full"
                >
                  <svg
                    class="w-2.5 h-2.5 sm:w-3 sm:h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Verified
                </span>
                <span
                  v-else-if="profile.whatsappNumber"
                  class="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full"
                >
                  <svg
                    class="w-2.5 h-2.5 sm:w-3 sm:h-3"
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
              <p class="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                Member since {{ formatDate(profile.createdAt) }}
              </p>
              <!-- Trust Score -->
              <div class="flex items-center gap-2 mt-1">
                <span
                  class="text-xs font-medium"
                  :class="getScoreColor(profile.trustScore ?? 100)"
                >
                  Trust: {{ profile.trustScore ?? 100 }}/100
                </span>
                <span
                  v-if="getScoreBadge(profile.trustScore ?? 100)"
                  class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  :class="getScoreBadge(profile.trustScore ?? 100)?.class"
                >
                  {{ getScoreBadge(profile.trustScore ?? 100)?.label }}
                </span>
                <button
                  @click="showTrustInfo = true"
                  class="text-gray-400 hover:text-gray-600 transition-colors"
                  title="How trust score works"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="self-start flex sm:flex-col gap-2" v-if="isOwnProfile">
            <NuxtLink
              to="/profile"
              class="text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-700 transition-colors whitespace-nowrap"
            >
              Settings
            </NuxtLink>
            <button
              @click="handleSignOut"
              class="text-xs sm:text-sm bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg text-red-700 transition-colors whitespace-nowrap"
            >
              Logout
            </button>
          </div>
          <button
            v-else-if="user"
            @click="showReportForm = true"
            class="self-start text-xs sm:text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Report
          </button>
        </div>
        <div class="flex gap-4 sm:gap-6 mt-3 text-xs sm:text-sm text-gray-500">
          <span>{{ userCards.length }} card(s) for sale</span>
          <span>{{ userAuctions.length }} auction(s)</span>
        </div>
      </div>

      <!-- Toggle -->
      <div
        class="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto"
      >
        <button
          @click="activeTab = 'cards'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
          :class="
            activeTab === 'cards'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          Cards ({{ userCards.length }})
        </button>
        <button
          @click="activeTab = 'auctions'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
          :class="
            activeTab === 'auctions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          Auctions ({{ userAuctions.length }})
        </button>
        <button
          v-if="showFavourites"
          @click="activeTab = 'favourites'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
          :class="
            activeTab === 'favourites'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          ♥ Favourites
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

      <!-- Favourites -->
      <div v-if="activeTab === 'favourites' && showFavourites">
        <div
          v-if="favouriteCards.length === 0 && favouriteAuctions.length === 0"
          class="text-gray-400 text-sm py-4"
        >
          No favourites yet.
        </div>
        <div v-else class="space-y-4">
          <div
            v-if="favouriteCards.length > 0"
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          >
            <NuxtLink
              v-for="card in favouriteCards"
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
                <p class="text-pokemon-red font-bold text-sm mt-1">
                  RM {{ card.price.toFixed(2) }}
                </p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>

    <!-- Report Form Modal -->
    <ReportForm
      v-if="showReportForm && profile"
      :reported-uid="uid"
      :reported-name="profile.customName || profile.displayName"
      @close="showReportForm = false"
      @submitted="reportSubmitted = true"
    />

    <!-- Trust Score Info Modal -->
    <div
      v-if="showTrustInfo"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="showTrustInfo = false"
    >
      <div
        class="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold">Trust Score</h2>
          <button
            @click="showTrustInfo = false"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-4 text-sm text-gray-700">
          <p>
            Every user starts with a trust score of <strong>100/100</strong>. It
            reflects your reliability as a community member.
          </p>

          <div>
            <h3 class="font-semibold text-gray-900 mb-1">How it decreases</h3>
            <ul class="space-y-1 text-xs text-gray-600">
              <li class="flex justify-between">
                <span>Scam (buyer or seller)</span
                ><span class="text-red-600 font-medium">-25</span>
              </li>
              <li class="flex justify-between">
                <span>Auction bail (winner didn't pay)</span
                ><span class="text-orange-600 font-medium">-10</span>
              </li>
              <li class="flex justify-between">
                <span>Ghosted on agreed deal</span
                ><span class="text-yellow-600 font-medium">-5</span>
              </li>
              <li class="flex justify-between">
                <span>Other disruptive behaviour</span
                ><span class="text-yellow-600 font-medium">-5</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="font-semibold text-gray-900 mb-1">How it works</h3>
            <ul class="space-y-1 text-xs text-gray-600 list-disc pl-4">
              <li>
                Reports are reviewed by admins before any penalty is applied
              </li>
              <li>Evidence (screenshots) is required when reporting</li>
              <li>False reports will not result in penalties</li>
              <li>Score recovers +2 per completed deal</li>
            </ul>
          </div>

          <div>
            <h3 class="font-semibold text-gray-900 mb-1">Restrictions</h3>
            <ul class="space-y-1 text-xs text-gray-600">
              <li class="flex justify-between">
                <span>Below 80</span><span>⚠️ Warning badge shown</span>
              </li>
              <li class="flex justify-between">
                <span>Below 60</span><span>🚫 Cannot bid on auctions</span>
              </li>
              <li class="flex justify-between">
                <span>Below 40</span><span>🚫 Cannot list items</span>
              </li>
              <li class="flex justify-between">
                <span>Below 20</span><span>🚫 Account suspended</span>
              </li>
            </ul>
          </div>

          <p class="text-xs text-gray-400 pt-2 border-t border-gray-100">
            This system protects our community from bad actors. Trade
            responsibly!
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="reportSubmitted"
      class="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50"
    >
      Report submitted. We'll review it shortly.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";

const route = useRoute();
const uid = route.params.uid as string;

const { profile, loading: profileLoading } = useProfile(uid);
const { user, signOut } = useAuth();
const { auctions } = useAuctions();
const { cards } = useCards();
const { userFavourites } = useUserFavourites(uid);

const isOwnProfile = computed(() => user.value?.uid === uid);

const showReportForm = ref(false);
const reportSubmitted = ref(false);
const showTrustInfo = ref(false);

const { getScoreColor, getScoreBadge } = useTrustScore();

// Show favourites tab if: it's own profile OR profile has favouritesPublic enabled
const showFavourites = computed(() => {
  if (isOwnProfile.value) return true;
  return profile.value?.favouritesPublic ?? true;
});

const activeTab = ref<"cards" | "auctions" | "favourites">("cards");

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

// Get actual card objects for favourited items
const favouriteCards = computed(() => {
  const favCardIds = userFavourites.value
    .filter((f: any) => f.itemType === "card")
    .map((f: any) => f.itemId);
  return cards.value.filter((c: any) => favCardIds.includes(c.id));
});

const favouriteAuctions = computed(() => {
  const favAuctionIds = userFavourites.value
    .filter((f: any) => f.itemType === "auction")
    .map((f: any) => f.itemId);
  return auctions.value.filter((a: any) => favAuctionIds.includes(a.id));
});

const isActive = (auction: Auction) => auction.endsAt > Date.now();

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const handleSignOut = () => {
  signOut();
};
</script>

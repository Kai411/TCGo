<template>
  <div>
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 text-lg mb-4">Sign in to view your listings.</p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold mb-6">My Listings</h1>

      <div v-if="loading" class="flex justify-center py-12">
        <div
          class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
        ></div>
      </div>

      <template v-else>
        <!-- Cards for Sale -->
        <section class="mb-10">
          <h2 class="text-lg font-semibold mb-4 text-gray-700">
            Cards for Sale ({{ activeCards.length }})
          </h2>
          <div
            v-if="activeCards.length === 0"
            class="text-gray-400 text-sm py-4"
          >
            No cards listed.
            <NuxtLink
              to="/cards/create"
              class="text-pokemon-blue hover:underline"
              >List one?</NuxtLink
            >
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="card in activeCards"
              :key="card.id"
              class="bg-white rounded-xl p-4 border border-gray-200 flex gap-4 items-center"
            >
              <div
                class="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden"
              >
                <img
                  v-if="card.imageUrls?.length || card.imageUrl"
                  :src="card.imageUrls?.[0] || card.imageUrl"
                  :alt="card.cardName"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm truncate">
                  {{ card.cardName }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ card.cardSet }} · {{ card.condition }}
                </p>
                <p class="text-pokemon-red font-medium text-sm mt-0.5">
                  RM {{ card.price.toFixed(2) }}
                </p>
              </div>
              <button
                @click="handleMarkAsSold(card.id)"
                :disabled="markingAsSold === card.id"
                class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {{ markingAsSold === card.id ? "..." : "Mark Sold" }}
              </button>
            </div>
          </div>
        </section>

        <!-- Sold Cards -->
        <section v-if="soldCards.length > 0" class="mb-10">
          <h2 class="text-lg font-semibold mb-4 text-gray-700">
            Sold ({{ soldCards.length }})
          </h2>
          <div class="space-y-3">
            <div
              v-for="card in soldCards"
              :key="card.id"
              class="bg-white rounded-xl p-4 border border-gray-200 flex gap-4 items-center opacity-60"
            >
              <div
                class="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden"
              >
                <img
                  v-if="card.imageUrls?.length || card.imageUrl"
                  :src="card.imageUrls?.[0] || card.imageUrl"
                  :alt="card.cardName"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm truncate">
                  {{ card.cardName }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ card.cardSet }} · {{ card.condition }}
                </p>
                <p class="text-gray-500 font-medium text-sm mt-0.5">
                  RM {{ card.price.toFixed(2) }}
                </p>
              </div>
              <span
                class="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-medium"
              >
                Sold
              </span>
            </div>
          </div>
        </section>

        <!-- Active Auctions -->
        <section class="mb-10">
          <h2 class="text-lg font-semibold mb-4 text-gray-700">
            Active ({{ activeAuctions.length }})
          </h2>
          <div
            v-if="activeAuctions.length === 0"
            class="text-gray-400 text-sm py-4"
          >
            No active listings.
            <NuxtLink
              to="/auctions/create"
              class="text-pokemon-red hover:underline"
              >Create one?</NuxtLink
            >
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="auction in activeAuctions"
              :key="auction.id"
              class="bg-white rounded-xl p-4 border border-gray-200 flex gap-4 items-center"
            >
              <div
                class="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden"
              >
                <img
                  v-if="auction.imageUrls?.length || auction.imageUrl"
                  :src="auction.imageUrls?.[0] || auction.imageUrl"
                  :alt="auction.cardName"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="`/auctions/${auction.id}`"
                  class="font-semibold text-sm hover:text-pokemon-red transition-colors truncate block"
                >
                  {{ auction.cardName }}
                </NuxtLink>
                <p class="text-xs text-gray-500">{{ auction.title }}</p>
                <div class="flex gap-3 mt-1 text-xs">
                  <span class="text-pokemon-red font-medium"
                    >RM {{ auction.currentPrice.toFixed(2) }}</span
                  >
                  <span class="text-gray-400"
                    >{{ bidCount(auction) }} bid(s)</span
                  >
                  <span class="text-gray-500"
                    >Ends {{ formatTimeLeft(auction.endsAt) }}</span
                  >
                </div>
              </div>
              <NuxtLink
                :to="`/auctions/${auction.id}`"
                class="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-600 transition-colors"
              >
                View
              </NuxtLink>
            </div>
          </div>
        </section>

        <!-- Ended Auctions -->
        <section>
          <h2 class="text-lg font-semibold mb-4 text-gray-700">
            Ended ({{ endedAuctions.length }})
          </h2>
          <div
            v-if="endedAuctions.length === 0"
            class="text-gray-400 text-sm py-4"
          >
            No ended listings yet.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="auction in endedAuctions"
              :key="auction.id"
              class="bg-white rounded-xl p-3 sm:p-4 border border-gray-200"
            >
              <div
                class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div class="flex gap-3 items-start flex-1 min-w-0">
                  <div
                    class="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden"
                  >
                    <img
                      v-if="auction.imageUrls?.length || auction.imageUrl"
                      :src="auction.imageUrls?.[0] || auction.imageUrl"
                      :alt="auction.cardName"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <NuxtLink
                      :to="`/auctions/${auction.id}`"
                      class="font-semibold text-sm hover:text-pokemon-red transition-colors truncate block"
                    >
                      {{ auction.cardName }}
                    </NuxtLink>
                    <p class="text-xs text-gray-500 truncate">
                      {{ auction.title }}
                    </p>
                    <div
                      class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs"
                    >
                      <span
                        class="text-pokemon-red font-medium whitespace-nowrap"
                      >
                        RM {{ auction.currentPrice.toFixed(2) }}
                      </span>
                      <span
                        v-if="getWinner(auction)"
                        class="text-green-600 truncate"
                      >
                        Won by {{ getWinner(auction)?.bidder }}
                      </span>
                      <span v-else class="text-gray-400">No bids</span>
                    </div>
                  </div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  <a
                    v-if="getWinner(auction)"
                    :href="getContactBuyerLink(auction)"
                    target="_blank"
                    rel="noopener"
                    class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <svg
                      class="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                      />
                    </svg>
                    Contact Buyer
                  </a>
                  <NuxtLink
                    :to="`/auctions/${auction.id}`"
                    class="flex-1 sm:flex-none text-center text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-600 transition-colors"
                  >
                    Details
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Auction, Bid } from "~/composables/useAuctions";

const { user, signInWithGoogle } = useAuth();
const { auctions, loading } = useAuctions();
const { cards, loading: cardsLoading, markAsSold } = useCards();

const myAuctions = computed(() =>
  auctions.value.filter((a: any) => a.sellerUid === user.value?.uid),
);

const myCards = computed(() =>
  cards.value
    .filter((c: any) => c.sellerUid === user.value?.uid)
    .sort((a: any, b: any) => b.createdAt - a.createdAt),
);

const activeCards = computed(() => myCards.value.filter((c: any) => !c.sold));
const soldCards = computed(() => myCards.value.filter((c: any) => c.sold));

const activeAuctions = computed(() =>
  myAuctions.value
    .filter((a: any) => a.endsAt > Date.now())
    .sort((a: any, b: any) => a.endsAt - b.endsAt),
);

const endedAuctions = computed(() =>
  myAuctions.value
    .filter((a: any) => a.endsAt <= Date.now())
    .sort((a: any, b: any) => b.endsAt - a.endsAt),
);

const bidCount = (auction: Auction) => Object.keys(auction.bids || {}).length;

const getWinner = (auction: Auction): Bid | null => {
  if (!auction.bids) return null;
  const sorted = Object.values(auction.bids).sort(
    (a, b) => b.amount - a.amount,
  );
  return sorted[0] || null;
};

const formatTimeLeft = (endsAt: number) => {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
  }
  return `in ${hours}h ${minutes}m`;
};

const markingAsSold = ref<string | null>(null);

const handleMarkAsSold = async (cardId: string) => {
  if (!confirm("Mark this card as sold?")) return;
  markingAsSold.value = cardId;
  try {
    await markAsSold(cardId);
  } finally {
    markingAsSold.value = null;
  }
};

// Fetch winner phone numbers for contact button
const buyerPhones = ref<Record<string, string>>({});

const fetchBuyerPhone = async (uid: string) => {
  if (buyerPhones.value[uid]) return;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { firestore } = useFirebase();
    const userDoc = await getDoc(doc(firestore!, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      buyerPhones.value[uid] = (data.whatsappNumber ||
        data.phone ||
        "") as string;
    }
  } catch {}
};

// Fetch phones for all auction winners
watch(
  endedAuctions,
  (auctionsList: any[]) => {
    for (const auction of auctionsList) {
      const winner = getWinner(auction);
      if (winner?.bidderUid) {
        fetchBuyerPhone(winner.bidderUid);
      }
    }
  },
  { immediate: true },
);

const getContactBuyerLink = (auction: any) => {
  const winner = getWinner(auction);
  if (!winner) return "#";
  const phone = buyerPhones.value[winner.bidderUid] || "";
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  // Fix: strip leading 0 and prepend 60 if no country code
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "60" + cleanPhone.slice(1);
  }
  const message = encodeURIComponent(
    `Hi ${winner.bidder}, you won the auction for ${auction.cardName} at RM ${auction.currentPrice.toFixed(2)} on TCGo Marketplace. <br> Let's arrange the deal!`,
  );
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${message}`;
  }
  return `https://wa.me/?text=${message}`;
};
</script>

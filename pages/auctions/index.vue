<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Live Auctions</h1>
      <NuxtLink
        v-if="user"
        to="/auctions/create"
        class="bg-pokemon-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
      >
        + List for Auction
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="publicAuctions.length === 0" class="text-center py-12">
      <p class="text-gray-500 text-lg">No active auctions yet.</p>
      <p class="text-gray-400 mt-1 text-sm">Be the first to list a card!</p>
    </div>

    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    >
      <NuxtLink
        v-for="auction in publicAuctions"
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
          <h3 class="font-semibold text-sm truncate">{{ auction.cardName }}</h3>
          <p class="text-xs text-gray-500 truncate">
            {{ auction.cardSet }} · {{ auction.condition }}
          </p>
          <p class="text-xs text-pokemon-blue truncate mt-0.5">
            {{ auction.seller }}
          </p>
          <div class="flex items-center justify-between mt-2">
            <p class="text-pokemon-red font-bold text-sm">
              RM {{ auction.currentPrice.toFixed(2) }}
            </p>
            <div class="flex items-center gap-1">
              <p
                class="text-xs"
                :class="
                  isEnding(auction.endsAt) ? 'text-red-500' : 'text-gray-400'
                "
              >
                {{ formatTimeLeft(auction.endsAt) }}
              </p>
              <FavouriteButton
                :item-id="auction.id"
                item-type="auction"
                size="sm"
              />
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-1">
            {{ Object.keys(auction.bids || {}).length }} bid(s)
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: "Live Pokemon Card Auctions | TCGo Marketplace",
  meta: [
    {
      name: "description",
      content:
        "Bid on live Pokemon TCG card auctions. Real-time bidding, anti-snipe protection, and auto-bid features. Find rare cards in Malaysia's top TCG marketplace.",
    },
  ],
});

const { auctions, loading } = useAuctions();
const { user } = useAuth();

const publicAuctions = computed(() =>
  auctions.value.filter((a: any) => !a.isPrivate),
);

const isEnding = (endsAt: number) => {
  return endsAt - Date.now() < 3600000;
};

const formatTimeLeft = (endsAt: number) => {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "Ended";

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};
</script>

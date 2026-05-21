<template>
  <div>
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to view your bids.</p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-6 gap-3">
        <h1 class="text-2xl font-bold">My Activity</h1>
        <div
          class="inline-flex p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl"
          role="tablist"
        >
          <NuxtLink
            to="/dashboard/seller"
            class="px-4 py-1.5 text-sm font-semibold rounded-lg text-gray-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
          >
            Listings
          </NuxtLink>
          <span
            class="px-4 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm"
          >
            Bids
          </span>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div
          class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
        ></div>
      </div>

      <template v-else>
        <div v-if="participatedAuctions.length === 0" class="text-center py-12">
          <p class="text-gray-500 dark:text-zinc-400 text-lg">
            You haven't bid on any auctions yet.
          </p>
          <NuxtLink
            to="/auctions"
            class="text-pokemon-red hover:underline mt-2 inline-block text-sm"
          >
            Browse auctions →
          </NuxtLink>
        </div>

        <!-- Active -->
        <section v-if="activeBids.length > 0" class="mb-10">
          <h2 class="text-lg font-semibold mb-4 text-gray-700 dark:text-zinc-200">
            Active ({{ activeBids.length }})
          </h2>
          <div class="space-y-3">
            <div
              v-for="item in activeBids"
              :key="item.auction.id"
              class="bg-white dark:bg-white/[0.04] rounded-xl p-4 border border-gray-200 dark:border-white/[0.08] flex gap-4 items-center"
            >
              <div
                class="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden"
              >
                <img
                  v-if="item.auction.imageUrls?.length || item.auction.imageUrl"
                  :src="cdnUrl(item.auction.imageUrls?.[0] || item.auction.imageUrl, 200)"
                  :alt="item.auction.cardName"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="`/auctions/${item.auction.id}`"
                  class="font-semibold text-sm hover:text-pokemon-red transition-colors truncate block"
                >
                  {{ item.auction.cardName }}
                </NuxtLink>
                <div class="flex gap-3 mt-1 text-xs">
                  <span class="text-pokemon-red font-medium"
                    >Current: RM
                    {{ item.auction.currentPrice.toFixed(2) }}</span
                  >
                  <span class="text-gray-500 dark:text-zinc-400"
                    >Your max: RM {{ item.myHighestBid.toFixed(2) }}</span
                  >
                  <span
                    :class="item.isLeading ? 'text-green-600' : 'text-red-500'"
                    class="font-medium"
                  >
                    {{ item.isLeading ? "🟢 Leading" : "🔴 Outbid" }}
                  </span>
                </div>
              </div>
              <div class="text-right text-xs text-gray-400 dark:text-zinc-500">
                {{ formatTimeLeft(item.auction.endsAt) }}
              </div>
            </div>
          </div>
        </section>

        <!-- Ended -->
        <section v-if="endedBids.length > 0">
          <h2 class="text-lg font-semibold mb-4 text-gray-700 dark:text-zinc-200">
            Ended ({{ endedBids.length }})
          </h2>
          <div class="space-y-3">
            <div
              v-for="item in endedBids"
              :key="item.auction.id"
              class="bg-white dark:bg-white/[0.04] rounded-xl p-4 border flex gap-4 items-center"
              :class="
                item.isWinner
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 dark:border-white/[0.08]'
              "
            >
              <div
                class="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden"
              >
                <img
                  v-if="item.auction.imageUrls?.length || item.auction.imageUrl"
                  :src="cdnUrl(item.auction.imageUrls?.[0] || item.auction.imageUrl, 200)"
                  :alt="item.auction.cardName"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="`/auctions/${item.auction.id}`"
                  class="font-semibold text-sm hover:text-pokemon-red transition-colors truncate block"
                >
                  {{ item.auction.cardName }}
                </NuxtLink>
                <div class="flex gap-3 mt-1 text-xs">
                  <span class="text-pokemon-red font-medium"
                    >Final: RM {{ item.auction.currentPrice.toFixed(2) }}</span
                  >
                  <span class="text-gray-500 dark:text-zinc-400"
                    >Your max: RM {{ item.myHighestBid.toFixed(2) }}</span
                  >
                  <span v-if="item.isWinner" class="text-green-600 font-medium"
                    >🏆 Won</span
                  >
                  <span v-else class="text-red-500">Lost</span>
                </div>
              </div>
              <NuxtLink
                :to="`/auctions/${item.auction.id}`"
                class="text-xs bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] px-3 py-1.5 rounded-lg text-gray-600 dark:text-zinc-300 transition-colors"
              >
                Details
              </NuxtLink>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";

const { user, signInWithGoogle } = useAuth();
const { auctions, loading } = useAuctions();

interface BidItem {
  auction: Auction;
  myHighestBid: number;
  isLeading: boolean;
  isWinner: boolean;
}

const participatedAuctions = computed<BidItem[]>(() => {
  if (!user.value) return [];

  return auctions.value
    .filter((auction) => {
      if (!auction.bids) return false;
      return Object.values(auction.bids).some(
        (bid) => bid.bidderUid === user.value!.uid,
      );
    })
    .map((auction) => {
      const myBids = Object.values(auction.bids).filter(
        (bid) => bid.bidderUid === user.value!.uid,
      );
      const myHighestBid = Math.max(...myBids.map((b) => b.amount));
      const allBidsSorted = Object.values(auction.bids).sort(
        (a, b) => b.amount - a.amount,
      );
      const topBid = allBidsSorted[0];
      const isLeading = topBid?.bidderUid === user.value!.uid;
      const isEnded = auction.endsAt <= Date.now();
      const isWinner = isEnded && isLeading;

      return { auction, myHighestBid, isLeading, isWinner };
    });
});

const activeBids = computed(() =>
  participatedAuctions.value
    .filter((item) => item.auction.endsAt > Date.now())
    .sort((a, b) => a.auction.endsAt - b.auction.endsAt),
);

const endedBids = computed(() =>
  participatedAuctions.value
    .filter((item) => item.auction.endsAt <= Date.now())
    .sort((a, b) => b.auction.endsAt - a.auction.endsAt),
);

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

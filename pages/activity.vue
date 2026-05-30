<template>
  <div>
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">
        Sign in to view your activity.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 class="text-2xl font-bold text-ink dark:text-white">My Activity</h1>
        <TabStrip v-model="activeTab" :tabs="tabs" />
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <template v-else>
        <!-- ── Purchases ───────────────────────────────────────────── -->
        <div v-if="activeTab === 'purchases'" class="space-y-4">
          <div
            v-if="route.query.placed"
            class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center gap-3"
          >
            <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <div>
              <p class="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">
                {{ route.query.placed }} {{ Number(route.query.placed) === 1 ? "order" : "orders" }} placed
              </p>
              <p class="text-xs text-emerald-700 dark:text-emerald-300">
                Tap WhatsApp on each order to arrange payment &amp; shipping with the seller.
              </p>
            </div>
          </div>

          <div v-if="ordersLoadingBuyer" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
          </div>
          <p v-else-if="!buyerCompiledOrders.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No purchases yet.
            <NuxtLink to="/" class="text-pokemon-red hover:underline ml-1">Browse cards →</NuxtLink>
          </p>
          <div v-else class="grid lg:grid-cols-2 gap-3 items-start">
            <CompiledOrderCard
              v-for="order in buyerCompiledOrders"
              :key="order.id"
              :order="order"
              role="buyer"
              @mark-delivered="markDelivered(order.id)"
              @cancel="cancelOrder(order.id)"
            />
          </div>
        </div>

        <!-- ── Bidding ─────────────────────────────────────────────── -->
        <div v-if="activeTab === 'bidding'">
          <p v-if="!activeBids.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No active bids.
            <NuxtLink to="/auctions" class="text-pokemon-red hover:underline ml-1">Browse auctions →</NuxtLink>
          </p>
          <div v-else class="grid grid-cols-2 gap-2 sm:gap-3 items-start">
            <ActivityRow
              v-for="item in activeBids"
              :key="item.auction.id"
              :image="item.auction.imageUrls?.[0] || item.auction.imageUrl"
              :title="item.auction.cardName"
              :subtitle="item.auction.cardSet"
              :to="`/auctions/${item.auction.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">Current RM {{ item.auction.currentPrice.toFixed(2) }}</span>
                <span class="text-gray-500 dark:text-zinc-400 ml-2">Your max RM {{ item.myHighestBid.toFixed(2) }}</span>
                <span class="ml-2 font-medium" :class="item.isLeading ? 'text-green-600' : 'text-red-500'">
                  {{ item.isLeading ? "Leading" : "Outbid" }}
                </span>
              </template>
              <template #actions>
                <span class="text-xs text-gray-400 dark:text-zinc-500">{{ formatTimeLeft(item.auction.endsAt) }}</span>
              </template>
            </ActivityRow>
          </div>
        </div>

        <!-- ── Won ─────────────────────────────────────────────────── -->
        <div v-if="activeTab === 'won'">
          <p v-if="!wonBids.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No wins yet.
          </p>
          <div v-else class="grid grid-cols-2 gap-2 sm:gap-3 items-start">
            <ActivityRow
              v-for="item in wonBids"
              :key="item.auction.id"
              :image="item.auction.imageUrls?.[0] || item.auction.imageUrl"
              :title="item.auction.cardName"
              :subtitle="item.auction.cardSet"
              :to="`/auctions/${item.auction.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">Final RM {{ item.auction.currentPrice.toFixed(2) }}</span>
              </template>
              <template #actions>
                <span class="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">Won</span>
              </template>
            </ActivityRow>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

type TabId = "purchases" | "bidding" | "won";

const route = useRoute();
const router = useRouter();
const { user, signInWithGoogle } = useAuth();
const { auctions, loading } = useAuctions();
const {
  buyerCompiledOrders,
  loadingBuyer: ordersLoadingBuyer,
  listenBuyerCompiledOrders,
  markDelivered,
  cancelOrder,
} = useCompiledOrders();

// Per-user bid index: auctionId → { highestBid }
const uid = computed(() => user.value?.uid || "");
const { bidIndex } = useUserBidIndex(uid.value);

// Map legacy ?tab values (orders/selling/history) onto the buyer tabs.
const normalizeTab = (t: unknown): TabId => {
  if (t === "bidding") return "bidding";
  if (t === "won") return "won";
  return "purchases";
};
const activeTab = ref<TabId>(normalizeTab(route.query.tab));
watch(activeTab, (id) => {
  router.replace({ query: { ...route.query, tab: id } });
});

onMounted(() => {
  if (user.value) listenBuyerCompiledOrders();
});
watch(user, (u) => {
  if (u) listenBuyerCompiledOrders();
});

// ── Bidding ─────────────────────────────────────────────────────────
interface BidItem {
  auction: Auction;
  myHighestBid: number;
  isLeading: boolean;
  isWinner: boolean;
}

const participated = computed<BidItem[]>(() => {
  if (!user.value) return [];
  return auctions.value
    .filter((a) => !!bidIndex.value[a.id])
    .map((auction) => {
      const myHighestBid = bidIndex.value[auction.id]?.highestBid ?? 0;
      const isLeading = auction.topBidderUid === user.value!.uid;
      const isEnded = auction.endsAt <= Date.now();
      return { auction, myHighestBid, isLeading, isWinner: isEnded && isLeading };
    });
});

const activeBids = computed(() =>
  participated.value
    .filter((b) => b.auction.endsAt > Date.now())
    .sort((a, b) => a.auction.endsAt - b.auction.endsAt),
);
const wonBids = computed(() =>
  participated.value
    .filter((b) => b.isWinner)
    .sort((a, b) => b.auction.endsAt - a.auction.endsAt),
);

const activePurchases = computed(
  () =>
    buyerCompiledOrders.value.filter(
      (o) => o.status !== "delivered" && o.status !== "cancelled",
    ).length,
);

const tabs = computed<TabItem[]>(() => [
  { id: "purchases", label: "Purchases", count: activePurchases.value },
  { id: "bidding", label: "Bidding", count: activeBids.value.length },
  { id: "won", label: "Won", count: wonBids.value.length },
]);

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

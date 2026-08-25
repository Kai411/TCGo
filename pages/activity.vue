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
        <h1 class="text-2xl font-bold text-ink dark:text-white">{{ activeTab === "purchases" ? "My Orders" : "My Activity" }}</h1>
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
                Pay now to confirm your order with the seller.
              </p>
            </div>
          </div>

          <div v-if="ordersLoadingBuyer" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
          </div>

          <template v-else-if="!buyerCompiledOrders.length">
            <div class="text-center py-16">
              <p class="text-gray-500 dark:text-zinc-400">You haven't bought anything yet.</p>
              <NuxtLink to="/" class="text-pokemon-red font-semibold hover:underline mt-1 inline-block text-sm">
                Browse cards →
              </NuxtLink>
            </div>
          </template>

          <template v-else>
            <!-- Filter by the states buyers actually think in -->
            <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                v-for="f in orderFilters"
                :key="f.id"
                @click="orderFilter = f.id"
                class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                :class="orderFilter === f.id
                  ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white'
                  : 'border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300 hover:border-gray-300'"
              >
                {{ f.label }}
                <span v-if="f.count" class="ml-1 opacity-60">{{ f.count }}</span>
              </button>
            </div>

            <!-- Anything needing the buyer's action, pulled to the top -->
            <div
              v-if="orderFilter === 'all' && needsAction.length"
              class="surface rounded-2xl border border-amber-200 dark:border-amber-500/20 overflow-hidden"
            >
              <p class="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10">
                Needs your action
              </p>
              <div class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                <OrderListRow
                  v-for="order in needsAction"
                  :key="order.id"
                  :order="order"
                  @pay="goToOrder"
                  @mark-delivered="markDelivered"
                />
              </div>
            </div>

            <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
              <p v-if="!visibleOrders.length" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
                No {{ activeFilterLabel.toLowerCase() }} orders.
              </p>
              <div v-else class="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                <OrderListRow
                  v-for="order in visibleOrders"
                  :key="order.id"
                  :order="order"
                  @pay="goToOrder"
                  @mark-delivered="markDelivered"
                />
              </div>
            </div>
          </template>
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
} = useCompiledOrders();

// ── Order list: filters + ordering ───────────────────────────────────
// Buyers think in "have I paid / is it coming / is it done", not in the
// internal status enum, so the filters collapse statuses into those groups.
type OrderFilter = "all" | "topay" | "toreceive" | "completed" | "cancelled";
const orderFilter = ref<OrderFilter>("all");

const inGroup = (status: string, f: OrderFilter) => {
  if (f === "all") return true;
  if (f === "topay") return status === "pending" || status === "confirmed";
  if (f === "toreceive") return status === "paid" || status === "shipped";
  if (f === "completed") return status === "delivered";
  return status === "cancelled";
};

// Newest first, but anything the buyer must act on floats above the rest.
const actionRank = (status: string) =>
  status === "pending" ? 0 : status === "shipped" ? 1 : 2;

const sortedOrders = computed(() =>
  [...buyerCompiledOrders.value].sort(
    (a, b) => actionRank(a.status) - actionRank(b.status) || b.createdAt - a.createdAt,
  ),
);

const needsAction = computed(() =>
  sortedOrders.value.filter((o) => o.status === "pending" || o.status === "shipped"),
);

const visibleOrders = computed(() =>
  sortedOrders.value.filter((o) => inGroup(o.status, orderFilter.value)),
);

const countFor = (f: OrderFilter) =>
  buyerCompiledOrders.value.filter((o) => inGroup(o.status, f)).length;

const orderFilters = computed(() => [
  { id: "all" as const, label: "All", count: buyerCompiledOrders.value.length },
  { id: "topay" as const, label: "To pay", count: countFor("topay") },
  { id: "toreceive" as const, label: "To receive", count: countFor("toreceive") },
  { id: "completed" as const, label: "Completed", count: countFor("completed") },
  { id: "cancelled" as const, label: "Cancelled", count: countFor("cancelled") },
]);

const activeFilterLabel = computed(
  () => orderFilters.value.find((f) => f.id === orderFilter.value)?.label ?? "",
);

const goToOrder = (id: string) => router.push(`/orders/${id}`);

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

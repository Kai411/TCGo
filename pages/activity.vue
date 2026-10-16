<template>
  <div>
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">
        Sign in to view your activity.
      </p>
      <button
        @click="goToLogin"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in
      </button>
    </div>

    <template v-else>
      <!-- Phones: back to Account (where these screens are opened from), the
           title, then full-width tabs with a sliding underline. -->
      <div class="lg:hidden">
        <SubpageHeader :title="activeTab === 'purchases' ? 'My Orders' : 'My Activity'" />
        <div
          class="relative -mx-4 px-4 flex border-b border-black/[0.06] dark:border-white/[0.08] mb-4 select-none"
          role="tablist"
        >
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === t.id"
            @click="activeTab = t.id as TabId"
            class="flex-1 min-h-[44px] text-sm font-semibold transition-colors duration-150"
            :class="activeTab === t.id ? 'text-ink dark:text-white' : 'text-ink-soft dark:text-zinc-500'"
          >
            {{ t.label }}
            <span v-if="t.count" class="ml-0.5 text-xs font-medium tabular-nums opacity-70">{{ t.count }}</span>
          </button>
          <span
            class="absolute bottom-0 h-0.5 transition-transform duration-200 ease-out motion-reduce:transition-none"
            :style="{ left: '1rem', width: `calc((100% - 2rem) / ${tabs.length})`, transform: `translateX(${activeTabIndex * 100}%)` }"
            aria-hidden="true"
          >
            <span class="block mx-auto w-10 h-full rounded-full bg-pokemon-red" />
          </span>
        </div>
      </div>

      <div class="hidden lg:flex items-center justify-between mb-6 gap-3 flex-wrap">
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

          <!-- Filtered, so a buyer whose only order was absorbed into another
               parcel sees the empty state rather than a blank list. -->
          <template v-else-if="!sortedOrders.length">
            <div class="text-center py-16">
              <p class="text-gray-500 dark:text-zinc-400">You haven't bought anything yet.</p>
              <NuxtLink to="/" class="text-pokemon-red font-semibold hover:underline mt-1 inline-block text-sm">
                Browse cards →
              </NuxtLink>
            </div>
          </template>

          <template v-else>
            <!-- Filter by the states buyers actually think in -->
            <div class="flex gap-2 overflow-x-auto max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden -mx-4 px-4 lg:pb-1 lg:-mx-1 lg:px-1">
              <button
                v-for="f in orderFilters"
                :key="f.id"
                @click="orderFilter = f.id"
                class="shrink-0 inline-flex items-center min-h-[36px] px-4 text-[13px] lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs rounded-full font-semibold border transition-colors"
                :class="orderFilter === f.id
                  ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white'
                  : 'border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300 lg:hover:border-gray-300'"
              >
                {{ f.label }}
                <span v-if="f.count" class="ml-1 opacity-60">{{ f.count }}</span>
              </button>
            </div>

            <!-- Anything needing the buyer's action, pulled to the top -->
            <div
              v-if="orderFilter === 'all' && needsAction.length"
              class="panel surface rounded-2xl border border-amber-200 dark:border-amber-500/20 lg:overflow-hidden"
            >
              <p class="flex items-center gap-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 lg:px-4 lg:py-2 lg:bg-amber-50 lg:dark:bg-amber-500/10">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 lg:hidden" aria-hidden="true" />
                Needs your action
              </p>
              <!-- Phones: one card per order with a gap; desktop: one box
                   split by hairlines. -->
              <div class="mt-2 space-y-3 lg:mt-0 lg:space-y-0 lg:divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                <OrderListRow
                  v-for="order in needsAction"
                  :key="order.id"
                  :order="order"
                  @pay="goToOrder"
                  @mark-delivered="markDelivered"
                />
              </div>
            </div>

            <div class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] lg:overflow-hidden">
              <p
                v-if="orderFilter === 'all' && needsAction.length && visibleOrders.length"
                class="lg:hidden pb-3 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-zinc-400"
              >
                All orders
              </p>
              <p v-if="!visibleOrders.length" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
                No {{ activeFilterLabel.toLowerCase() }} orders.
              </p>
              <div v-else class="space-y-3 lg:space-y-0 lg:divide-y divide-black/[0.05] dark:divide-white/[0.06]">
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
          <div v-else class="grid lg:grid-cols-2 lg:gap-3 items-start">
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
                <span class="text-gray-500 dark:text-zinc-400 lg:ml-2">Your max RM {{ item.myHighestBid.toFixed(2) }}</span>
                <span class="hidden lg:inline ml-2 font-medium" :class="item.isLeading ? 'text-green-600' : 'text-red-500'">
                  {{ item.isLeading ? "Leading" : "Outbid" }}
                </span>
              </template>
              <template #actions>
                <!-- Phones: where you stand and how long is left, as one line
                     under the price. -->
                <span
                  class="lg:hidden text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  :class="item.isLeading
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'"
                >
                  {{ item.isLeading ? "Leading" : "Outbid" }}
                </span>
                <span
                  class="text-xs lg:font-normal lg:text-gray-400 lg:dark:text-zinc-500"
                  :class="endsSoon(item.auction.endsAt) ? 'text-pokemon-red font-semibold' : 'text-ink-muted dark:text-zinc-400'"
                >
                  <span class="lg:hidden">Ends in </span>{{ formatTimeLeft(item.auction.endsAt) }}
                </span>
              </template>
            </ActivityRow>
          </div>
        </div>

        <!-- ── Won ─────────────────────────────────────────────────── -->
        <div v-if="activeTab === 'won'">
          <p v-if="!wonBids.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No wins yet.
          </p>
          <div v-else class="grid lg:grid-cols-2 lg:gap-3 items-start">
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
                <span class="lg:hidden text-xs text-ink-muted dark:text-zinc-400">Ended {{ endedDate(item.auction.endsAt) }}</span>
                <span class="hidden lg:inline text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">Won</span>
              </template>
            </ActivityRow>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { withoutMergedChildren } from "~/shared/delivery-stage";
import {
  ORDER_FILTER_LABELS,
  inOrderGroup,
  parseOrderFilter,
  type OrderFilter,
} from "~/shared/order-filters";
import type { Auction } from "~/composables/useAuctions";

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

type TabId = "purchases" | "bidding" | "won";

const route = useRoute();
const router = useRouter();
const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { auctions, loading } = useAuctions();
const {
  buyerCompiledOrders,
  loadingBuyer: ordersLoadingBuyer,
  listenBuyerCompiledOrders,
  markDelivered,
} = useCompiledOrders();

// ── Order list: filters + ordering ───────────────────────────────────
// Grouping lives in shared/order-filters so the account page's status
// shortcuts count the same way. They link here with ?filter=.
const orderFilter = ref<OrderFilter>(parseOrderFilter(route.query.filter));
watch(
  () => route.query.filter,
  (f) => {
    if (f !== undefined) orderFilter.value = parseOrderFilter(f);
  },
);
const inGroup = inOrderGroup;

// Newest first, but anything the buyer must act on floats above the rest.
const actionRank = (status: string) =>
  status === "pending" ? 0 : status === "shipped" ? 1 : 2;

const sortedOrders = computed(() =>
  // A merged child is a stub pointing at the parcel that absorbed it. Showing
  // it beside its parent presents one delivery as two.
  withoutMergedChildren([...buyerCompiledOrders.value]).sort(
    (a, b) => actionRank(a.status) - actionRank(b.status) || b.createdAt - a.createdAt,
  ),
);

const needsAction = computed(() =>
  sortedOrders.value.filter((o) => o.status === "pending" || o.status === "shipped"),
);

const visibleOrders = computed(() =>
  sortedOrders.value.filter((o) => inGroup(o.status, orderFilter.value)),
);

// Counted off the same filtered list the rows come from. Reading
// buyerCompiledOrders directly meant a merged child was counted but never
// shown, so a tab could say 3 above two rows.
const countFor = (f: OrderFilter) =>
  sortedOrders.value.filter((o) => inGroup(o.status, f)).length;

const orderFilters = computed(() =>
  (["all", "topay", "intransit", "completed", "cancelled"] as const).map((id) => ({
    id,
    label: ORDER_FILTER_LABELS[id],
    count: id === "all" ? sortedOrders.value.length : countFor(id),
  })),
);

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

// The list asks the courier where things are, rather than waiting for the
// buyer to open each order. Without this a row sat at "Shipped" until tapped,
// then jumped to Delivered — the parcel had arrived days before; the list had
// simply never looked.
const { syncTracking } = useBuyerTracking();

onMounted(() => {
  if (user.value) {
    listenBuyerCompiledOrders();
    void syncTracking();
  }
});
watch(user, (u) => {
  if (u) {
    listenBuyerCompiledOrders();
    void syncTracking();
  }
});

// Orders arrive from the listener after mount, so the first sync usually runs
// against an empty list. Re-run once they land, then leave it to the TTL.
let syncedOnce = false;
watch(sortedOrders, (list) => {
  if (syncedOnce || !list.length) return;
  syncedOnce = true;
  void syncTracking();
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

const activeTabIndex = computed(() =>
  Math.max(0, tabs.value.findIndex((t) => t.id === activeTab.value)),
);

// Under an hour left: the phone row turns the countdown red.
const endsSoon = (endsAt: number) => endsAt - Date.now() < 3600000;

const endedDate = (endsAt: number) =>
  new Date(endsAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" });

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

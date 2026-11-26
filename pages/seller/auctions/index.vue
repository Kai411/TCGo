<template>
  <div class="sl-page">
    <SellerGate v-if="!user" message="Sign in to manage your auctions." />

    <template v-else>
      <SellerPageHead
        title="Auctions"
        description="Cards going to the highest bidder. Ended auctions with a winner turn into an order."
      >
        <NuxtLink to="/seller/auctions/new" class="mc-btn mc-btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Start an auction
        </NuxtLink>
      </SellerPageHead>

      <McTabs v-model="tab" :tabs="tabs" class="mb-4" />

      <div v-if="loading" class="mc-skel h-[200px]" aria-busy="true" aria-label="Loading auctions" />

      <div v-else class="mc-card overflow-hidden">
        <template v-if="tab === 'active'">
          <div v-if="!activeAuctions.length" class="mc-empty flex items-center justify-between gap-3">
            <span>No live auctions.</span>
            <NuxtLink to="/seller/auctions/new" class="mc-btn mc-btn-sm">Start one</NuxtLink>
          </div>
          <NuxtLink v-for="auction in activeAuctions" v-else :key="auction.id" :to="`/auctions/${auction.id}`" class="mc-row">
            <img :src="auction.imageUrls?.[0] || auction.imageUrl" alt="" class="mc-thumb" loading="lazy" />
            <div class="min-w-0">
              <p class="mc-row-title">{{ auction.cardName }}</p>
              <p class="mc-meta truncate">
                {{ auction.bidCount ?? 0 }} bid{{ (auction.bidCount ?? 0) === 1 ? "" : "s" }}
                · {{ formatTimeLeft(auction.endsAt) }}
                <template v-if="auction.cardSet || auction.title"> · {{ auction.cardSet || auction.title }}</template>
              </p>
            </div>
            <span class="text-right">
              <span class="mc-num font-semibold block">{{ formatRM(auction.currentPrice) }}</span>
              <span class="mc-small">current bid</span>
            </span>
          </NuxtLink>
        </template>

        <template v-if="tab === 'ended'">
          <p v-if="!endedAuctions.length" class="mc-empty">No ended auctions yet.</p>
          <div
            v-for="auction in endedAuctions"
            v-else
            :key="auction.id"
            class="mc-row mc-row--split"
            :class="{ 'is-done': !getWinner(auction) }"
          >
            <NuxtLink :to="`/auctions/${auction.id}`" class="mc-row-link">
              <img :src="auction.imageUrls?.[0] || auction.imageUrl" alt="" class="mc-thumb" loading="lazy" />
              <div class="min-w-0">
                <p class="mc-row-title">{{ auction.cardName }}</p>
                <p class="mc-meta truncate">
                  <span class="mc-num font-semibold text-[var(--ink)]">{{ formatRM(auction.currentPrice) }}</span>
                  · <template v-if="getWinner(auction)">won by {{ getWinner(auction)?.bidder }}</template>
                  <template v-else>no bids</template>
                </p>
              </div>
            </NuxtLink>
            <NuxtLink v-if="auction.orderId" :to="`/orders/${auction.orderId}`" class="mc-btn mc-btn-sm">
              {{ auction.status === "sold" ? "View order" : "Awaiting payment" }}
            </NuxtLink>
            <span v-else-if="getWinner(auction)" class="mc-small">Finalising…</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatRM } from "~/shared/format-money";
import type { Auction } from "~/composables/useAuctions";

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Auctions | TCGo" });

const {user} = useAuth();
const { auctions, loading } = useAuctions();

const tab = ref<"active" | "ended">("active");

const myAuctions = computed(() =>
  auctions.value.filter((a: Auction) => a.sellerUid === user.value?.uid),
);
const activeAuctions = computed(() =>
  myAuctions.value
    .filter((a: Auction) => a.endsAt > Date.now())
    .sort((a: Auction, b: Auction) => a.endsAt - b.endsAt),
);
const endedAuctions = computed(() =>
  myAuctions.value
    .filter((a: Auction) => a.endsAt <= Date.now())
    .sort((a: Auction, b: Auction) => b.endsAt - a.endsAt),
);

const tabs = computed<TabItem[]>(() => [
  { id: "active", label: "Active", count: activeAuctions.value.length },
  { id: "ended", label: "Ended", count: endedAuctions.value.length },
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

const getWinner = (auction: Auction) => {
  if (!auction.topBidderUid) return null;
  return { bidder: auction.topBidder ?? "", bidderUid: auction.topBidderUid };
};

// Ended auctions settle lazily — opening this dashboard finalises any that
// the clock has run out on, creating the winner's order (or voiding a result
// whose payment window lapsed). The route is idempotent.
const { authedFetch } = useAuthedFetch();
const settled = ref<Set<string>>(new Set());

const settleEnded = async (list: Auction[]) => {
  for (const auction of list) {
    if (settled.value.has(auction.id)) continue;
    if (!getWinner(auction)) continue;
    if (auction.status === "sold" || auction.status === "expired") continue;
    settled.value.add(auction.id);
    try {
      await authedFetch("/api/auctions/settle", {
        method: "POST",
        body: { auctionId: auction.id },
      });
    } catch {
      // Non-fatal: the auction page will retry when either party opens it.
      settled.value.delete(auction.id);
    }
  }
};

watch(
  endedAuctions,
  (list) => {
    if (user.value) void settleEnded(list);
  },
  { immediate: true },
);
</script>

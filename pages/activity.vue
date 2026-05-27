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
        <div
          class="inline-flex p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl"
          role="tablist"
        >
          <button
            v-for="t in tabs"
            :key="t.id"
            @click="activeTab = t.id"
            class="px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors"
            :class="
              activeTab === t.id
                ? 'bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white'
            "
          >
            {{ t.label }}
            <span
              v-if="t.count > 0"
              class="ml-1 text-xs opacity-70 tabular-nums"
            >
              {{ t.count }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="loading || cardsLoading" class="flex justify-center py-16">
        <div
          class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <template v-else>
        <!-- Selling tab -->
        <div v-if="activeTab === 'selling'" class="space-y-8">
          <ActivitySection
            title="Cards for sale"
            :count="activeCards.length"
            empty-text="No cards listed."
            empty-cta="List one"
            empty-cta-to="/cards/create"
          >
            <ActivityRow
              v-for="card in activeCards"
              :key="card.id"
              :image="card.imageUrls?.[0] || card.imageUrl"
              :title="card.cardName"
              :subtitle="`${card.cardSet || ''} · ${card.condition || ''}`"
              :to="`/cards/${card.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">
                  RM {{ card.price.toFixed(2) }}
                </span>
              </template>
              <template #actions>
                <button
                  @click.stop.prevent="handleMarkAsSold(card.id)"
                  :disabled="markingAsSold === card.id"
                  class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                >
                  {{ markingAsSold === card.id ? "..." : "Mark sold" }}
                </button>
              </template>
            </ActivityRow>
          </ActivitySection>

          <ActivitySection
            title="Active auctions"
            :count="activeAuctions.length"
            empty-text="No active auctions."
            empty-cta="Create one"
            empty-cta-to="/auctions/create"
          >
            <ActivityRow
              v-for="auction in activeAuctions"
              :key="auction.id"
              :image="auction.imageUrls?.[0] || auction.imageUrl"
              :title="auction.cardName"
              :subtitle="auction.cardSet || auction.title"
              :to="`/auctions/${auction.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">
                  RM {{ auction.currentPrice.toFixed(2) }}
                </span>
                <span class="text-gray-400 dark:text-zinc-500 ml-2">
                  {{ auction.bidCount ?? 0 }} bid{{
                    (auction.bidCount ?? 0) === 1 ? "" : "s"
                  }}
                </span>
                <span class="text-gray-500 dark:text-zinc-400 ml-2">
                  {{ formatTimeLeft(auction.endsAt) }}
                </span>
              </template>
            </ActivityRow>
          </ActivitySection>
        </div>

        <!-- Bidding tab -->
        <div v-if="activeTab === 'bidding'" class="space-y-8">
          <ActivitySection
            title="Live bids"
            :count="activeBids.length"
            empty-text="No active bids."
            empty-cta="Browse auctions"
            empty-cta-to="/auctions"
          >
            <ActivityRow
              v-for="item in activeBids"
              :key="item.auction.id"
              :image="item.auction.imageUrls?.[0] || item.auction.imageUrl"
              :title="item.auction.cardName"
              :subtitle="item.auction.cardSet"
              :to="`/auctions/${item.auction.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">
                  Current RM {{ item.auction.currentPrice.toFixed(2) }}
                </span>
                <span class="text-gray-500 dark:text-zinc-400 ml-2">
                  Your max RM {{ item.myHighestBid.toFixed(2) }}
                </span>
                <span
                  class="ml-2 font-medium"
                  :class="item.isLeading ? 'text-green-600' : 'text-red-500'"
                >
                  {{ item.isLeading ? "Leading" : "Outbid" }}
                </span>
              </template>
              <template #actions>
                <span class="text-xs text-gray-400 dark:text-zinc-500">
                  {{ formatTimeLeft(item.auction.endsAt) }}
                </span>
              </template>
            </ActivityRow>
          </ActivitySection>
        </div>

        <!-- History tab -->
        <div v-if="activeTab === 'history'" class="space-y-8">
          <ActivitySection
            title="Sold"
            :count="soldCards.length"
            empty-text="No completed sales yet."
          >
            <ActivityRow
              v-for="card in soldCards"
              :key="card.id"
              :image="card.imageUrls?.[0] || card.imageUrl"
              :title="card.cardName"
              :subtitle="`${card.cardSet || ''} · ${card.condition || ''}`"
              :to="`/cards/${card.id}`"
              :dim="true"
            >
              <template #meta>
                <span class="text-gray-500 dark:text-zinc-400">
                  RM {{ card.price.toFixed(2) }}
                </span>
              </template>
              <template #actions>
                <span
                  class="text-xs bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-zinc-400 px-3 py-1.5 rounded-lg font-medium"
                >
                  Sold
                </span>
              </template>
            </ActivityRow>
          </ActivitySection>

          <ActivitySection
            title="Ended auctions"
            :count="endedAuctions.length"
            empty-text="No ended auctions yet."
          >
            <ActivityRow
              v-for="auction in endedAuctions"
              :key="auction.id"
              :image="auction.imageUrls?.[0] || auction.imageUrl"
              :title="auction.cardName"
              :subtitle="auction.cardSet || auction.title"
              :to="`/auctions/${auction.id}`"
              :dim="!getWinner(auction)"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">
                  RM {{ auction.currentPrice.toFixed(2) }}
                </span>
                <span
                  v-if="getWinner(auction)"
                  class="text-green-600 ml-2 truncate"
                >
                  Won by {{ getWinner(auction)?.bidder }}
                </span>
                <span v-else class="text-gray-400 dark:text-zinc-500 ml-2">
                  No bids
                </span>
              </template>
              <template #actions>
                <a
                  v-if="getWinner(auction)"
                  :href="getContactBuyerLink(auction)"
                  target="_blank"
                  rel="noopener"
                  class="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium"
                  @click.stop
                >
                  Contact buyer
                </a>
              </template>
            </ActivityRow>
          </ActivitySection>

          <ActivitySection
            title="Won auctions"
            :count="wonBids.length"
            empty-text="No wins yet."
          >
            <ActivityRow
              v-for="item in wonBids"
              :key="item.auction.id"
              :image="item.auction.imageUrls?.[0] || item.auction.imageUrl"
              :title="item.auction.cardName"
              :subtitle="item.auction.cardSet"
              :to="`/auctions/${item.auction.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">
                  Final RM {{ item.auction.currentPrice.toFixed(2) }}
                </span>
              </template>
              <template #actions>
                <span
                  class="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium"
                >
                  Won
                </span>
              </template>
            </ActivityRow>
          </ActivitySection>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";
import type { Card } from "~/composables/useCards";

type TabId = "selling" | "bidding" | "history";

const route = useRoute();
const router = useRouter();
const { user, signInWithGoogle } = useAuth();
const { auctions, loading } = useAuctions();
const { cards, loading: cardsLoading, markAsSold } = useCards();

// Per-user bid index: auctionId → { highestBid }
const uid = computed(() => user.value?.uid || "");
const { bidIndex } = useUserBidIndex(uid.value);

const activeTab = ref<TabId>(
  (route.query.tab as TabId) || "selling",
);
watch(activeTab, (id) => {
  router.replace({ query: { ...route.query, tab: id } });
});

const myCards = computed(() =>
  cards.value
    .filter((c: Card) => c.sellerUid === user.value?.uid)
    .sort((a: Card, b: Card) => b.createdAt - a.createdAt),
);
const activeCards = computed(() => myCards.value.filter((c: Card) => !c.sold));
const soldCards = computed(() => myCards.value.filter((c: Card) => c.sold));

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

const tabs = computed(() => [
  {
    id: "selling" as TabId,
    label: "Selling",
    count: activeCards.value.length + activeAuctions.value.length,
  },
  {
    id: "bidding" as TabId,
    label: "Bidding",
    count: activeBids.value.length,
  },
  {
    id: "history" as TabId,
    label: "History",
    count:
      soldCards.value.length + endedAuctions.value.length + wonBids.value.length,
  },
]);

const getWinner = (auction: Auction) => {
  if (!auction.topBidderUid) return null;
  return { bidder: auction.topBidder ?? "", bidderUid: auction.topBidderUid };
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

// Winner phones for the WhatsApp contact buttons in history.
const buyerPhones = ref<Record<string, string>>({});
const fetchBuyerPhone = async (uid: string) => {
  if (buyerPhones.value[uid]) return;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { firestore } = useFirebase();
    const userDoc = await getDoc(doc(firestore!, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      buyerPhones.value[uid] = (data.whatsappNumber || data.phone || "") as string;
    }
  } catch {}
};
watch(
  endedAuctions,
  (list) => {
    for (const auction of list) {
      const winner = getWinner(auction);
      if (winner?.bidderUid) fetchBuyerPhone(winner.bidderUid);
    }
  },
  { immediate: true },
);

const getContactBuyerLink = (auction: Auction): string => {
  const winner = getWinner(auction);
  if (!winner) return "#";
  let cleanPhone = (buyerPhones.value[winner.bidderUid] || "").replace(
    /[^0-9]/g,
    "",
  );
  if (cleanPhone.startsWith("0")) cleanPhone = "60" + cleanPhone.slice(1);
  const message = encodeURIComponent(
    `Hi ${winner.bidder}, you won the auction for ${auction.cardName} at RM ${auction.currentPrice.toFixed(2)} on TCGo Marketplace. Let's arrange the deal!`,
  );
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${message}`
    : `https://wa.me/?text=${message}`;
};
</script>

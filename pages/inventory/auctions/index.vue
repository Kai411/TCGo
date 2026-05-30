<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to manage your auctions.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-5">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Auctions</h1>
        <NuxtLink
          to="/inventory/auctions/new"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Start an auction
        </NuxtLink>
      </div>

      <TabStrip v-model="tab" :tabs="tabs" />

      <div v-if="loading" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <template v-else>
        <!-- Active -->
        <div v-if="tab === 'active'" class="mt-5">
          <p v-if="!activeAuctions.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No active auctions.
            <NuxtLink to="/inventory/auctions/new" class="text-pokemon-red hover:underline ml-1">Create one →</NuxtLink>
          </p>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <ActivityRow
              v-for="auction in activeAuctions"
              :key="auction.id"
              :image="auction.imageUrls?.[0] || auction.imageUrl"
              :title="auction.cardName"
              :subtitle="auction.cardSet || auction.title"
              :to="`/auctions/${auction.id}`"
            >
              <template #meta>
                <span class="text-pokemon-red font-semibold">RM {{ auction.currentPrice.toFixed(2) }}</span>
                <span class="text-gray-400 dark:text-zinc-500 ml-2">{{ auction.bidCount ?? 0 }} bid{{ (auction.bidCount ?? 0) === 1 ? "" : "s" }}</span>
                <span class="text-gray-500 dark:text-zinc-400 ml-2">{{ formatTimeLeft(auction.endsAt) }}</span>
              </template>
            </ActivityRow>
          </div>
        </div>

        <!-- Ended -->
        <div v-if="tab === 'ended'" class="mt-5">
          <p v-if="!endedAuctions.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
            No ended auctions yet.
          </p>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
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
                <span class="text-pokemon-red font-semibold">RM {{ auction.currentPrice.toFixed(2) }}</span>
                <span v-if="getWinner(auction)" class="text-green-600 ml-2 truncate">Won by {{ getWinner(auction)?.bidder }}</span>
                <span v-else class="text-gray-400 dark:text-zinc-500 ml-2">No bids</span>
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

definePageMeta({ layout: "inventory" });
useHead({ title: "Inventory · Auctions | TCGo" });

const { user, signInWithGoogle } = useAuth();
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

// Winner phones for the WhatsApp contact buttons.
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
  let cleanPhone = (buyerPhones.value[winner.bidderUid] || "").replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "60" + cleanPhone.slice(1);
  const message = encodeURIComponent(
    `Hi ${winner.bidder}, you won the auction for ${auction.cardName} at RM ${auction.currentPrice.toFixed(2)} on TCGo Marketplace. Let's arrange the deal!`,
  );
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${message}` : `https://wa.me/?text=${message}`;
};
</script>

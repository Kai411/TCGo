<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-24">
      <div
        class="animate-spin rounded-full h-8 w-8 border-2 border-ink/10 border-t-pokemon-red"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="publicAuctions.length === 0"
      class="surface rounded-2xl py-20 text-center"
    >
      <p class="text-lg font-semibold text-ink dark:text-white">
        No live auctions yet
      </p>
      <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
        Be the first to list a card.
      </p>
    </div>

    <!-- Grid -->
    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
    >
      <NuxtLink
        v-for="auction in publicAuctions"
        :key="auction.id"
        :to="`/auctions/${auction.id}`"
        class="group block"
      >
        <article
          class="surface rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow duration-300 ease-premium"
        >
          <!-- White-framed image well -->
          <div class="p-2 sm:p-2.5 bg-white dark:bg-white/[0.04]">
            <div
              class="relative aspect-[3/4] rounded-lg bg-canvas-sunken dark:bg-white/[0.02] overflow-hidden"
            >
              <img
                v-if="auction.imageUrls?.length || auction.imageUrl"
                :src="cdnUrl(auction.imageUrls?.[0] || auction.imageUrl, 400)"
                :alt="auction.cardName"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-premium"
              />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-xs text-ink-soft dark:text-zinc-500"
              >
                No image
              </div>

              <!-- Top-right: time-left pill -->
              <span
                class="absolute right-1.5 top-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide shadow-sm"
                :class="
                  isEnding(auction.endsAt)
                    ? 'bg-pokemon-red text-white'
                    : 'bg-white/95 text-ink'
                "
              >
                {{ formatTimeLeft(auction.endsAt) }}
              </span>

              <!-- Bottom-left pills: seller name + condition -->
              <div
                class="absolute left-1.5 right-1.5 bottom-1.5 flex items-end gap-1 flex-wrap pointer-events-none"
              >
                <span
                  v-if="auction.seller"
                  class="inline-flex items-center max-w-[60%] truncate px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-white/95 text-ink shadow-sm"
                >
                  {{ auction.seller }}
                </span>
                <span
                  v-if="conditionLabel(auction)"
                  class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-white/95 shadow-sm"
                  :class="conditionPillTone(auction)"
                >
                  {{ conditionLabel(auction) }}
                </span>
              </div>
            </div>
          </div>

          <div class="px-3.5 sm:px-4 pt-2 pb-3.5 sm:pb-4">
            <h3
              class="font-semibold text-[15px] leading-tight text-ink dark:text-white truncate"
            >
              {{ auction.cardName }}
            </h3>
            <p
              v-if="auction.cardSet"
              class="mt-1 text-xs text-ink-muted dark:text-zinc-400 truncate"
            >
              {{ auction.cardSet }}
            </p>

            <div class="mt-3 flex items-end justify-between">
              <div class="min-w-0">
                <span
                  class="text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-zinc-500"
                >
                  RM
                </span>
                <p
                  class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white"
                >
                  {{ auction.currentPrice.toFixed(2) }}
                </p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] text-ink-soft dark:text-zinc-500">
                  {{ bidCount(auction) }} bid{{ bidCount(auction) === 1 ? "" : "s" }}
                </span>
                <FavouriteButton
                  :item-id="auction.id"
                  item-type="auction"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </article>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";
import { cdnUrl } from "~/composables/useStorage";

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

const publicAuctions = computed(() =>
  auctions.value.filter((a: Auction) => !a.isPrivate),
);

const isEnding = (endsAt: number) => endsAt - Date.now() < 3600000;

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

// bids gets stripped from the listing payload by useAuctions, so it can be
// undefined here — fall back to 0 in that case.
const bidCount = (auction: Auction) =>
  auction.bids ? Object.keys(auction.bids).length : 0;

const conditionLabel = (auction: Auction): string => {
  if (auction.productType === "Graded") {
    const provider =
      auction.gradingProvider === "Others"
        ? auction.customGradingProvider
        : auction.gradingProvider;
    return `${provider || ""} ${auction.grade || ""}`.trim();
  }
  if (auction.productType === "Sealed") return "Sealed";
  return auction.condition || "";
};

const conditionPillTone = (auction: Auction): string => {
  if (auction.productType === "Graded") return "text-amber-700";
  if (auction.productType === "Sealed") return "text-pokemon-red";
  return "text-ink";
};
</script>

<template>
  <div>
    <ListingFilters
      v-if="!loading"
      :filters="filters"
      :show-auction-sort="true"
    />

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
          class="surface rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow duration-300 ease-premium h-full flex flex-col"
        >
          <!-- Image well -->
          <div class="p-2 sm:p-2.5 bg-white dark:bg-white/[0.04]">
            <div
              class="relative aspect-[3.55/5] rounded-lg overflow-hidden bg-canvas-sunken dark:bg-white/[0.02]"
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

              <!-- Top-left: status + time badge -->
              <span
                class="absolute left-1.5 top-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide shadow-sm"
                :class="timerClasses(auction.endsAt)"
              >
                {{ statusTimeLabel(auction.endsAt) }}
              </span>

              <!-- Bottom-right: grade badge (overlay on image) -->
              <span
                v-if="conditionLabel(auction)"
                class="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm"
                :class="gradeBadgeClasses(auction)"
              >
                {{ conditionLabel(auction) }}
              </span>

              <!-- Bottom-left: photo count -->
              <span
                v-if="(auction.imageUrls?.length || 0) > 1"
                class="absolute left-1.5 bottom-1.5 inline-flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
              >
                <svg
                  class="w-2.5 h-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <rect x="3" y="6" width="18" height="14" rx="2" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                {{ auction.imageUrls?.length }}
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="px-3.5 sm:px-4 pt-2 pb-3.5 sm:pb-4 flex-1 flex flex-col">
            <h3
              class="font-semibold text-[15px] leading-tight text-ink dark:text-white truncate"
            >
              {{ auction.cardName }}
            </h3>
            <p
              v-if="auction.cardSet"
              class="mt-0.5 text-xs text-ink-muted dark:text-zinc-400 truncate"
            >
              {{ auction.cardSet }}
            </p>

            <div class="mt-auto pt-3">
              <div class="flex items-end justify-between">
                <div class="min-w-0">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-zinc-500"
                  >
                    Current bid
                  </span>
                  <p
                    class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white"
                  >
                    RM {{ formatPrice(auction.currentPrice) }}
                  </p>
                </div>
              </div>
              <div class="mt-1.5 flex items-center justify-between">
                <span class="text-[11px] text-ink-muted dark:text-zinc-400">
                  {{ bidCount(auction) }} bid{{
                    bidCount(auction) === 1 ? "" : "s"
                  }}
                </span>
                <span
                  v-if="auction.seller"
                  class="text-[11px] text-ink-muted dark:text-zinc-400 truncate max-w-[50%]"
                >
                  @{{ auction.seller }}
                </span>
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
const filters = useListingFilters({ defaultSort: "ending-soon" });

const publicAuctions = computed(() => {
  const base = auctions.value.filter((a: Auction) => !a.isPrivate);
  return filters.apply(base);
});

const isEnding = (endsAt: number) => endsAt - Date.now() < 3600000;

const formatTimeLeft = (endsAt: number) => {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

const statusTimeLabel = (endsAt: number) => {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "ENDED";
  return `LIVE ${formatTimeLeft(endsAt)}`;
};

const timerClasses = (endsAt: number) => {
  const diff = endsAt - Date.now();
  if (diff <= 0)
    return "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";
  if (diff < 300000) return "bg-pokemon-red text-white animate-pulse";
  if (diff < 3600000) return "bg-amber-500 text-white";
  return "bg-emerald-500/90 text-white";
};

const gradeBadgeClasses = (auction: Auction) => {
  if (auction.productType === "Graded")
    return "bg-amber-400 text-amber-950 border border-amber-600";
  if (auction.productType === "Sealed")
    return "bg-blue-500 text-white border border-blue-700";
  return "bg-white text-ink border border-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600";
};

const bidCount = (auction: Auction) => auction.bidCount ?? 0;

const formatPrice = (price: number): string => {
  return price.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const conditionLabel = (auction: Auction): string => {
  if (auction.productType === "Graded") {
    const provider =
      auction.gradingProvider === "Others"
        ? auction.customGradingProvider
        : auction.gradingProvider;
    return `${provider || ""} ${auction.grade || ""}`.trim();
  }
  if (auction.productType === "Sealed") return "SEALED";
  const m = (auction.condition || "").match(/\(([^)]+)\)/);
  return m ? m[1] : auction.condition || "";
};
</script>

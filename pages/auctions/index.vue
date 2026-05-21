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
          class="surface rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow duration-300 ease-premium h-full flex flex-col"
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

              <!-- Top-left: language badge for non-English cards, then a
                   photo-count badge directly below it when multi-photo. -->
              <span
                v-if="auction.language && auction.language !== 'EN'"
                class="absolute left-1.5 top-1.5 bg-black/75 text-white text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded"
              >
                {{ auction.language }}
              </span>
              <span
                v-if="(auction.imageUrls?.length || 0) > 1"
                class="absolute left-1.5 inline-flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
                :class="auction.language && auction.language !== 'EN' ? 'top-8' : 'top-1.5'"
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
                {{ auction.imageUrls!.length }}
              </span>

              <!-- Top-right: time-left pill -->
              <span
                class="absolute right-1.5 top-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide whitespace-nowrap shadow-sm"
                :class="
                  isEnding(auction.endsAt)
                    ? 'bg-pokemon-red text-white'
                    : 'bg-white/95 text-ink'
                "
              >
                {{ formatTimeLeft(auction.endsAt) }}
              </span>

              <!-- Full-width seller band at the bottom of the image -->
              <div
                v-if="auction.seller"
                class="absolute bottom-0 left-0 right-0 bg-pokemon-red text-white text-xs font-semibold px-3 py-1.5 truncate text-center"
              >
                {{ auction.seller }}
              </div>
            </div>
          </div>

          <!-- Body: flex-1 so it fills the rest of the tile, mt-auto on the
               price block keeps prices aligned across tiles. Condition chip
               sits directly above the price. -->
          <div class="px-3.5 sm:px-4 pt-2 pb-3.5 sm:pb-4 flex-1 flex flex-col">
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

            <div class="mt-auto pt-3">
              <span
                v-if="conditionLabel(auction)"
                class="chip"
                :class="conditionTone(auction)"
              >
                {{ conditionLabel(auction) }}
              </span>
              <div class="mt-2 flex items-end justify-between">
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

// useAuctions strips the full bid map from the listing payload and
// computes the count instead — saves a lot of memory on long pages.
const bidCount = (auction: Auction) => auction.bidCount ?? 0;

// Short pill label that always fits on a tile. Ungraded labels in the
// constants list are written as "Near Mint (NM)", "Moderately Played (MP)",
// etc. — strip down to just the abbreviation in the parens. Graded labels
// like "PSA 10" are already short. Sealed becomes "SEALED".
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

const conditionTone = (auction: Auction): string => {
  if (auction.productType === "Graded") return "chip-gold";
  if (auction.productType === "Sealed") return "chip-accent";
  return "";
};
</script>

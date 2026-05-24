<template>
  <div class="lg:flex lg:gap-8">
    <!-- ── Filter sidebar (desktop only) ─────────────────────────────── -->
    <aside
      v-if="!loading"
      class="hidden lg:block w-48 shrink-0 sticky top-[5.5rem] self-start"
    >
      <ListingFilters :filters="filters" :sidebar="true" :show-auction-sort="true" />
    </aside>

    <!-- ── Main content ───────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0">
      <!-- Mobile filter trigger (hidden on desktop) -->
      <div v-if="!loading" class="lg:hidden mb-2">
        <ListingFilters :filters="filters" :show-auction-sort="true" />
      </div>

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
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
      >
        <CardTile
          v-for="auction in publicAuctions"
          :key="auction.id"
          :auction="auction"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";

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
</script>

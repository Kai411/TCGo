<template>
  <div class="lg:flex lg:gap-8">
    <!-- ── Filter sidebar (desktop only) ─────────────────────────────── -->
    <aside
      v-if="!loading"
      class="hidden lg:block w-48 shrink-0 sticky top-[8.75rem] self-start"
    >
      <ListingFilters :filters="filters" :sidebar="true" :show-auction-sort="true" />
    </aside>

    <!-- ── Main content ───────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0">
      <ListingBanner placement="auctions" />
      <!-- Mobile filter trigger (hidden on desktop) -->
      <div v-if="!loading" class="lg:hidden mb-2">
        <ListingFilters :filters="filters" :show-auction-sort="true" :result-count="publicAuctions.length" noun="auction" />
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

      <!-- Nothing live: say so up front, then show what recently ended. -->
      <template v-else>
        <div
          v-if="splitByLive && liveAuctions.length === 0 && !endedOnlyFilter"
          class="surface rounded-2xl px-4 py-10 text-center mb-6"
        >
          <p class="text-lg font-semibold text-ink dark:text-white">
            No live auctions right now
          </p>
          <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
            Check back soon, or start one by listing a card.
          </p>
        </div>

        <!-- Grid: under "Ending soon", live auctions first and ended ones
             in their own section below. -->
        <div
          v-if="!splitByLive || liveAuctions.length"
          class="-mx-1.5 lg:mx-0 grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4 xl:gap-5"
        >
          <CardTile
            v-for="auction in splitByLive ? liveAuctions : publicAuctions"
            :key="auction.id"
            :auction="auction"
          />
        </div>

        <template v-if="splitByLive && endedAuctions.length">
          <h2
            class="text-sm font-semibold text-ink-muted dark:text-zinc-400 mb-3"
            :class="liveAuctions.length ? 'mt-10' : ''"
          >
            Recently ended
          </h2>
          <div
            class="-mx-1.5 lg:mx-0 grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4 xl:gap-5"
          >
            <CardTile
              v-for="auction in endedAuctions"
              :key="auction.id"
              :auction="auction"
            />
          </div>
        </template>
      </template>
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

// "Ending soon" already orders live before ended (compareEndingSoon); split
// at that boundary so ended auctions sit in their own section and an
// all-ended list says nothing is live instead of looking like live stock.
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  now.value = Date.now();
  tick = setInterval(() => (now.value = Date.now()), 30_000);
});
onBeforeUnmount(() => clearInterval(tick));

// Someone who filtered to "Ended" doesn't need telling nothing is live.
const endedOnlyFilter = computed(
  () => filters.statuses.value.length > 0 && !filters.statuses.value.includes("live"),
);
const splitByLive = computed(() => filters.sort.value === "ending-soon");
const isLive = (a: Auction) => (a.endsAt ?? 0) > now.value;
const liveAuctions = computed(() => publicAuctions.value.filter(isLive));
const endedAuctions = computed(() =>
  publicAuctions.value.filter((a) => !isLive(a)),
);
</script>

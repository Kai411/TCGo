<template>
  <div>
    <EmptyState
      v-if="favouriteCards.length === 0 && favouriteAuctions.length === 0"
      headline="No favourites yet"
      caption="Tap the heart on any card or auction to save it here."
    />
    <template v-else>
      <p class="mb-3 text-[11px] text-ink-soft dark:text-zinc-500 tabular-price">
        {{ total }} saved
      </p>
      <!-- Flat cells divided by hairlines, edge to edge on phones: the same
           grid as Your collection. Listings first, then auctions. -->
      <div
        class="-mx-4 lg:mx-0 grid grid-cols-3 lg:grid-cols-5 overflow-hidden border-t border-black/[0.06] dark:border-white/[0.08] lg:border-x lg:rounded-xl"
      >
        <FavouriteTile
          v-for="card in favouriteCards"
          :key="card.id"
          :card="card"
          :class="cellLines"
        />
        <FavouriteTile
          v-for="auction in favouriteAuctions"
          :key="auction.id"
          :auction="auction"
          :class="cellLines"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// The list that used to be the profile's Favourites tab.
const props = defineProps<{ uid: string }>();

const { auctions } = useAuctions();
const { cards } = useCards();
const { userFavourites } = useUserFavourites(props.uid);

const favouriteCards = computed(() => {
  const ids = userFavourites.value
    .filter((f: any) => f.itemType === "card")
    .map((f: any) => f.itemId);
  return cards.value.filter((c: any) => ids.includes(c.id));
});

const favouriteAuctions = computed(() => {
  const ids = userFavourites.value
    .filter((f: any) => f.itemType === "auction")
    .map((f: any) => f.itemId);
  return auctions.value.filter((a: any) => ids.includes(a.id));
});

const total = computed(
  () => favouriteCards.value.length + favouriteAuctions.value.length,
);
const cellLines =
  "shadow-[1px_0_0_0_rgba(0,0,0,0.06),0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.08),0_1px_0_0_rgba(255,255,255,0.08)]";
</script>

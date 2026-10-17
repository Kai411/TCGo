<template>
  <div>
    <EmptyState
      v-if="favouriteCards.length === 0 && favouriteAuctions.length === 0"
      headline="No favourites yet"
      caption="Tap the heart on any card or auction to save it here."
    />
    <div v-else class="space-y-10">
      <section v-if="favouriteCards.length">
        <span class="eyebrow mb-3 block">Cards</span>
        <div
          class="-mx-1.5 lg:mx-0 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5"
        >
          <div
            v-for="card in favouriteCards"
            :key="card.id"
            :class="{ 'opacity-40': card.sold }"
          >
            <CardTile :card="card" />
          </div>
        </div>
      </section>
      <section v-if="favouriteAuctions.length">
        <span class="eyebrow mb-3 block">Auctions</span>
        <div
          class="-mx-1.5 lg:mx-0 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-5"
        >
          <div
            v-for="auction in favouriteAuctions"
            :key="auction.id"
            :class="{ 'opacity-40': auction.endsAt <= Date.now() }"
          >
            <CardTile :auction="auction" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// The grid that used to be the profile's Favourites tab, unchanged.
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
</script>

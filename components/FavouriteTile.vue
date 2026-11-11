<template>
  <!-- One cell of the Favourites grid, in the same flat layout as
       CollectionOwnedTile: photo, name, set, condition, then price with
       the heart where a collection tile has its ⋮. The grid draws the
       hairlines between cells. -->
  <div class="relative flex flex-col p-2.5 sm:p-3" :class="{ 'opacity-50': unavailable }">
    <NuxtLink
      :to="linkTo"
      class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pokemon-blue rounded-[6px]"
      :aria-label="`View ${item?.cardName}`"
    >
      <div class="relative mx-auto w-[86%] aspect-[2.5/3.5] overflow-hidden rounded-[6px] bg-canvas-sunken dark:bg-white/[0.04]">
        <img
          v-if="imageUrl"
          :src="cdnUrl(imageUrl, 400)"
          :alt="item?.cardName"
          loading="lazy"
          class="w-full h-full object-cover"
        />
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center text-[10px] text-ink-soft dark:text-zinc-500"
        >
          No image
        </div>
      </div>

      <p
        class="mt-2.5 sm:mt-3 truncate font-semibold leading-tight text-[12px] sm:text-sm text-ink dark:text-white"
        :title="item?.cardName"
      >
        {{ item?.cardName }}
      </p>
      <p class="mt-0.5 truncate leading-tight text-[8px] sm:text-[11px] text-gray-500 dark:text-zinc-400">
        <span
          v-if="item?.language === 'JP'"
          class="mr-1 inline-block rounded px-0.5 sm:px-1 py-px align-[1px] text-[7px] sm:text-[9px] font-bold leading-none bg-black/[0.06] text-gray-600 dark:bg-white/[0.10] dark:text-zinc-300"
          title="Japanese printing"
          >JP</span
        >{{ item?.cardSet || " " }}
      </p>
      <p
        v-if="conditionLabel"
        class="mt-0.5 truncate leading-tight text-[8px] sm:text-[11px] font-medium text-pokemon-blue dark:text-sky-400"
      >
        {{ conditionLabel }}
      </p>
    </NuxtLink>

    <div class="mt-auto pt-1.5 flex items-center gap-1">
      <div class="min-w-0 flex-1 tabular-nums">
        <p class="truncate leading-tight text-[10px] sm:text-[13px] font-bold text-ink dark:text-white">
          RM{{ formatPrice(price) }}
        </p>
        <p class="mt-0.5 truncate leading-tight text-[8px] sm:text-[11px] text-gray-500 dark:text-zinc-400">
          {{ statusLine }}
        </p>
      </div>
      <!-- Same 32px cell as the collection tile's ⋮. Unhearting drops the
           tile from the list. -->
      <div class="-mr-1.5 -my-1.5 shrink-0 w-8 h-8 inline-flex items-center justify-center text-gray-500 dark:text-zinc-400">
        <FavouriteButton :item-id="item?.id || ''" :item-type="auction ? 'auction' : 'card'" size="sm" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import type { Auction } from "~/composables/useAuctions";
import { cdnUrl } from "~/composables/useStorage";
import { isAvailable, isReserved } from "~/shared/card-availability";

const props = defineProps<{ card?: Card; auction?: Auction }>();

const item = computed(() => props.card || props.auction);
const linkTo = computed(() =>
  props.auction ? `/auctions/${props.auction.id}` : `/cards/${props.card?.id}`,
);
const imageUrl = computed(() => {
  const i = item.value as any;
  return i?.imageUrls?.[0] || i?.imageUrl || "";
});
const price = computed(
  () => (props.auction ? props.auction.currentPrice : props.card?.price) || 0,
);

// Same labels as the listing tile's badge: grade, SEALED, or the condition's
// short form ("Near Mint (NM)" → "NM").
const conditionLabel = computed(() => {
  const i = item.value;
  if (!i) return "";
  if (i.productType === "Graded") {
    const provider =
      i.gradingProvider === "Others" ? i.customGradingProvider : i.gradingProvider;
    return `${provider || ""} ${i.grade || ""}`.trim();
  }
  if (i.productType === "Sealed") return "Sealed";
  const m = (i.condition || "").match(/\(([^)]+)\)/);
  return m ? m[1] : i.condition || "";
});

const ended = computed(() => !!props.auction && props.auction.endsAt <= Date.now());
const unavailable = computed(
  () => ended.value || (!!props.card && !isAvailable(props.card)),
);

// Cards: who sells it, or why you can't buy it. Auctions: bids and time left.
const statusLine = computed(() => {
  if (props.auction) {
    const bids = (props.auction as any).bidCount ?? 0;
    const bidText = `${bids} bid${bids === 1 ? "" : "s"}`;
    if (ended.value) return `${bidText} · Ended`;
    const diff = props.auction.endsAt - Date.now();
    const hours = Math.floor(diff / 3600000);
    const left =
      hours >= 24
        ? `${Math.floor(hours / 24)}d ${hours % 24}h`
        : `${hours}h ${Math.floor((diff % 3600000) / 60000)}m`;
    return `${bidText} · ${left}`;
  }
  if (props.card && !isAvailable(props.card))
    return isReserved(props.card) ? "Reserved" : "Sold";
  return props.card?.seller ? `@${props.card.seller}` : " ";
});

// Same phone price format as the other tiles: no ".00" on whole amounts.
const formatPrice = (value: number) =>
  value.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
</script>

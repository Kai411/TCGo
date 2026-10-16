<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import type { Auction } from "~/composables/useAuctions";
import { cdnUrl } from "~/composables/useStorage";
import { isAvailable, isReserved } from "~/shared/card-availability";

const props = defineProps<{
  card?: Card;
  auction?: Auction;
  /** Phones show the set on the grey line instead of the seller; for grids
   *  where every tile has the same seller (a profile's own listings). */
  hideSeller?: boolean;
}>();

const item = computed(() => props.card || props.auction);
const isAuction = computed(() => !!props.auction);
const linkTo = computed(() =>
  isAuction.value ? `/auctions/${item.value!.id}` : `/cards/${item.value!.id}`,
);

// Image
const imageUrl = computed(() => {
  const i = item.value;
  if (!i) return "";
  return (i as any).imageUrls?.[0] || (i as any).imageUrl || "";
});
const imageCount = computed(() => (item.value as any)?.imageUrls?.length || 0);

// Condition / grade badge
const conditionLabel = computed((): string => {
  const i = item.value;
  if (!i) return "";
  if (i.productType === "Graded") {
    const provider =
      i.gradingProvider === "Others"
        ? i.customGradingProvider
        : i.gradingProvider;
    return `${provider || ""} ${i.grade || ""}`.trim();
  }
  if (i.productType === "Sealed") return "SEALED";
  const m = (i.condition || "").match(/\(([^)]+)\)/);
  return m ? m[1] : i.condition || "";
});

const gradeBadgeClasses = computed((): string => {
  const i = item.value;
  if (!i) return "";
  if (i.productType === "Graded")
    return "bg-amber-400 text-amber-950 border border-amber-600";
  if (i.productType === "Sealed")
    return "bg-blue-500 text-white border border-blue-700";
  return "bg-white text-ink border border-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600";
});

// Price formatting
const formatPrice = (price: number): string => {
  return price.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Phone tiles: "RM1,250" for whole amounts so big prices fit one line.
const formatPriceCompact = (price: number): string =>
  "RM" +
  price.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  });
const compactPrice = computed(() =>
  formatPriceCompact(
    (isAuction.value ? props.auction?.currentPrice : props.card?.price) || 0,
  ),
);

// Phone tiles have one line for the name, so "Manectric ex - 2006 (Jason
// Klaczynski)" shows "Manectric ex" there and the rest moves to the
// subtitle with the set.
const nameParts = computed(() => {
  const name = item.value?.cardName || "";
  const i = name.indexOf(" - ");
  const title = i > 0 ? name.slice(0, i) : name;
  const variant = i > 0 ? name.slice(i + 3) : "";
  const set = item.value?.cardSet || "";
  return {
    title,
    subtitle: [variant, set].filter(Boolean).join(" · "),
  };
});

const viewCount = computed(() => props.card?.viewCount ?? 0);

// Auction-specific
const bidCount = computed(() => (props.auction as any)?.bidCount ?? 0);

const isLive = computed(
  () => !!props.auction && props.auction.endsAt > Date.now(),
);

// Time left without the "LIVE" prefix, which the template hides on phones
// so the badge doesn't run into the condition badge on a narrow tile.
const statusTimeLabel = computed(() => {
  if (!props.auction) return "";
  const diff = props.auction.endsAt - Date.now();
  if (diff <= 0) return "ENDED";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
});

const timerClasses = computed(() => {
  if (!props.auction) return "";
  const diff = props.auction.endsAt - Date.now();
  if (diff <= 0)
    return "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";
  if (diff < 300000) return "bg-pokemon-red text-white animate-pulse";
  if (diff < 3600000) return "bg-amber-500 text-white";
  return "bg-emerald-500/90 text-white";
});
</script>

<template>
  <NuxtLink
    :to="linkTo"
    class="group block rounded-[6px] sm:rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-red focus-visible:ring-offset-2 focus-visible:ring-offset-canvas dark:focus-visible:ring-offset-canvas-inverse"
  >
    <article
      class="surface rounded-[6px] sm:rounded-2xl overflow-hidden group-hover:shadow-card-hover group-hover:-translate-y-0.5 transition duration-300 ease-premium h-full flex flex-col"
    >
      <!-- Image well -->
      <div class="p-1 sm:p-2.5 bg-white dark:bg-white/[0.04]">
        <div
          class="relative aspect-[3.55/5] rounded-[3px] sm:rounded-lg overflow-hidden bg-canvas-sunken dark:bg-white/[0.02]"
        >
          <img
            v-if="imageUrl"
            :src="cdnUrl(imageUrl, 400)"
            :alt="item?.cardName"
            loading="lazy"
            class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-premium"
          />
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center text-xs text-ink-soft dark:text-zinc-500"
          >
            No image
          </div>

          <!-- Top-left: auction status badge OR photo count -->
          <span
            v-if="isAuction"
            class="absolute left-1.5 top-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide shadow-sm"
            :class="timerClasses"
          >
            <span v-if="isLive" class="hidden sm:inline">LIVE</span>
            {{ statusTimeLabel }}
          </span>
          <span
            v-else-if="imageCount > 1"
            class="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
          >
            <svg
              class="w-2.5 h-2.5"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            {{ imageCount }}
            <span class="sr-only">photos</span>
          </span>

          <!-- Top-right: grade/condition badge -->
          <span
            v-if="conditionLabel"
            class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm"
            :class="gradeBadgeClasses"
          >
            {{ conditionLabel }}
          </span>

          <!-- Unavailable overlay (cards only — auctions already show ENDED via
               the timer badge). "Reserved" is a card being paid for at a
               seller's counter right now; it comes back on its own if that
               payment falls through, so it must not read as Sold. -->
          <div
            v-if="card && !isAvailable(card)"
            class="absolute inset-0 bg-black/40 flex items-end p-1.5"
          >
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white/90 tracking-wide uppercase">
              {{ isReserved(card) ? "Reserved" : "Sold" }}
            </span>
          </div>

          <!-- Bottom-left: language badge (cards) or photo count (auctions) -->
          <span
            v-if="!isAuction && item?.language && item.language !== 'EN'"
            class="absolute left-1.5 bottom-1.5 bg-black/75 text-white text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded"
          >
            {{ item.language }}
          </span>
          <span
            v-else-if="isAuction && imageCount > 1"
            class="absolute left-1.5 bottom-1.5 inline-flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
          >
            <svg
              class="w-2.5 h-2.5"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            {{ imageCount }}
            <span class="sr-only">photos</span>
          </span>
        </div>
      </div>

      <!-- Body -->
      <!-- Phones fit three tiles a row: one-line name, a muted variant/set
           line, then a compact "RM" price, so every tile has the same three
           rows. No seller, views or favourite button there. From sm up it's
           the original layout. -->
      <div class="px-2 sm:px-4 pt-2 pb-2.5 sm:pb-4 flex-1 flex flex-col">
        <h3
          class="font-semibold text-[12px] sm:text-[15px] leading-tight text-ink dark:text-white truncate"
          :title="item?.cardName"
        >
          <span class="sm:hidden">{{ nameParts.title }}</span>
          <span class="hidden sm:inline">{{ item?.cardName }}</span>
        </h3>
        <!-- Phones: a quiet second line with the seller (or, with
             hideSeller, the variant and set), always present so every tile
             in a row has the same shape. -->
        <p
          class="sm:hidden mt-0.5 text-[8px] leading-tight text-ink-muted dark:text-zinc-400 truncate"
        >
          {{
            (!hideSeller && item?.seller ? `@${item.seller}` : nameParts.subtitle) ||
            "\u00a0"
          }}
        </p>

        <div class="mt-auto pt-1.5 sm:pt-3">
          <!-- Phones: one line, one size, so thousands still fit. -->
          <p
            class="sm:hidden tabular-price font-bold text-[10px] leading-none text-ink dark:text-white truncate"
          >
            {{ compactPrice }}
          </p>
          <div class="hidden sm:flex items-end justify-between">
            <div class="min-w-0">
              <!-- Auction: current bid with hammer icon -->
              <template v-if="isAuction">
                <p
                  class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white inline-flex items-center gap-1"
                >
                  <svg
                    class="w-3.5 h-3.5 text-ink-soft dark:text-zinc-400 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                    />
                  </svg>
                  {{ formatPrice(auction?.currentPrice || 0) }}
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-zinc-500"
                  >
                    MYR
                  </span>
                </p>
              </template>
              <!-- Card: fixed price -->
              <template v-else>
                <p
                  class="tabular-price font-extrabold text-[17px] leading-none text-ink dark:text-white"
                >
                  {{ formatPrice(card?.price || 0) }}
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wider text-ink-soft dark:text-zinc-500"
                  >
                    MYR
                  </span>
                </p>
              </template>
            </div>
          </div>
          <div
            class="mt-0.5 sm:mt-1.5 justify-between items-center gap-1"
            :class="isAuction ? 'flex' : 'hidden sm:flex'"
          >
            <span
              v-if="isAuction"
              class="text-[8px] sm:text-[11px] text-ink-muted dark:text-zinc-400"
            >
              {{ bidCount }} bid{{ bidCount === 1 ? "" : "s" }}
            </span>
            <span
              v-if="item?.seller"
              class="hidden sm:inline text-[11px] text-ink-muted dark:text-zinc-400 truncate"
            >
              @{{ item.seller }}
            </span>
            <div v-if="!isAuction" class="flex items-center gap-2 shrink-0">
              <span
                v-if="viewCount > 0"
                class="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-ink-muted dark:text-zinc-400"
                :title="`${viewCount} view${viewCount === 1 ? '' : 's'}`"
              >
                <svg
                  class="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {{ viewCount }}
              </span>
              <FavouriteButton
                :item-id="item?.id || ''"
                item-type="card"
                :count="card?.favouriteCount || 0"
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import type { Auction } from "~/composables/useAuctions";
import { cdnUrl } from "~/composables/useStorage";

const props = defineProps<{
  card?: Card;
  auction?: Auction;
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

// Auction-specific
const bidCount = computed(() => (props.auction as any)?.bidCount ?? 0);

const statusTimeLabel = computed(() => {
  if (!props.auction) return "";
  const diff = props.auction.endsAt - Date.now();
  if (diff <= 0) return "ENDED";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `LIVE ${days}d ${hours % 24}h`;
  }
  return `LIVE ${hours}h ${minutes}m`;
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
  <NuxtLink :to="linkTo" class="group block">
    <article
      class="surface rounded-2xl overflow-hidden hover:shadow-card-hover transition-shadow duration-300 ease-premium h-full flex flex-col"
    >
      <!-- Image well -->
      <div class="p-2 sm:p-2.5 bg-white dark:bg-white/[0.04]">
        <div
          class="relative aspect-[3.55/5] rounded-lg overflow-hidden bg-canvas-sunken dark:bg-white/[0.02]"
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
            {{ statusTimeLabel }}
          </span>
          <span
            v-else-if="imageCount > 1"
            class="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-black/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded"
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
            {{ imageCount }}
          </span>

          <!-- Top-right: grade/condition badge -->
          <span
            v-if="conditionLabel"
            class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm"
            :class="gradeBadgeClasses"
          >
            {{ conditionLabel }}
          </span>

          <!-- Sold overlay (cards only — auctions already show ENDED via the timer badge) -->
          <div
            v-if="card?.sold"
            class="absolute inset-0 bg-black/40 flex items-end p-1.5"
          >
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white/90 tracking-wide uppercase">
              Sold
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
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            {{ imageCount }}
          </span>
        </div>
      </div>

      <!-- Body -->
      <div class="px-3.5 sm:px-4 pt-2 pb-3.5 sm:pb-4 flex-1 flex flex-col">
        <h3
          class="font-semibold text-[15px] leading-tight text-ink dark:text-white truncate"
        >
          {{ item?.cardName }}
        </h3>

        <div class="mt-auto pt-3">
          <div class="flex items-end justify-between">
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
          <div class="mt-1.5 flex justify-between items-center">
            <span
              v-if="isAuction"
              class="text-[11px] text-ink-muted dark:text-zinc-400"
            >
              {{ bidCount }} bid{{ bidCount === 1 ? "" : "s" }}
            </span>
            <span
              v-if="item?.seller"
              class="text-[11px] text-ink-muted dark:text-zinc-400 truncate"
            >
              @{{ item.seller }}
            </span>
            <div v-if="!isAuction" class="flex items-center gap-1.5 shrink-0">
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

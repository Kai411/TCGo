<template>
  <NuxtLink
    :to="`/orders/${order.id}`"
    class="group block lg:hover:bg-black/[0.02] lg:dark:hover:bg-white/[0.03] transition-colors"
  >
    <!-- Phones: a small order card. Seller and stage on top, the card and
         total in the middle, and the one next step as a full button below,
         so nothing has to squeeze into a single 360px line. -->
    <div class="lg:hidden py-4 transition-opacity duration-150 active:opacity-60">
      <div class="flex items-center justify-between gap-3 mb-3">
        <p class="min-w-0 flex items-center gap-1.5 text-[13px] font-semibold text-ink dark:text-white">
          <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z" /><path d="M5 13v7h14v-7" />
          </svg>
          <span class="truncate">{{ order.sellerName }}</span>
        </p>
        <span
          class="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
          :class="statusColor"
        >
          {{ statusLabel }}
        </span>
      </div>

      <div class="flex gap-3">
        <div class="relative w-14 shrink-0 aspect-[5/7] rounded-md overflow-hidden bg-black/[0.04] dark:bg-white/[0.06]">
          <CardImage :src="order.items[0]?.imageUrl" :alt="order.items[0]?.cardName" />
          <span
            v-if="order.items.length > 1"
            class="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-white text-[10px] font-bold tabular-nums"
          >
            ×{{ order.items.length }}
          </span>
        </div>
        <div class="min-w-0 flex-1 flex flex-col">
          <p class="text-sm font-medium leading-snug text-ink dark:text-white line-clamp-2">
            {{ order.items[0]?.cardName || "Order" }}
          </p>
          <p class="mt-0.5 text-xs text-ink-soft dark:text-zinc-500 truncate">
            {{ secondLine }}
          </p>
          <div class="mt-auto pt-2 flex items-end justify-between gap-3">
            <p class="text-xs text-ink-soft dark:text-zinc-500 truncate">
              {{ shortDate }} · #{{ order.id.slice(0, 6) }}
            </p>
            <p class="shrink-0 text-[15px] font-bold tabular-nums text-ink dark:text-white">
              RM {{ order.total.toFixed(2) }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="order.status === 'pending' || order.status === 'shipped'"
        class="mt-3 flex items-center justify-end gap-3"
        @click.prevent.stop
      >
        <p class="mr-auto text-xs text-ink-muted dark:text-zinc-400">
          {{ order.status === "pending" ? "Pay to confirm with the seller" : "Arrived? Let the seller know" }}
        </p>
        <button
          v-if="order.status === 'pending'"
          type="button"
          @click="$emit('pay', order.id)"
          class="shrink-0 min-h-[40px] px-5 rounded-full text-[13px] font-semibold bg-pokemon-red text-white transition-transform duration-150 active:scale-[0.97]"
        >
          Pay now
        </button>
        <button
          v-else
          type="button"
          @click="$emit('mark-delivered', order.id)"
          class="shrink-0 min-h-[40px] px-5 rounded-full text-[13px] font-semibold bg-emerald-600 text-white transition-transform duration-150 active:scale-[0.97]"
        >
          Mark received
        </button>
      </div>
    </div>

    <!-- Desktop: one line per order -->
    <div class="hidden lg:flex items-center gap-4 px-4 py-3">
    <!-- Item thumbnails: stack up to 3, then a +N chip -->
    <div class="flex -space-x-3 shrink-0">
      <div
        v-for="item in order.items.slice(0, 3)"
        :key="item.cardId"
        class="w-11 h-11 rounded-lg overflow-hidden ring-2 ring-white dark:ring-[#111]"
      >
        <CardImage :src="item.imageUrl" :alt="item.cardName" />
      </div>
      <div
        v-if="order.items.length > 3"
        class="w-11 h-11 rounded-lg ring-2 ring-white dark:ring-[#111] bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center text-[11px] font-bold text-gray-600 dark:text-zinc-300"
      >
        +{{ order.items.length - 3 }}
      </div>
    </div>

    <!-- What it is, who from, when -->
    <div class="min-w-0 flex-1">
      <p class="font-semibold text-sm text-ink dark:text-white truncate">
        {{ title }}
      </p>
      <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
        {{ order.sellerName }} · {{ shortDate }} · #{{ order.id.slice(0, 6) }}
      </p>
      <p
        v-if="order.trackingNumber"
        class="text-[11px] text-gray-400 dark:text-zinc-500 truncate font-mono mt-0.5"
      >
        {{ order.trackingNumber }}
      </p>
    </div>

    <!-- Money + state -->
    <div class="text-right shrink-0">
      <p class="font-bold text-sm tabular-nums text-ink dark:text-white">
        RM {{ order.total.toFixed(2) }}
      </p>
      <span
        class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
        :class="statusColor"
      >
        {{ statusLabel }}
      </span>
    </div>

    <!-- One clear next step, or a chevron -->
    <div class="shrink-0 w-[104px] sm:w-[120px] flex justify-end" @click.prevent.stop>
      <button
        v-if="order.status === 'pending'"
        @click="$emit('pay', order.id)"
        class="w-full px-3 py-2 rounded-lg text-xs font-bold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
      >
        Pay now
      </button>
      <button
        v-else-if="order.status === 'shipped'"
        @click="$emit('mark-delivered', order.id)"
        class="w-full px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
      >
        Mark received
      </button>
      <svg
        v-else
        class="w-4 h-4 text-gray-300 dark:text-zinc-600 group-hover:text-gray-400"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { deliveryStageColor, deliveryStageLabel } from "~/shared/delivery-stage";
import {
  type CompiledOrder,
  compiledOrderStatusLabel,
  compiledOrderStatusColor,
} from "~/composables/useCompiledOrders";

const props = defineProps<{ order: CompiledOrder }>();
defineEmits<{
  (e: "pay", id: string): void;
  (e: "mark-delivered", id: string): void;
}>();

// Lead with the thing the buyer actually recognises — the card — rather than
// the seller name, which was dominating every row.
const title = computed(() => {
  const first = props.order.items[0];
  if (!first) return "Order";
  const extra = props.order.items.length - 1;
  return extra > 0 ? `${first.cardName} +${extra} more` : first.cardName;
});

// Phone rows show the first card's name on its own, so this line carries
// the rest of the parcel, or the set when it's a single card.
const secondLine = computed(() => {
  const extra = props.order.items.length - 1;
  if (extra > 0) return `+${extra} more ${extra === 1 ? "card" : "cards"}`;
  const first = props.order.items[0];
  return [first?.cardSet, first?.condition].filter(Boolean).join(" · ");
});

const shortDate = computed(() =>
  new Date(props.order.createdAt).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year:
      new Date(props.order.createdAt).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }),
);

// An absorbed order isn't a dead sale — its items live on in the surviving
// order, so say "Merged" rather than the alarming "Cancelled".
const statusLabel = computed(() =>
  deliveryStageLabel(props.order),
);
const statusColor = computed(() => deliveryStageColor(props.order));
</script>

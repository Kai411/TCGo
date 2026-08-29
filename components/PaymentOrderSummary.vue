<template>
  <section class="surface rounded-2xl p-5">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="eyebrow">
        {{ order.items.length }} {{ order.items.length === 1 ? "item" : "items" }} · {{ order.sellerName }}
      </h2>
      <span class="text-[11px] font-mono text-gray-400 dark:text-zinc-500">#{{ order.id.slice(0, 8) }}</span>
    </div>

    <ul class="mt-3 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
      <li
        v-for="item in order.items"
        :key="item.cardId"
        class="flex items-center gap-3 py-2.5"
      >
        <NuxtLink
          :to="itemLink(item)"
          class="w-10 aspect-[63/88] shrink-0 rounded-md overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
        >
          <CardImage :src="item.imageUrl" :alt="item.cardName" />
        </NuxtLink>
        <div class="min-w-0 flex-1">
          <NuxtLink :to="itemLink(item)" class="block font-medium text-sm text-ink dark:text-white truncate hover:underline">
            {{ item.cardName }}
          </NuxtLink>
          <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
            {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
          </p>
        </div>
        <p class="font-semibold text-sm tabular-nums text-ink dark:text-white">
          RM {{ item.price.toFixed(2) }}
        </p>
      </li>
    </ul>

    <dl class="mt-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-sm space-y-1">
      <div class="flex justify-between text-gray-600 dark:text-zinc-300">
        <dt>Subtotal</dt>
        <dd class="tabular-nums">RM {{ order.subtotal.toFixed(2) }}</dd>
      </div>
      <div class="flex justify-between text-gray-600 dark:text-zinc-300">
        <dt>Shipping<template v-if="order.shippingCourier"> · {{ order.shippingCourier }}</template></dt>
        <dd class="tabular-nums">RM {{ order.shipping.toFixed(2) }}</dd>
      </div>
      <div class="flex justify-between font-bold text-base pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
        <dt class="text-ink dark:text-white">{{ totalLabel }}</dt>
        <dd class="text-pokemon-red tabular-nums">RM {{ order.total.toFixed(2) }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import type {
  CompiledOrder,
  CompiledOrderItem,
} from "~/composables/useCompiledOrders";

const props = withDefaults(
  defineProps<{
    order: CompiledOrder;
    totalLabel?: string;
  }>(),
  { totalLabel: "Total" },
);

// An auction order's single item is the auction itself, not a card listing.
const itemLink = (item: CompiledOrderItem) =>
  props.order.auctionId ? `/auctions/${props.order.auctionId}` : `/cards/${item.cardId}`;
</script>

<template>
  <NuxtLink
    :to="`/orders/${order.id}`"
    class="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
  >
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
  </NuxtLink>
</template>

<script setup lang="ts">
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

const statusLabel = computed(() => compiledOrderStatusLabel(props.order.status));
const statusColor = computed(() => compiledOrderStatusColor(props.order.status));
</script>

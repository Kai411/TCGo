<template>
  <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 min-w-0">
    <!-- Header: counterparty + status -->
    <div class="flex items-center justify-between gap-3 mb-3">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          {{ role === "buyer" ? "From seller" : "To buyer" }}
        </p>
        <NuxtLink
          :to="counterpartyProfileLink"
          class="block font-semibold text-ink dark:text-white text-sm truncate hover:underline"
        >
          {{ counterpartyName }}
        </NuxtLink>
      </div>
      <span
        class="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full"
        :class="statusColor"
      >
        {{ statusLabel }}
      </span>
    </div>

    <!-- Items list (compact) -->
    <div class="space-y-2 mb-3">
      <div
        v-for="item in order.items"
        :key="item.cardId"
        class="flex items-center gap-3"
      >
        <div class="w-12 h-12 shrink-0 rounded-lg overflow-hidden">
          <CardImage :src="item.imageUrl" :alt="item.cardName" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-ink dark:text-white truncate">{{ item.cardName }}</p>
          <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
            {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
          </p>
        </div>
        <p class="text-sm font-semibold tabular-nums text-ink dark:text-white">
          RM {{ item.price.toFixed(2) }}
        </p>
      </div>
    </div>

    <!-- Totals -->
    <div class="border-t border-gray-100 dark:border-white/[0.06] pt-3 space-y-1 text-xs">
      <div class="flex justify-between text-gray-600 dark:text-zinc-300">
        <span>Subtotal ({{ order.items.length }} {{ order.items.length === 1 ? "item" : "items" }})</span>
        <span class="tabular-nums">RM {{ order.subtotal.toFixed(2) }}</span>
      </div>
      <div class="flex justify-between text-gray-600 dark:text-zinc-300">
        <span>Shipping ({{ order.region }})</span>
        <span class="tabular-nums">RM {{ order.shipping.toFixed(2) }}</span>
      </div>
      <div class="flex justify-between font-bold text-sm pt-1 border-t border-gray-100 dark:border-white/[0.06]">
        <span class="text-ink dark:text-white">Total</span>
        <span class="text-pokemon-red tabular-nums">RM {{ order.total.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Tracking (if shipped) -->
    <div
      v-if="order.trackingNumber"
      class="mt-3 text-xs text-gray-500 dark:text-zinc-400 break-all"
    >
      Tracking:
      <span class="font-mono font-semibold text-ink dark:text-white">{{ order.trackingNumber }}</span>
      <span v-if="order.shippingCarrier"> · {{ order.shippingCarrier }}</span>
    </div>

    <!-- Actions -->
    <div class="mt-3 flex flex-wrap gap-2">
      <NuxtLink
        :to="`/orders/${order.id}`"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
      >
        View order
      </NuxtLink>

      <!-- Buyer actions -->
      <template v-if="role === 'buyer'">
        <button
          v-if="order.status === 'shipped'"
          @click="$emit('mark-delivered', order.id)"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
        >
          Mark received
        </button>
        <button
          v-if="order.status === 'pending'"
          @click="$emit('cancel', order.id)"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-500/10 transition-colors"
        >
          Cancel
        </button>
      </template>

      <!-- Seller actions -->
      <template v-if="role === 'seller'">
        <span
          v-if="order.status === 'pending'"
          class="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400"
        >
          Awaiting the buyer's payment
        </span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  type CompiledOrder,
  compiledOrderStatusLabel,
  compiledOrderStatusColor,
} from "~/composables/useCompiledOrders";

const props = defineProps<{
  order: CompiledOrder;
  role: "buyer" | "seller";
}>();

defineEmits<{
  (e: "mark-delivered", id: string): void;
  (e: "cancel", id: string): void;
}>();

// An absorbed order isn't a dead sale — its items live on in the surviving
// order, so say "Merged" rather than the alarming "Cancelled".
const statusLabel = computed(() =>
  props.order.mergedInto ? "Merged" : compiledOrderStatusLabel(props.order.status),
);
const statusColor = computed(() => compiledOrderStatusColor(props.order.status));

const counterpartyName = computed(() =>
  props.role === "buyer" ? props.order.sellerName : props.order.buyerName,
);
const counterpartyUid = computed(() =>
  props.role === "buyer" ? props.order.sellerUid : props.order.buyerUid,
);
const counterpartyProfileLink = computed(() => `/profile/${counterpartyUid.value}`);
</script>

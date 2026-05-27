<template>
  <div class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-4">
    <div class="flex gap-3">
      <!-- Image -->
      <div class="w-14 h-14 shrink-0 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden">
        <img v-if="order.imageUrl" :src="order.imageUrl" :alt="order.cardName" class="w-full h-full object-cover"/>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm text-ink dark:text-white truncate">{{ order.cardName }}</p>
        <p class="text-xs text-gray-500 dark:text-zinc-400">{{ order.cardSet }}</p>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="text-xs font-semibold text-pokemon-red">RM {{ order.total.toFixed(2) }}</span>
          <span :class="['text-xs font-medium', orderStatusColor(order.status)]">
            {{ orderStatusLabel(order.status) }}
          </span>
        </div>
        <p class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
          {{ role === 'buyer' ? `Seller: ${order.sellerName}` : `Buyer: ${order.buyerEmail}` }}
        </p>
      </div>
    </div>

    <!-- Tracking info (if shipped) -->
    <div
      v-if="order.status === 'shipped' && order.trackingNumber"
      class="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06] text-xs text-gray-500 dark:text-zinc-400"
    >
      Tracking: <span class="font-medium text-ink dark:text-white">{{ order.trackingNumber }}</span>
      <span v-if="order.shippingCarrier"> · {{ order.shippingCarrier }}</span>
    </div>

    <!-- Buyer actions -->
    <div v-if="role === 'buyer' && (order.status === 'paid' || order.status === 'shipped')" class="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
      <button
        @click="$emit('markDelivered')"
        class="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 px-3 py-1.5 rounded-lg font-medium transition-colors"
      >
        Mark as Received
      </button>
    </div>

    <!-- Seller actions -->
    <div v-if="role === 'seller' && order.status === 'paid'" class="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
      <div v-if="!showTracking" class="flex gap-2">
        <button
          @click="showTracking = true"
          class="text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/25 px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Add Tracking & Ship
        </button>
      </div>
      <div v-else class="space-y-2">
        <div class="flex gap-2">
          <input
            v-model="trackingNumber"
            placeholder="Tracking number"
            class="flex-1 text-xs border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-3 py-1.5 text-ink dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:border-pokemon-red focus:outline-none"
          />
          <input
            v-model="carrier"
            placeholder="Carrier (e.g. Pos Laju)"
            class="flex-1 text-xs border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-3 py-1.5 text-ink dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:border-pokemon-red focus:outline-none"
          />
        </div>
        <div class="flex gap-2">
          <button
            @click="submitTracking"
            :disabled="!trackingNumber"
            class="text-xs bg-pokemon-red text-white hover:bg-red-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Confirm Shipped
          </button>
          <button @click="showTracking = false" class="text-xs text-gray-400 dark:text-zinc-500 hover:text-ink dark:hover:text-white px-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Order } from "~/composables/useOrders";
import { orderStatusLabel, orderStatusColor } from "~/composables/useOrders";

const props = defineProps<{
  order: Order;
  role: 'buyer' | 'seller';
}>();

const emit = defineEmits<{
  markDelivered: [];
  addTracking: [{ number: string; carrier: string }];
}>();

const showTracking = ref(false);
const trackingNumber = ref('');
const carrier = ref('');

const submitTracking = () => {
  if (!trackingNumber.value) return;
  emit('addTracking', { number: trackingNumber.value, carrier: carrier.value });
  showTracking.value = false;
};
</script>

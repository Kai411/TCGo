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

      <a
        v-if="whatsappLink"
        :href="whatsappLink"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/>
        </svg>
        WhatsApp
      </a>

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
        <button
          v-if="order.status === 'pending'"
          @click="$emit('confirm', order.id)"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          Confirm order
        </button>
        <button
          v-if="order.status === 'confirmed' || order.status === 'paid'"
          @click="$emit('ship', order.id)"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
        >
          Mark shipped
        </button>
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
  (e: "confirm", id: string): void;
  (e: "ship", id: string): void;
  (e: "cancel", id: string): void;
}>();

const statusLabel = computed(() => compiledOrderStatusLabel(props.order.status));
const statusColor = computed(() => compiledOrderStatusColor(props.order.status));

const counterpartyName = computed(() =>
  props.role === "buyer" ? props.order.sellerName : props.order.buyerName,
);
const counterpartyUid = computed(() =>
  props.role === "buyer" ? props.order.sellerUid : props.order.buyerUid,
);
const counterpartyProfileLink = computed(() => `/profile/${counterpartyUid.value}`);

// Fetch the counterparty's WhatsApp number on demand.
const { firestore } = useFirebase();
const counterpartyPhone = ref("");
const { origin } = useRequestURL();

watch(
  counterpartyUid,
  async (uid) => {
    if (!uid || !firestore) return;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(firestore, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        counterpartyPhone.value = (data.whatsappNumber || data.phone || "") as string;
      }
    } catch {}
  },
  { immediate: true },
);

const whatsappLink = computed(() => {
  let clean = counterpartyPhone.value.replace(/[^0-9]/g, "");
  if (!clean) return "";
  if (clean.startsWith("0")) clean = "60" + clean.slice(1);
  const orderUrl = `${origin}/orders/${props.order.id}`;
  const itemsList = props.order.items
    .map((i) => `• ${i.cardName} (RM ${i.price.toFixed(2)})`)
    .join("\n");
  const message =
    props.role === "buyer"
      ? `Hi ${props.order.sellerName}, I just placed an order on TCGo:\n\n${itemsList}\n\nTotal: RM ${props.order.total.toFixed(2)} (incl. RM ${props.order.shipping.toFixed(2)} ${props.order.region} shipping)\nOrder: ${orderUrl}`
      : `Hi ${props.order.buyerName}, thanks for your order on TCGo!\n\n${itemsList}\n\nTotal: RM ${props.order.total.toFixed(2)} (incl. RM ${props.order.shipping.toFixed(2)} ${props.order.region} shipping)\nOrder: ${orderUrl}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
});
</script>

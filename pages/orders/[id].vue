<template>
  <div class="max-w-2xl mx-auto">
    <NuxtLink
      to="/activity?tab=orders"
      class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white mb-4"
    >
      ← Back to orders
    </NuxtLink>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
    </div>

    <div v-else-if="!order" class="surface rounded-2xl py-16 text-center">
      <p class="text-gray-500 dark:text-zinc-400">Order not found.</p>
    </div>

    <template v-else>
      <!-- Just-placed banner -->
      <div
        v-if="route.query.placed"
        class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 mb-5"
      >
        <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <div>
          <p class="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">Order placed</p>
          <p class="text-xs text-emerald-700 dark:text-emerald-300">
            Tap WhatsApp below to message the seller about payment & shipping.
          </p>
        </div>
      </div>

      <!-- Header -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Compiled order
            </p>
            <p class="text-xs text-gray-400 dark:text-zinc-500 font-mono">#{{ order.id.slice(0, 8) }}</p>
          </div>
          <span
            class="text-[11px] font-semibold px-2 py-1 rounded-full"
            :class="statusColor"
          >
            {{ statusLabel }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">
              Buyer
            </p>
            <NuxtLink
              :to="`/profile/${order.buyerUid}`"
              class="font-semibold text-ink dark:text-white hover:underline"
            >
              {{ order.buyerName }}
            </NuxtLink>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">
              Seller
            </p>
            <NuxtLink
              :to="`/profile/${order.sellerUid}`"
              class="font-semibold text-ink dark:text-white hover:underline"
            >
              {{ order.sellerName }}
            </NuxtLink>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">
              Placed
            </p>
            <p class="text-ink dark:text-white">{{ formatDate(order.createdAt) }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-0.5">
              Shipping
            </p>
            <p class="text-ink dark:text-white">
              {{ order.region === "WM" ? "West Malaysia" : "East Malaysia" }}
            </p>
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 mb-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
          Items ({{ order.items.length }})
        </h2>
        <div class="space-y-3">
          <NuxtLink
            v-for="item in order.items"
            :key="item.cardId"
            :to="`/cards/${item.cardId}`"
            class="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div class="w-16 h-16 shrink-0 rounded-lg overflow-hidden">
              <CardImage :src="item.imageUrl" :alt="item.cardName" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-ink dark:text-white truncate">{{ item.cardName }}</p>
              <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
                {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
              </p>
            </div>
            <p class="font-semibold text-sm tabular-nums text-ink dark:text-white">
              RM {{ item.price.toFixed(2) }}
            </p>
          </NuxtLink>
        </div>

        <div class="border-t border-gray-100 dark:border-white/[0.06] mt-4 pt-3 space-y-1 text-sm">
          <div class="flex justify-between text-gray-600 dark:text-zinc-300">
            <span>Subtotal</span>
            <span class="tabular-nums">RM {{ order.subtotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-gray-600 dark:text-zinc-300">
            <span>Shipping ({{ order.region }})</span>
            <span class="tabular-nums">RM {{ order.shipping.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-white/[0.06]">
            <span class="text-ink dark:text-white">Total</span>
            <span class="text-pokemon-red tabular-nums">RM {{ order.total.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- Tracking -->
      <div
        v-if="order.trackingNumber"
        class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 mb-4"
      >
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
          Tracking
        </h2>
        <p class="font-mono font-semibold text-ink dark:text-white">{{ order.trackingNumber }}</p>
        <p v-if="order.shippingCarrier" class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          via {{ order.shippingCarrier }}
        </p>
      </div>

      <!-- Actions -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
        <div class="flex flex-wrap gap-2">
          <a
            v-if="whatsappLink"
            :href="whatsappLink"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
            </svg>
            {{ role === "buyer" ? "WhatsApp seller" : "WhatsApp buyer" }}
          </a>

          <!-- Buyer actions -->
          <template v-if="role === 'buyer'">
            <button
              v-if="order.status === 'shipped'"
              @click="handleMarkDelivered"
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              Mark received
            </button>
            <button
              v-if="order.status === 'pending'"
              @click="handleCancel"
              class="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10 transition-colors"
            >
              Cancel order
            </button>
          </template>

          <!-- Seller actions -->
          <template v-if="role === 'seller'">
            <button
              v-if="order.status === 'pending'"
              @click="handleConfirm"
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              Confirm order
            </button>
            <button
              v-if="order.status === 'confirmed' || order.status === 'paid'"
              @click="shipDialogOpen = true"
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            >
              Mark shipped
            </button>
          </template>
        </div>

        <p v-if="role === 'buyer' && order.status === 'pending'" class="text-xs text-gray-500 dark:text-zinc-400 mt-3">
          Message the seller via WhatsApp to confirm payment method. Once paid, the seller will confirm and ship.
        </p>
        <p v-if="role === 'seller' && order.status === 'pending'" class="text-xs text-gray-500 dark:text-zinc-400 mt-3">
          After the buyer pays you, tap "Confirm order" so they know payment was received.
        </p>
      </div>
    </template>

    <!-- Ship dialog -->
    <div
      v-if="shipDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      @click.self="shipDialogOpen = false"
    >
      <div class="surface rounded-2xl w-full max-w-sm p-5 border border-black/[0.06] dark:border-white/[0.08]">
        <h3 class="text-base font-bold text-ink dark:text-white mb-3">Mark as shipped</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Tracking number (optional)</label>
            <input
              v-model="shipTrackingNumber"
              type="text"
              placeholder="e.g. EM123456789MY"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Carrier (optional)</label>
            <input
              v-model="shipCarrier"
              type="text"
              placeholder="e.g. Pos Laju, J&T"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
            />
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button
            @click="shipDialogOpen = false"
            class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200"
          >
            Cancel
          </button>
          <button
            @click="handleShip"
            class="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
          >
            Mark shipped
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  type CompiledOrder,
  compiledOrderStatusLabel,
  compiledOrderStatusColor,
} from "~/composables/useCompiledOrders";

useHead({ title: "Order | TCGo Marketplace" });

const route = useRoute();
const { user } = useAuth();
const { firestore } = useFirebase();
const {
  getCompiledOrder,
  markConfirmed,
  markShipped,
  markDelivered,
  cancelOrder,
} = useCompiledOrders();

const orderId = computed(() => route.params.id as string);
const order = ref<CompiledOrder | null>(null);
const loading = ref(true);

// Subscribe to live updates so status changes from the other party are reflected.
let unsub: (() => void) | null = null;

const subscribe = async () => {
  if (!firestore || !orderId.value) return;
  loading.value = true;
  const { doc, onSnapshot } = await import("firebase/firestore");
  unsub?.();
  unsub = onSnapshot(doc(firestore, "compiledOrders", orderId.value), (snap) => {
    order.value = snap.exists()
      ? ({ ...snap.data(), id: snap.id } as CompiledOrder)
      : null;
    loading.value = false;
  });
};

onMounted(subscribe);
watch(orderId, subscribe);
onBeforeUnmount(() => unsub?.());

const role = computed<"buyer" | "seller" | null>(() => {
  if (!order.value || !user.value) return null;
  if (order.value.buyerUid === user.value.uid) return "buyer";
  if (order.value.sellerUid === user.value.uid) return "seller";
  return null;
});

const statusLabel = computed(() =>
  order.value ? compiledOrderStatusLabel(order.value.status) : "",
);
const statusColor = computed(() =>
  order.value ? compiledOrderStatusColor(order.value.status) : "",
);

const counterpartyUid = computed(() => {
  if (!order.value) return "";
  return role.value === "buyer" ? order.value.sellerUid : order.value.buyerUid;
});

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
  if (!order.value) return "";
  let clean = counterpartyPhone.value.replace(/[^0-9]/g, "");
  if (!clean) return "";
  if (clean.startsWith("0")) clean = "60" + clean.slice(1);
  const orderUrl = `${origin}/orders/${order.value.id}`;
  const itemsList = order.value.items
    .map((i) => `• ${i.cardName} (RM ${i.price.toFixed(2)})`)
    .join("\n");
  const message =
    role.value === "buyer"
      ? `Hi ${order.value.sellerName}, I just placed an order on TCGo:\n\n${itemsList}\n\nTotal: RM ${order.value.total.toFixed(2)} (incl. RM ${order.value.shipping.toFixed(2)} ${order.value.region} shipping)\nOrder: ${orderUrl}`
      : `Hi ${order.value.buyerName}, thanks for your order on TCGo!\n\n${itemsList}\n\nTotal: RM ${order.value.total.toFixed(2)} (incl. RM ${order.value.shipping.toFixed(2)} ${order.value.region} shipping)\nOrder: ${orderUrl}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
});

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Ship dialog state
const shipDialogOpen = ref(false);
const shipTrackingNumber = ref("");
const shipCarrier = ref("");

const handleConfirm = async () => {
  if (!order.value) return;
  await markConfirmed(order.value.id);
};

const handleShip = async () => {
  if (!order.value) return;
  await markShipped(
    order.value.id,
    shipTrackingNumber.value.trim() || undefined,
    shipCarrier.value.trim() || undefined,
  );
  shipDialogOpen.value = false;
};

const handleMarkDelivered = async () => {
  if (!order.value) return;
  if (!confirm("Confirm you received this order?")) return;
  await markDelivered(order.value.id);
};

const handleCancel = async () => {
  if (!order.value) return;
  if (!confirm("Cancel this order?")) return;
  await cancelOrder(order.value.id);
};
</script>

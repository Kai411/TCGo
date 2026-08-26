<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-ink-muted dark:text-zinc-400 text-lg mb-4">
        Sign in to manage your orders.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-ink text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="mb-5">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Orders</h1>
        <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
          Everything waiting on you, in the order it needs doing.
        </p>
      </div>

      <div v-if="loadingSeller" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
      </div>

      <template v-else>
        <!-- Action strip: the two things a seller actually does next -->
        <div v-if="toShip.length" class="grid sm:grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            @click="tab = 'toship'"
            class="surface rounded-2xl p-4 text-left transition-shadow hover:shadow-card-hover"
          >
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500" />
              <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">
                Waybill ready — just hand over
              </p>
            </div>
            <p class="mt-2 text-2xl font-bold text-ink dark:text-white tabular-price">
              {{ readyToHandOver.length }}
            </p>
          </button>
          <button
            type="button"
            @click="tab = 'toship'"
            class="surface rounded-2xl p-4 text-left transition-shadow hover:shadow-card-hover"
          >
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-500" />
              <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">
                Needs a waybill
              </p>
            </div>
            <p class="mt-2 text-2xl font-bold text-ink dark:text-white tabular-price">
              {{ needsWaybill.length }}
            </p>
          </button>
        </div>

        <TabStrip v-model="tab" :tabs="tabs" class="mb-4" />

        <!-- Mergeable groups -->
        <div v-if="tab === 'mergeable'" class="space-y-4">
          <p
            v-if="!mergeableGroups.length"
            class="text-sm text-ink-soft dark:text-zinc-500 py-3"
          >
            No mergeable orders right now.
          </p>
          <div
            v-for="group in mergeableGroups"
            :key="group.key"
            class="rounded-2xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/[0.07] p-4"
          >
            <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div class="min-w-0">
                <p class="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {{ group.orders.length }} orders from {{ group.buyerName }} can be merged
                </p>
                <p class="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                  Same buyer, same address, paid. Combine into one parcel with a
                  single waybill — any labels already bought are cancelled and
                  one new label is booked for the combined parcel.
                </p>
              </div>
              <button
                @click="handleMerge(group)"
                :disabled="merging"
                class="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-ink hover:bg-amber-400 transition-colors disabled:opacity-60"
              >
                <span
                  v-if="merging"
                  class="animate-spin rounded-full h-4 w-4 border-b-2 border-ink"
                />
                Merge {{ group.orders.length }} orders
              </button>
            </div>
            <div class="grid lg:grid-cols-2 gap-3 items-start">
              <CompiledOrderCard
                v-for="order in group.orders"
                :key="order.id"
                :order="order"
                role="seller"
                @ship="openShipDialog(order.id)"
              />
            </div>
          </div>
        </div>

        <!-- Straight queue -->
        <div v-else>
          <EmptyState v-if="!visible.length" :headline="emptyLabel" :caption="emptyCaption" />
          <div v-else class="grid lg:grid-cols-2 gap-3 items-start">
            <div v-for="order in visible" :key="order.id" class="relative">
              <!-- Waybill hint: distinguishes "label bought, go hand it over"
                   from "still needs a label" inside the same To-ship queue. -->
              <span
                v-if="tab === 'toship'"
                class="absolute -top-2 left-3 z-10 chip"
                :class="
                  hasWaybill(order)
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                "
              >
                {{ hasWaybill(order) ? "Waybill ready" : "No waybill" }}
              </span>
              <CompiledOrderCard
                :order="order"
                role="seller"
                @ship="openShipDialog(order.id)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Ship dialog -->
      <div
        v-if="shippingOrderId"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="shippingOrderId = null"
      >
        <div
          class="surface rounded-2xl w-full max-w-sm p-5 border border-black/[0.06] dark:border-white/[0.08]"
        >
          <h3 class="text-base font-bold text-ink dark:text-white">Mark as shipped</h3>
          <p class="mt-1 mb-3 text-xs text-ink-muted dark:text-zinc-400">
            Confirm once the parcel is actually with the courier.
          </p>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-ink-muted dark:text-zinc-400 mb-1">
                Tracking number (optional)
              </label>
              <input
                v-model="shipTrackingNumber"
                type="text"
                placeholder="e.g. EM123456789MY"
                class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-ink-muted dark:text-zinc-400 mb-1">
                Carrier (optional)
              </label>
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
              @click="shippingOrderId = null"
              class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-ink-subtle dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              @click="confirmShip"
              class="flex-1 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
            >
              Mark shipped
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ORDER_QUEUE_LABELS, hasWaybill, type OrderQueue } from "~/composables/useSellerOrders";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Orders | TCGo" });

const route = useRoute();
const router = useRouter();
const { user, signInWithGoogle } = useAuth();
const { loadingSeller, listenSellerCompiledOrders } = useCompiledOrders();

const {
  toShip,
  readyToHandOver,
  needsWaybill,
  mergeableGroups,
  queue,
  queueCount,
  shippingOrderId,
  shipTrackingNumber,
  shipCarrier,
  openShipDialog,
  confirmShip,
  merging,
  handleMerge,
  startAutoMerge,
} = useSellerOrders();

const QUEUES: OrderQueue[] = [
  "toship",
  "awaiting",
  "mergeable",
  "shipped",
  "delivered",
  "cancelled",
  "all",
];

const isQueue = (v: unknown): v is OrderQueue =>
  typeof v === "string" && (QUEUES as string[]).includes(v);

// The dashboard deep-links here with ?q=<queue>; default to the queue that
// actually needs work rather than a generic "all".
const tab = ref<OrderQueue>(isQueue(route.query.q) ? route.query.q : "toship");

// Keep the URL shareable/refresh-safe without pushing history entries.
watch(tab, (q) => router.replace({ query: { ...route.query, q } }));

const tabs = computed(() =>
  QUEUES.map((q) => ({
    id: q,
    label: ORDER_QUEUE_LABELS[q],
    count: queueCount(q),
  })),
);

const visible = computed(() => queue(tab.value));
const emptyLabel = computed(
  () => `Nothing in ${ORDER_QUEUE_LABELS[tab.value].toLowerCase()}`,
);
const EMPTY_CAPTIONS: Partial<Record<OrderQueue, string>> = {
  toship: "Every paid order has been dispatched. Nice.",
  awaiting: "No orders are waiting on a buyer payment.",
  shipped: "Nothing is in transit right now.",
  delivered: "No completed deliveries yet.",
  cancelled: "No cancelled orders — good sign.",
};
const emptyCaption = computed(() => EMPTY_CAPTIONS[tab.value]);

onMounted(() => {
  if (user.value) {
    listenSellerCompiledOrders();
    startAutoMerge();
  }
});
watch(user, (u) => {
  if (u) {
    listenSellerCompiledOrders();
    startAutoMerge();
  }
});
</script>

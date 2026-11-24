<template>
  <div class="sl-page">
    <SellerGate v-if="!user" message="Sign in to manage your orders." />

    <template v-else>
      <SellerPageHead
        title="Orders"
        description="Everything waiting on you, in the order it needs doing."
      />

      <div v-if="loadingSeller" class="flex flex-col gap-4" aria-busy="true" aria-label="Loading orders">
        <div class="mc-skel h-[96px]" />
        <div class="mc-skel h-[200px]" />
      </div>

      <template v-else>
        <!-- Where each order is, not what paperwork it has. The waybill state
             still shows per order inside the list, which is where it's
             useful. Each cell is a shortcut to its tab. -->
        <div v-if="toShip.length || shipped.length" class="mc-card mc-cells mb-5" style="--cols: 2">
          <button
            type="button"
            class="mc-cell-btn"
            :aria-pressed="tab === 'toship'"
            @click="tab = 'toship'"
          >
            <span class="mc-label flex items-center gap-2">
              <span class="mc-dot" data-tone="warn" aria-hidden="true" />
              To ship
            </span>
            <span class="mc-stat-value mc-num mt-1 block">{{ toShip.length }}</span>
            <!-- The one bit of the old waybill split worth keeping, as a
                 footnote: it only appears when there's something to do. -->
            <span class="mc-small mt-1 block">
              <template v-if="needsWaybill.length">
                {{ needsWaybill.length }} still {{ needsWaybill.length === 1 ? "needs" : "need" }} a waybill
              </template>
              <template v-else>All labelled, just hand over</template>
            </span>
          </button>
          <button
            type="button"
            class="mc-cell-btn"
            :aria-pressed="tab === 'shipped'"
            @click="tab = 'shipped'"
          >
            <span class="mc-label flex items-center gap-2">
              <span class="mc-dot" data-tone="info" aria-hidden="true" />
              In transit
            </span>
            <span class="mc-stat-value mc-num mt-1 block">{{ shipped.length }}</span>
            <span class="mc-small mt-1 block">With the courier, nothing to do</span>
          </button>
        </div>

        <McTabs v-model="tab" :tabs="tabs" class="mb-4" />

        <div v-if="!visible.length" class="mc-card mc-empty">
          <span class="font-semibold text-[var(--ink-2)]">{{ emptyLabel }}.</span>
          {{ emptyCaption }}
        </div>
        <!-- grid-cols-1 (minmax(0, 1fr)) rather than an implicit column:
             an implicit column grows to the longest single-line item or
             set name, pushing the card past the screen edge. -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          <div v-for="order in visible" :key="order.id" class="min-w-0">
            <!-- Waybill hint: "label bought, go hand it over" versus "still
                 needs a label", inside the same To-ship queue. -->
            <span v-if="tab === 'toship'" class="mc-tag gap-1.5 mb-2">
              <span class="mc-dot" :data-tone="hasWaybill(order) ? 'good' : 'warn'" aria-hidden="true" />
              {{ hasWaybill(order) ? "Waybill ready" : "No waybill yet" }}
            </span>
            <CompiledOrderCard :order="order" role="seller" />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ORDER_QUEUE_LABELS, hasWaybill, type OrderQueue } from "~/composables/useSellerOrders";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Orders | TCGo" });

const route = useRoute();
const router = useRouter();
const {user} = useAuth();
const { loadingSeller, listenSellerCompiledOrders } = useCompiledOrders();

const {
  toShip,
  needsWaybill,
  shipped,
  queue,
  queueCount,
  syncTracking,
  startAutoMerge,
} = useSellerOrders();

const QUEUES: OrderQueue[] = [
  "toship",
  "awaiting",
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

// Ask the courier where the open parcels are, once the Firestore listener has
// actually delivered them. This is what moves an order out of "To ship" now
// that there is no manual button — see syncTracking() for why the seller has
// to be the one polling. It self-throttles, so firing on every change is fine.
watch(
  () => toShip.value.length + shipped.value.length,
  (n) => {
    if (n > 0) void syncTracking();
  },
  { immediate: true },
);
</script>


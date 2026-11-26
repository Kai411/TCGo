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
        <!-- One row per order, all the same height: first card's photo,
             what's in it, who it's for, then total and stage. The full
             breakdown lives on the order page the row opens. -->
        <div v-else class="mc-card overflow-hidden">
          <NuxtLink
            v-for="order in visible"
            :key="order.id"
            :to="`/orders/${order.id}`"
            class="mc-row"
            :class="{ 'is-done': order.status === 'cancelled' }"
          >
            <span class="so-thumb">
              <span class="mc-thumb so-img"><CardImage :src="order.items[0]?.imageUrl" alt="" :width="60" /></span>
              <span v-if="order.items.length > 1" class="so-count mc-num">×{{ order.items.length }}</span>
            </span>
            <div class="min-w-0">
              <p class="mc-row-title">{{ orderTitle(order) }}</p>
              <p class="mc-meta truncate">
                {{ metaLine(order) }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="mc-num text-[14px] font-semibold">{{ formatRM(order.total) }}</p>
              <p class="mc-small flex items-center justify-end gap-1.5 mt-0.5 whitespace-nowrap">
                <span class="mc-dot so-dot" :data-tone="rowTone(order)" aria-hidden="true" />
                {{ rowLabel(order) }}
              </p>
            </div>
          </NuxtLink>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatRM } from "~/shared/format-money";
import { ORDER_QUEUE_LABELS, hasWaybill, type OrderQueue } from "~/composables/useSellerOrders";
import type { CompiledOrder } from "~/composables/useCompiledOrders";
import { deliveryStage, deliveryStageLabel, type DeliveryStage } from "~/shared/delivery-stage";

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

const orderTitle = (o: CompiledOrder) => {
  const first = o.items[0]?.cardName ?? "Order";
  return o.items.length > 1 ? `${first} + ${o.items.length - 1} more` : first;
};
const metaLine = (o: CompiledOrder) =>
  [o.buyerName || "Buyer", o.region, when(o.paidAt ?? o.createdAt), o.trackingNumber]
    .filter(Boolean)
    .join(" · ");
const when = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "";

// Status as a dot plus words. In To ship the one question is whether the
// label has been bought, so say that instead of the stage.
const STAGE_TONE: Partial<Record<DeliveryStage, string>> = {
  awaiting_payment: "warn",
  ready: "info",
  collected: "info",
  in_transit: "info",
  delivered: "good",
  cancelled: "bad",
};
const rowLabel = (o: CompiledOrder) =>
  tab.value === "toship"
    ? hasWaybill(o) ? "Waybill ready" : "No waybill yet"
    : deliveryStageLabel(o);
const rowTone = (o: CompiledOrder) =>
  tab.value === "toship"
    ? hasWaybill(o) ? "good" : "warn"
    : STAGE_TONE[deliveryStage(o)];

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


<style>
.so-thumb {
  position: relative;
  display: inline-flex;
}
.so-count {
  position: absolute;
  right: -6px;
  bottom: -4px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  background: var(--ink);
  color: var(--bg);
  box-shadow: 0 0 0 2px var(--surface);
}
.so-img {
  display: block;
  overflow: hidden;
}
.so-img .text-2xs {
  display: none;
}
.so-dot {
  width: 6px;
  height: 6px;
}
</style>

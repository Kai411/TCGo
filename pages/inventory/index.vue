<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to manage your inventory.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-5">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Sales</h1>
      </div>

      <div v-if="loadingSeller" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <template v-else>
        <!-- Dashboard -->
        <SellerSalesDashboard
          v-if="salesView === 'dashboard'"
          :orders="sellerCompiledOrders"
          :mergeable-count="mergeableGroups.length"
          @select="openSalesList"
        />

        <!-- Drill-down list -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <button
              @click="salesView = 'dashboard'"
              class="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-zinc-300 hover:text-ink dark:hover:text-white transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Dashboard
            </button>
            <h3 class="text-sm font-bold text-ink dark:text-white">{{ salesListTitle }}</h3>
          </div>

          <!-- Mergeable / All → merge groups -->
          <template v-if="salesFilter === 'mergeable' || salesFilter === 'all'">
            <p v-if="salesFilter === 'mergeable' && !mergeableGroups.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
              No mergeable orders right now.
            </p>
            <div
              v-for="group in mergeableGroups"
              :key="group.buyerUid"
              class="rounded-2xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/[0.07] p-4"
            >
              <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div class="flex items-start gap-2 min-w-0">
                  <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/><path d="M3 8h18l-1.5 11a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8L3 8z"/><path d="M12 12v5"/><path d="M9.5 14.5 12 12l2.5 2.5"/>
                  </svg>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-amber-900 dark:text-amber-200">
                      {{ group.orders.length }} orders from {{ group.buyerName }} can be merged
                    </p>
                    <p class="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                      Same buyer, all confirmed &amp; not shipped. Combine into one parcel — buyer pays shipping once.
                    </p>
                  </div>
                </div>
                <button
                  @click="handleMerge(group)"
                  :disabled="merging"
                  class="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-ink hover:bg-amber-400 transition-colors disabled:opacity-60"
                >
                  <span v-if="merging" class="animate-spin rounded-full h-4 w-4 border-b-2 border-ink"/>
                  Merge {{ group.orders.length }} orders
                </button>
              </div>
              <div class="grid lg:grid-cols-2 gap-3 items-start">
                <CompiledOrderCard
                  v-for="order in group.orders"
                  :key="order.id"
                  :order="order"
                  role="seller"
                  @confirm="markConfirmed(order.id)"
                  @ship="openShipDialog(order.id)"
                />
              </div>
            </div>

            <div v-if="salesFilter === 'all'" class="grid lg:grid-cols-2 gap-3 items-start">
              <CompiledOrderCard
                v-for="order in nonMergeableSales"
                :key="order.id"
                :order="order"
                role="seller"
                @confirm="markConfirmed(order.id)"
                @ship="openShipDialog(order.id)"
              />
            </div>
          </template>

          <!-- Specific status → filtered grid -->
          <template v-else>
            <p v-if="!filteredSales.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">
              No {{ salesFilterLabel }} orders.
            </p>
            <div v-else class="grid lg:grid-cols-2 gap-3 items-start">
              <CompiledOrderCard
                v-for="order in filteredSales"
                :key="order.id"
                :order="order"
                role="seller"
                @confirm="markConfirmed(order.id)"
                @ship="openShipDialog(order.id)"
              />
            </div>
          </template>
        </div>
      </template>

      <!-- Ship dialog -->
      <div
        v-if="shippingOrderId"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="shippingOrderId = null"
      >
        <div class="surface rounded-2xl w-full max-w-sm p-5 border border-black/[0.06] dark:border-white/[0.08]">
          <h3 class="text-base font-bold text-ink dark:text-white mb-3">Mark as shipped</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Tracking number (optional)</label>
              <input v-model="shipTrackingNumber" type="text" placeholder="e.g. EM123456789MY" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Carrier (optional)</label>
              <input v-model="shipCarrier" type="text" placeholder="e.g. Pos Laju, J&T" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button @click="shippingOrderId = null" class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200">Cancel</button>
            <button @click="confirmShip" class="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">Mark shipped</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CompiledOrder } from "~/composables/useCompiledOrders";

definePageMeta({ layout: "inventory" });
useHead({ title: "Inventory · Sales | TCGo" });

const { user, signInWithGoogle } = useAuth();
const {
  sellerCompiledOrders,
  loadingSeller,
  listenSellerCompiledOrders,
  markConfirmed,
  markShipped,
  mergeOrders,
} = useCompiledOrders();

onMounted(() => {
  if (user.value) listenSellerCompiledOrders();
});
watch(user, (u) => {
  if (u) listenSellerCompiledOrders();
});

// ── Ship dialog ───────────────────────────────────────────────────────
const shippingOrderId = ref<string | null>(null);
const shipTrackingNumber = ref("");
const shipCarrier = ref("");
const openShipDialog = (orderId: string) => {
  shippingOrderId.value = orderId;
  shipTrackingNumber.value = "";
  shipCarrier.value = "";
};
const confirmShip = async () => {
  if (!shippingOrderId.value) return;
  await markShipped(
    shippingOrderId.value,
    shipTrackingNumber.value.trim() || undefined,
    shipCarrier.value.trim() || undefined,
  );
  shippingOrderId.value = null;
};

// ── Mergeable detection ───────────────────────────────────────────────
interface MergeableGroup {
  buyerUid: string;
  buyerName: string;
  orders: CompiledOrder[];
}
const mergeableGroups = computed<MergeableGroup[]>(() => {
  const byBuyer = new Map<string, CompiledOrder[]>();
  for (const o of sellerCompiledOrders.value) {
    if (o.status !== "confirmed") continue;
    if (!byBuyer.has(o.buyerUid)) byBuyer.set(o.buyerUid, []);
    byBuyer.get(o.buyerUid)!.push(o);
  }
  const groups: MergeableGroup[] = [];
  for (const [buyerUid, orders] of byBuyer) {
    if (orders.length >= 2) {
      orders.sort((a, b) => a.createdAt - b.createdAt);
      groups.push({ buyerUid, buyerName: orders[0].buyerName, orders });
    }
  }
  return groups;
});
const mergeableOrderIds = computed(() => {
  const set = new Set<string>();
  for (const g of mergeableGroups.value) for (const o of g.orders) set.add(o.id);
  return set;
});
const nonMergeableSales = computed(() =>
  sellerCompiledOrders.value.filter((o) => !mergeableOrderIds.value.has(o.id)),
);

// Defensive auto-merge of duplicate pending orders.
const autoMerging = ref(false);
watch(
  sellerCompiledOrders,
  async (orders) => {
    if (autoMerging.value) return;
    const byBuyer = new Map<string, CompiledOrder[]>();
    for (const o of orders) {
      if (o.status !== "pending") continue;
      if (!byBuyer.has(o.buyerUid)) byBuyer.set(o.buyerUid, []);
      byBuyer.get(o.buyerUid)!.push(o);
    }
    const dupe = [...byBuyer.values()].find((g) => g.length >= 2);
    if (!dupe) return;
    autoMerging.value = true;
    try {
      await mergeOrders(dupe.map((o) => o.id));
    } catch (e) {
      console.error("[inventory] pending auto-merge failed:", e);
    } finally {
      autoMerging.value = false;
    }
  },
  { deep: false },
);

const merging = ref(false);
const handleMerge = async (group: MergeableGroup) => {
  if (merging.value) return;
  if (!confirm(`Merge ${group.orders.length} orders from ${group.buyerName} into one shipment?`)) return;
  merging.value = true;
  try {
    await mergeOrders(group.orders.map((o) => o.id));
  } catch (e: any) {
    alert(e?.message || "Could not merge orders.");
  } finally {
    merging.value = false;
  }
};

// ── Dashboard ↔ drill-down ────────────────────────────────────────────
type SalesFilter = "all" | "pending" | "toship" | "mergeable" | "shipped" | "delivered" | "cancelled";
const salesView = ref<"dashboard" | "list">("dashboard");
const salesFilter = ref<SalesFilter>("all");
const openSalesList = (filter: string) => {
  salesFilter.value = filter as SalesFilter;
  salesView.value = "list";
};

const SALES_FILTER_LABELS: Record<SalesFilter, string> = {
  all: "All sales",
  pending: "Pending",
  toship: "To ship",
  mergeable: "Mergeable",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const salesFilterLabel = computed(() => SALES_FILTER_LABELS[salesFilter.value].toLowerCase());
const salesListTitle = computed(() => SALES_FILTER_LABELS[salesFilter.value]);

const filteredSales = computed(() => {
  switch (salesFilter.value) {
    case "pending":
      return sellerCompiledOrders.value.filter((o) => o.status === "pending");
    case "toship":
      return sellerCompiledOrders.value.filter((o) => o.status === "confirmed" || o.status === "paid");
    case "shipped":
      return sellerCompiledOrders.value.filter((o) => o.status === "shipped");
    case "delivered":
      return sellerCompiledOrders.value.filter((o) => o.status === "delivered");
    case "cancelled":
      return sellerCompiledOrders.value.filter((o) => o.status === "cancelled");
    default:
      return sellerCompiledOrders.value;
  }
});
</script>

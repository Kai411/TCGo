import type { CompiledOrder } from "~/composables/useCompiledOrders";
import { mergeGroupKey } from "~/shared/merge-orders";

/**
 * Seller-side order queues, merge detection and the ship dialog.
 *
 * Extracted out of pages/seller/index.vue so the dashboard and the
 * dedicated Orders page read from ONE definition of "to ship". They used to
 * each carry their own filter, which is how a booked waybill could count as
 * shipped in one place and not the other.
 */
export type OrderQueue =
  | "toship"
  | "awaiting"
  | "mergeable"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "all";

export const ORDER_QUEUE_LABELS: Record<OrderQueue, string> = {
  toship: "To ship",
  awaiting: "Awaiting payment",
  mergeable: "Mergeable",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  all: "All orders",
};

export interface MergeableGroup {
  /** buyer + destination — orders only merge when both match. */
  key: string;
  buyerUid: string;
  buyerName: string;
  orders: CompiledOrder[];
}

/**
 * A paid order still sitting with the seller. "confirmed" is the legacy manual
 * -payment state and belongs here too — both mean money is in and the parcel
 * hasn't gone yet.
 */
export const isAwaitingShipment = (o: CompiledOrder) =>
  o.status === "paid" || o.status === "confirmed";

/** The courier label has been bought — seller just has to hand the parcel over. */
export const hasWaybill = (o: CompiledOrder) => !!o.shipmentOrderNo;

// Module-level: the defensive auto-merge must run once per session, not once
// per component that happens to call this composable.
let autoMergeStarted = false;

// Tracking poll bookkeeping, module-level so navigating between the dashboard
// and the Orders page doesn't re-poll the same consignments.
const TRACK_TTL_MS = 5 * 60 * 1000;
const TRACK_BATCH = 12;
const lastTracked = new Map<string, number>();
let syncingTracking = false;

export const useSellerOrders = () => {
  const { sellerCompiledOrders, mergeOrders } = useCompiledOrders();

  const byStatus = (...s: CompiledOrder["status"][]) =>
    computed(() => sellerCompiledOrders.value.filter((o) => s.includes(o.status)));

  const awaitingPayment = byStatus("pending");
  const shipped = byStatus("shipped");
  const delivered = byStatus("delivered");
  const cancelled = byStatus("cancelled");

  const toShip = computed(() =>
    sellerCompiledOrders.value.filter(isAwaitingShipment),
  );

  /** Subset of `toShip` whose label is already paid for — the fastest wins. */
  const readyToHandOver = computed(() => toShip.value.filter(hasWaybill));

  /** Subset of `toShip` with no label yet. */
  const needsWaybill = computed(() => toShip.value.filter((o) => !hasWaybill(o)));

  // ── Mergeable detection ─────────────────────────────────────────────
  // Paid-and-unshipped orders to the same buyer AND the same destination.
  // A booked waybill does NOT exclude an order any more: the merge route
  // cancels the group's labels and books one fresh waybill for the combined
  // parcel. Auctions never merge (their "item" is the auction doc, and
  // settlement assumes one auction per order); flagged payments wait for an
  // admin.
  const mergeableGroups = computed<MergeableGroup[]>(() => {
    const byDest = new Map<string, CompiledOrder[]>();
    for (const o of sellerCompiledOrders.value) {
      if (!isAwaitingShipment(o)) continue;
      if (o.auctionId || o.paymentAmountMismatch || o.mergedInto) continue;
      const key = mergeGroupKey(o);
      if (!byDest.has(key)) byDest.set(key, []);
      byDest.get(key)!.push(o);
    }
    const groups: MergeableGroup[] = [];
    for (const [key, orders] of byDest) {
      if (orders.length >= 2) {
        orders.sort((a, b) => a.createdAt - b.createdAt);
        groups.push({
          key,
          buyerUid: orders[0]!.buyerUid,
          buyerName: orders[0]!.buyerName,
          orders,
        });
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

  const queue = (q: OrderQueue): CompiledOrder[] => {
    switch (q) {
      case "toship":
        return toShip.value;
      case "awaiting":
        return awaitingPayment.value;
      case "shipped":
        return shipped.value;
      case "delivered":
        return delivered.value;
      case "cancelled":
        return cancelled.value;
      case "mergeable":
        return mergeableGroups.value.flatMap((g) => g.orders);
      default:
        return sellerCompiledOrders.value;
    }
  };

  const queueCount = (q: OrderQueue) =>
    q === "mergeable" ? mergeableGroups.value.length : queue(q).length;

  // ── Courier-driven status ───────────────────────────────────────────
  // The manual "Mark shipped" dialog is gone: order status now follows the
  // courier's own scans via /api/shipping/track, so a seller can't tell the
  // buyer a parcel is on its way before the courier has actually collected it.
  // markShipped() remains on useCompiledOrders as a deliberate escape hatch
  // for a shipment that never got a Delyva booking.
  //
  // Which leaves the question of who asks the courier. The order page only
  // polls for the *buyer*, so without this an order would advance only if the
  // buyer happened to open it — and since payout eligibility keys off
  // deliveredAt, a quiet buyer would leave the seller's money locked up. The
  // seller's own Orders page now polls too.
  const trackable = (o: CompiledOrder) =>
    !!o.trackingNumber && o.status !== "delivered" && o.status !== "cancelled";

  const syncTracking = async () => {
    if (syncingTracking) return;
    syncingTracking = true;
    try {
      const { authedFetch } = useAuthedFetch();
      const now = Date.now();
      const due = sellerCompiledOrders.value
        .filter(trackable)
        .filter((o) => now - (lastTracked.get(o.id) ?? 0) > TRACK_TTL_MS)
        // One shop can have a long tail of open orders; cap the burst so a
        // page load never fires dozens of courier calls at once.
        .slice(0, TRACK_BATCH);

      for (const o of due) {
        lastTracked.set(o.id, now);
        try {
          await authedFetch("/api/shipping/track", {
            method: "POST",
            body: { orderId: o.id },
          });
        } catch (e) {
          // A parcel the courier hasn't scanned yet is the normal case, and
          // one failure must not stop the rest of the batch.
          console.debug("[useSellerOrders] tracking sync skipped", o.id, e);
        }
      }
    } finally {
      syncingTracking = false;
    }
  };

  // ── Merge ───────────────────────────────────────────────────────────
  const merging = ref(false);
  const handleMerge = async (group: MergeableGroup) => {
    if (merging.value) return;
    const withWaybill = group.orders.filter(hasWaybill).length;
    const lines = [
      `Merge ${group.orders.length} orders from ${group.buyerName} into one parcel?`,
    ];
    if (withWaybill) {
      lines.push(
        `${withWaybill} waybill${withWaybill > 1 ? "s" : ""} already bought will be cancelled and one new waybill booked for the combined parcel.`,
      );
    }
    if (!confirm(lines.join("\n\n"))) return;
    merging.value = true;
    try {
      await mergeOrders(group.orders.map((o) => o.id));
    } catch (e: any) {
      // authedFetch surfaces H3 errors on e.data.message.
      alert(e?.data?.message || e?.message || "Could not merge orders.");
    } finally {
      merging.value = false;
    }
  };

  /**
   * Defensive auto-merge of duplicate *pending* orders from one buyer — they
   * are the same checkout hitting Firestore twice. Registered once per session.
   */
  const startAutoMerge = () => {
    if (autoMergeStarted) return;
    autoMergeStarted = true;
    let running = false;
    watch(sellerCompiledOrders, async (orders) => {
      if (running) return;
      const byBuyer = new Map<string, CompiledOrder[]>();
      for (const o of orders) {
        if (o.status !== "pending") continue;
        // Auction wins are one-order-per-auction with a payment deadline —
        // never fold them into a marketplace checkout.
        if (o.auctionId || o.mergedInto) continue;
        if (!byBuyer.has(o.buyerUid)) byBuyer.set(o.buyerUid, []);
        byBuyer.get(o.buyerUid)!.push(o);
      }
      const dupe = [...byBuyer.values()].find((g) => g.length >= 2);
      if (!dupe) return;
      running = true;
      try {
        await mergeOrders(dupe.map((o) => o.id));
      } catch (e) {
        console.error("[useSellerOrders] pending auto-merge failed:", e);
      } finally {
        running = false;
      }
    });
  };

  return {
    awaitingPayment,
    toShip,
    readyToHandOver,
    needsWaybill,
    shipped,
    delivered,
    cancelled,
    mergeableGroups,
    nonMergeableSales,
    queue,
    queueCount,
    syncTracking,
    merging,
    handleMerge,
    startAutoMerge,
  };
};

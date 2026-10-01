import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type {
  CompiledOrder,
  CompiledOrderItem,
  CompiledOrderStatus,
} from "~/utils/orders";

// The order model and lifecycle live in utils/orders.ts so the server can use
// them too. Re-exported here so existing imports keep working.
export type {
  CompiledOrder,
  CompiledOrderItem,
  CompiledOrderStatus,
  CompiledPaymentMethod,
} from "~/utils/orders";

export interface CompiledOrderInputItem {
  cardId: string;
  cardName: string;
  cardSet: string;
  condition: string;
  imageUrl: string;
  price: number;
  shippingWM: number;
  shippingEM: number;
  sellerUid: string;
  sellerName: string;
}

const STATUS_LABEL: Record<CompiledOrderStatus, string> = {
  pending: "Awaiting Seller",
  confirmed: "Confirmed",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  disputed: "Disputed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<CompiledOrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  shipped: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  disputed: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  refunded: "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-zinc-400",
};

export const compiledOrderStatusLabel = (s: CompiledOrderStatus) =>
  STATUS_LABEL[s] ?? s;
export const compiledOrderStatusColor = (s: CompiledOrderStatus) =>
  STATUS_COLOR[s] ?? "";

const buyerCompiledOrders = ref<CompiledOrder[]>([]);
const sellerCompiledOrders = ref<CompiledOrder[]>([]);
const loadingBuyer = ref(false);
const loadingSeller = ref(false);
let buyerUnsub: Unsubscribe | null = null;
let sellerUnsub: Unsubscribe | null = null;

export const useCompiledOrders = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  // Note: sorted client-side so a single-field equality query is enough —
  // no composite Firestore index needed for (sellerUid|buyerUid + createdAt).
  const listenBuyerCompiledOrders = () => {
    if (!user.value || !firestore) return;
    buyerUnsub?.();
    loadingBuyer.value = true;
    const q = query(
      collection(firestore, "compiledOrders"),
      where("buyerUid", "==", user.value.uid),
    );
    buyerUnsub = onSnapshot(
      q,
      (snap) => {
        buyerCompiledOrders.value = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as CompiledOrder)
          .sort((a, b) => b.createdAt - a.createdAt);
        loadingBuyer.value = false;
      },
      (err) => {
        console.error("[useCompiledOrders] buyer listener error:", err);
        loadingBuyer.value = false;
      },
    );
  };

  const listenSellerCompiledOrders = () => {
    if (!user.value || !firestore) return;
    sellerUnsub?.();
    loadingSeller.value = true;
    const q = query(
      collection(firestore, "compiledOrders"),
      where("sellerUid", "==", user.value.uid),
    );
    sellerUnsub = onSnapshot(
      q,
      (snap) => {
        sellerCompiledOrders.value = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as CompiledOrder)
          .sort((a, b) => b.createdAt - a.createdAt);
        loadingSeller.value = false;
      },
      (err) => {
        console.error("[useCompiledOrders] seller listener error:", err);
        loadingSeller.value = false;
      },
    );
  };

  // All writes go through the server (server/utils/orders.ts), which reads
  // prices from the listings, reserves cards atomically and checks that the
  // caller is allowed to make each status change.
  const { apiFetch } = useApi();

  const setStatus = (orderId: string, to: CompiledOrderStatus, extra: Record<string, unknown> = {}) =>
    apiFetch<{ order: CompiledOrder }>(`/api/orders/${orderId}/status`, {
      method: "POST",
      body: { to, ...extra },
    }).then((r) => r.order);

  // One order per seller, appended to the buyer's open (pending) order with
  // that seller when there is one. Only card ids are sent; the server fills
  // in prices and shipping from the listings.
  const createCompiledOrders = async (
    items: CompiledOrderInputItem[],
    region: "WM" | "EM",
    buyerDisplayName: string,
  ): Promise<CompiledOrder[]> => {
    if (!items.length) return [];
    const res = await apiFetch<{ orders: CompiledOrder[] }>("/api/orders", {
      method: "POST",
      body: { cardIds: items.map((i) => i.cardId), region, buyerName: buyerDisplayName },
    });
    return res.orders;
  };

  // Confirming reserves every card (sold: true) so it leaves the shop.
  const markConfirmed = (orderId: string) => setStatus(orderId, "confirmed");

  // Manual (WhatsApp) orders only: the seller received the money.
  const markPaid = (orderId: string) => setStatus(orderId, "paid");

  const markShipped = (orderId: string, trackingNumber?: string, carrier?: string) =>
    setStatus(orderId, "shipped", { trackingNumber, carrier });

  const markDelivered = (orderId: string) => setStatus(orderId, "delivered");

  // Cancelling a confirmed order puts its cards back on sale.
  const cancelOrder = (orderId: string, reason?: string) =>
    setStatus(orderId, "cancelled", { reason });

  // Buyer Protection orders: hold the seller's payout while support looks.
  const raiseDispute = (orderId: string, reason: string) =>
    setStatus(orderId, "disputed", { reason });

  const updateRegion = (orderId: string, region: "WM" | "EM") =>
    apiFetch<{ order: CompiledOrder }>(`/api/orders/${orderId}/region`, {
      method: "POST",
      body: { region },
    }).then((r) => r.order);

  // Buyer Protection checkout for a confirmed order. Redirects to Billplz;
  // the order turns "paid" when Billplz's signed callback reaches the server.
  const startPayment = async (orderId: string) => {
    const res = await apiFetch<{ url: string | null; alreadyPaid?: boolean }>(
      `/api/orders/${orderId}/pay`,
      { method: "POST" },
    );
    if (res.url) window.location.href = res.url;
    return res;
  };

  const getCompiledOrder = async (
    orderId: string,
  ): Promise<CompiledOrder | null> => {
    if (!firestore) return null;
    const snap = await getDoc(doc(firestore, "compiledOrders", orderId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as CompiledOrder;
  };

  // Combine un-shipped orders between one buyer and seller into the oldest.
  // All pending → stays pending; any confirmed → confirmed and every card is
  // reserved. See mergeOrders in server/utils/orders.ts.
  const mergeOrders = async (orderIds: string[]): Promise<string | null> => {
    if (orderIds.length < 2) return null;
    const res = await apiFetch<{ id: string }>("/api/orders/merge", {
      method: "POST",
      body: { orderIds },
    });
    return res.id;
  };

  return {
    buyerCompiledOrders,
    sellerCompiledOrders,
    loadingBuyer,
    loadingSeller,
    listenBuyerCompiledOrders,
    listenSellerCompiledOrders,
    createCompiledOrders,
    markConfirmed,
    markPaid,
    markShipped,
    markDelivered,
    cancelOrder,
    raiseDispute,
    updateRegion,
    startPayment,
    getCompiledOrder,
    mergeOrders,
  };
};

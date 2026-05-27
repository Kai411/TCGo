import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  type Unsubscribe,
} from "firebase/firestore";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "disputed";

export interface Order {
  id: string;
  buyerUid: string;
  buyerEmail: string;
  sellerUid: string;
  sellerName: string;
  cardId: string;
  cardName: string;
  cardSet: string;
  imageUrl: string;
  price: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  createdAt: number;
  paidAt?: number;
  shippedAt?: number;
  deliveredAt?: number;
  trackingNumber?: string;
  shippingCarrier?: string;
}

export interface PendingOrderInput {
  cardId: string;
  cardName: string;
  cardSet: string;
  imageUrl: string;
  sellerUid: string;
  sellerName: string;
  price: number;
  shipping: number;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting Payment",
  paid: "Paid · Awaiting Shipment",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: "text-gray-500 dark:text-zinc-400",
  paid: "text-blue-600 dark:text-blue-400",
  shipped: "text-amber-600 dark:text-amber-400",
  delivered: "text-emerald-600 dark:text-emerald-400",
  cancelled: "text-red-500",
  disputed: "text-orange-500",
};

export const orderStatusLabel = (s: OrderStatus) => STATUS_LABEL[s] ?? s;
export const orderStatusColor = (s: OrderStatus) => STATUS_COLOR[s] ?? "";

const buyerOrders = ref<Order[]>([]);
const sellerOrders = ref<Order[]>([]);
const loadingBuyer = ref(false);
const loadingSeller = ref(false);
let buyerUnsub: Unsubscribe | null = null;
let sellerUnsub: Unsubscribe | null = null;

export const useOrders = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const listenBuyerOrders = () => {
    if (!user.value || !firestore) return;
    buyerUnsub?.();
    loadingBuyer.value = true;
    const q = query(
      collection(firestore, "orders"),
      where("buyerUid", "==", user.value.uid),
      orderBy("createdAt", "desc"),
    );
    buyerUnsub = onSnapshot(q, (snap) => {
      buyerOrders.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
      loadingBuyer.value = false;
    });
  };

  const listenSellerOrders = () => {
    if (!user.value || !firestore) return;
    sellerUnsub?.();
    loadingSeller.value = true;
    const q = query(
      collection(firestore, "orders"),
      where("sellerUid", "==", user.value.uid),
      orderBy("createdAt", "desc"),
    );
    sellerUnsub = onSnapshot(q, (snap) => {
      sellerOrders.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
      loadingSeller.value = false;
    });
  };

  const createPendingOrders = async (items: PendingOrderInput[]): Promise<Order[]> => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    const orders: Order[] = [];
    for (const item of items) {
      const ref = doc(collection(firestore, "orders"));
      const order: Order = {
        id: ref.id,
        buyerUid: user.value.uid,
        buyerEmail: user.value.email || "",
        sellerUid: item.sellerUid,
        sellerName: item.sellerName,
        cardId: item.cardId,
        cardName: item.cardName,
        cardSet: item.cardSet,
        imageUrl: item.imageUrl,
        price: item.price,
        shipping: item.shipping,
        total: item.price + item.shipping,
        status: "pending_payment",
        stripeSessionId: "",
        createdAt: Date.now(),
      };
      await setDoc(ref, order);
      orders.push(order);
    }
    return orders;
  };

  const cancelPendingOrders = async (orderIds: string[]) => {
    if (!firestore) return;
    for (const id of orderIds) {
      try {
        await deleteDoc(doc(firestore, "orders", id));
      } catch {}
    }
  };

  const markDelivered = async (orderId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "orders", orderId), {
      status: "delivered",
      deliveredAt: Date.now(),
    });
  };

  const addTracking = async (orderId: string, trackingNumber: string, carrier: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "orders", orderId), {
      status: "shipped",
      shippedAt: Date.now(),
      trackingNumber,
      shippingCarrier: carrier,
    });
  };

  const getOrdersBySession = async (sessionId: string): Promise<Order[]> => {
    if (!firestore) return [];
    const q = query(
      collection(firestore, "orders"),
      where("stripeSessionId", "==", sessionId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
  };

  const getOrder = async (orderId: string): Promise<Order | null> => {
    if (!firestore) return null;
    const snap = await getDoc(doc(firestore, "orders", orderId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as Order;
  };

  return {
    buyerOrders,
    sellerOrders,
    loadingBuyer,
    loadingSeller,
    listenBuyerOrders,
    listenSellerOrders,
    createPendingOrders,
    cancelPendingOrders,
    markDelivered,
    addTracking,
    getOrdersBySession,
    getOrder,
  };
};

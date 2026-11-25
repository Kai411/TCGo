import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import type { PayoutStatus } from "~/shared/payouts";

// pending  → order placed, awaiting the buyer's online payment
// confirmed → legacy: seller confirmed a manual payment. No new order reaches
//             this state — payment is FPX-only — but historical orders still
//             carry it, so it stays readable throughout.
// paid     → Billplz confirmed the payment (the webhook sets this)
// shipped  → seller dispatched (tracking optional)
// delivered → buyer confirmed receipt
// cancelled → either party cancelled before shipment
export type CompiledOrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

// "manual" is legacy-only, kept so old order documents still typecheck.
export type CompiledPaymentMethod = "manual" | "stripe" | "billplz";

export interface CompiledOrderItem {
  cardId: string;
  cardName: string;
  cardSet: string;
  condition: string;
  imageUrl: string;
  price: number;
  shippingWM: number;
  shippingEM: number;
}

export interface CompiledOrder {
  id: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  sellerUid: string;
  sellerName: string;
  items: CompiledOrderItem[];
  // Sum of item prices.
  subtotal: number;
  // Max of items' shipping fees — one combined shipment.
  shippingWM: number;
  shippingEM: number;
  // Derived from the delivery address at payment time.
  region: "WM" | "EM";
  shipping: number;
  total: number;
  // True once `shipping` came from a live courier quote rather than a
  // seller-set figure. Cart sets it at checkout; create-bill fills it in for
  // orders that never went through the cart (auction wins, legacy orders).
  shippingQuoted?: boolean;
  /** Ships inside another order's parcel; combined once this one is paid. */
  joinsOrderId?: string | null;
  /** Orders folded into this one, once they have been. */
  joinedOrderIds?: string[];
  shippingCourier?: string;
  shippingQuotedRate?: number; // raw courier rate before the buffer
  shippingServiceId?: string;
  shippingServiceCode?: string;
  shippingWeightKg?: number;
  status: CompiledOrderStatus;
  paymentMethod: CompiledPaymentMethod;
  createdAt: number;
  confirmedAt?: number;
  paidAt?: number;
  shippedAt?: number;
  deliveredAt?: number;
  cancelledAt?: number;
  cancelReason?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  // Reserved for future escrow integration.
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  payoutStatus?: PayoutStatus;
  payoutEligibleAt?: number;
  payoutRequestedAt?: number; // seller requested payout of available funds
  payoutPaidAt?: number; // Billplz confirmed the transfer
  payoutId?: string; // ledger doc in `payouts` covering this order
  payoutFailureReason?: string;

  // ── Online payment (Billplz) ────────────────────────────────────────
  billplzBillId?: string;
  billplzPaidAt?: string | null;
  billplzAmountSen?: number; // what we priced the bill at, for webhook checks
  // Set when Billplz reported a collected amount that didn't match the bill.
  // The order is deliberately left unsettled when this is present.
  paymentAmountMismatch?: { expectedSen: number; paidSen: number; at: number };
  platformFee?: number;
  sellerPayout?: number;

  // Buyer's delivery address — required before online payment; feeds the
  // EasyParcel shipment as the receiver.
  deliveryAddress?: {
    name: string;
    phone: string;
    address1: string;
    address2?: string;
    postcode: string;
    city: string;
    state: string; // EasyParcel state code
  };

  // Invoice email bookkeeping. `invoiceEmailSandbox` records that the message
  // was captured by Mailtrap's sandbox rather than delivered, so a "sent"
  // timestamp can't be mistaken for the buyer having received it.
  invoiceEmailedAt?: number;
  invoiceEmailedTo?: string;
  invoiceEmailSandbox?: boolean;

  // Set when this order was created by winning an auction, rather than from
  // the cart. The single item's cardId is the auction id.
  auctionId?: string;
  // Deadline for the winner to pay before the result is voided.
  paymentDueAt?: number;

  // Shipment bookkeeping. Only set once a platform-booked label exists —
  // today sellers ship themselves and only trackingNumber/shippingCarrier
  // are filled in via markShipped.
  shipmentOrderNo?: string | null;
  shipmentStatus?: string | null;
  shipmentClaimedAt?: number | null;
  // Set when the courier label was bought. This is NOT the same as shipped:
  // the label exists but the parcel hasn't been handed over yet, so the order
  // stays in "To ship" with a "Waybill ready" hint until the seller dispatches.
  shipmentBookedAt?: number | null;
  // Set when automatic booking failed; the seller can retry from the order.
  shipmentError?: string | null;
  // Kept for the audit trail after a shipment is cancelled.
  cancelledShipmentOrderNo?: string;
  awbLink?: string;
  awbLinkFetchedAt?: number;

  // Merge bookkeeping (seller consolidating multiple confirmed orders).
  mergedFrom?: string[]; // on the surviving order: ids it absorbed
  mergedAt?: number;
  mergedInto?: string; // on an absorbed (cancelled) order: surviving id
  // ── Refund, on a cancelled order ────────────────────────────────────
  // "pending" means owed and not yet sent. Billplz has no refund API, so
  // the money is moved by hand from their dashboard and only then does this
  // become "refunded" — see server/api/orders/cancel.post.ts.
  refundStatus?: "pending" | "processing" | "refunded" | "failed";
  /** A problem the buyer reported after paying; see shared/order-problems.ts. */
  problem?: import("~/shared/order-problems").OrderProblem;
  refundAmount?: number;
  refundBillplzBillId?: string | null;
  refundedAt?: number;
  cancelledBy?: "buyer" | "seller" | "admin";
}

// A frozen courier quote, carried from the cart onto the order.
export interface QuotedShipping {
  shipping: number;
  courier: string;
  serviceId: string;
  serviceCode: string;
  quotedRate: number;
  /**
   * The already-paid, not-yet-labelled order this one ships with. Set by
   * /api/shipping/quote when it finds one; shipping is zero in that case
   * because the buyer already paid postage on that parcel.
   */
  joinsOrderId?: string | null;
}

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
  pending: "Awaiting Payment",
  confirmed: "Confirmed", // legacy manual orders only
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<CompiledOrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  shipped: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
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

// Group input items by sellerUid → one CompiledOrder per seller.
export const groupItemsBySeller = (
  items: CompiledOrderInputItem[],
): Record<string, CompiledOrderInputItem[]> => {
  const groups: Record<string, CompiledOrderInputItem[]> = {};
  for (const item of items) {
    if (!groups[item.sellerUid]) groups[item.sellerUid] = [];
    groups[item.sellerUid].push(item);
  }
  return groups;
};

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

  // Create one CompiledOrder per seller, or add to the buyer's unpaid order
  // with that seller ("compile across sessions"). The server does it
  // (/api/orders/place): it prices every card from its listing and quotes
  // postage to the buyer's saved address itself, so nothing the browser says
  // about money reaches the order. Only the card ids are sent.
  const createCompiledOrders = async (
    items: Pick<CompiledOrderInputItem, "cardId">[],
  ): Promise<CompiledOrder[]> => {
    if (!user.value) throw new Error("Not authenticated");
    if (!items.length) return [];
    const { authedFetch } = useAuthedFetch();
    const res = await authedFetch<{ orders: CompiledOrder[] }>("/api/orders/place", {
      method: "POST",
      body: { cardIds: items.map((i) => i.cardId) },
    });
    return res.orders ?? [];
  };

  // NOTE: there is deliberately no markConfirmed here any more. Sellers used
  // to confirm a manual payment by hand, which meant the platform
  // took a seller's word for it that money had changed hands — and let them
  // book a courier on platform credit for a sale it never saw. Payment is
  // FPX-only now: the Billplz webhook is the only thing that can mark an order
  // paid, and cards are locked there.

  // Tell the other side (bell and push). The server reads the order itself
  // and never announces the same status twice. Best-effort: the status change
  // already happened, and a missed notice mustn't look like it failed.
  const announceStatus = (orderId: string) => {
    useAuthedFetch()
      .authedFetch("/api/orders/status-notify", { method: "POST", body: { orderId } })
      .catch(() => {});
  };

  const markShipped = async (
    orderId: string,
    trackingNumber?: string,
    carrier?: string,
  ) => {
    if (!firestore) return;
    const patch: Record<string, unknown> = {
      status: "shipped",
      shippedAt: Date.now(),
    };
    if (trackingNumber) patch.trackingNumber = trackingNumber;
    if (carrier) patch.shippingCarrier = carrier;
    await updateDoc(doc(firestore, "compiledOrders", orderId), patch);
    announceStatus(orderId);
  };

  const markDelivered = async (orderId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, "compiledOrders", orderId), {
      status: "delivered",
      deliveredAt: Date.now(),
    });
    announceStatus(orderId);
  };

  const cancelOrder = async (orderId: string, reason?: string) => {
    if (!firestore) return;
    const orderRef = doc(firestore, "compiledOrders", orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return;
    const order = snap.data() as CompiledOrder;
    // Auction wins can't be cancelled — the rules refuse the write anyway,
    // but say why rather than surface a permission error.
    if ((order as any).auctionId) {
      throw new Error("Auction wins can't be cancelled. Contact support if there's a problem with this order.");
    }

    const batch = writeBatch(firestore);
    batch.update(orderRef, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelReason: reason || "",
    });
    // If cards were marked sold during confirm/paid, list them again.
    // Pending orders never marked cards; shipped/delivered are past the
    // point where automatic rollback is safe.
    if (order.status === "confirmed" || order.status === "paid") {
      for (const item of order.items) {
        batch.update(doc(firestore, "cards", item.cardId), {
          sold: false,
          soldAt: null,
        });
      }
    }
    await batch.commit();
  };

  const getCompiledOrder = async (
    orderId: string,
  ): Promise<CompiledOrder | null> => {
    if (!firestore) return null;
    const snap = await getDoc(doc(firestore, "compiledOrders", orderId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as CompiledOrder;
  };

  // Combine several un-shipped orders from the same buyer into one shipment.
  // All the heavy lifting happens in /api/orders/merge: outstanding payment
  // bills are voided, already-booked waybills are cancelled, the newer orders
  // fold into the oldest, and ONE new waybill is booked for the combined
  // parcel. Client-side this is just an authenticated call — merging touches
  // Billplz and Delyva money, which never belongs in the browser.
  const mergeOrders = async (orderIds: string[]): Promise<string | null> => {
    if (orderIds.length < 2) return null;
    const { authedFetch } = useAuthedFetch();
    const res = await authedFetch<{ mergedInto: string }>("/api/orders/merge", {
      method: "POST",
      body: { orderIds },
    });
    return res.mergedInto ?? null;
  };

  return {
    buyerCompiledOrders,
    sellerCompiledOrders,
    loadingBuyer,
    loadingSeller,
    listenBuyerCompiledOrders,
    listenSellerCompiledOrders,
    createCompiledOrders,
    markShipped,
    markDelivered,
    cancelOrder,
    getCompiledOrder,
    mergeOrders,
  };
};

// Order model and lifecycle, shared by the browser (auto-imported from
// utils/) and the server (imported as ~/utils/orders). Keep this file free of
// firebase imports so both sides can load it.
//
// The server is the only writer of compiledOrders. The browser uses
// canTransition() just to decide which buttons to show; the server enforces
// the same table in server/utils/orders.ts.

// pending    → buyer placed order, seller hasn't confirmed
// confirmed  → seller accepted; cards are reserved (sold: true)
// paid       → buyer money received (Billplz callback, or seller marks a
//              manual/WhatsApp payment as received)
// shipped    → seller dispatched (tracking optional)
// delivered  → buyer confirmed receipt; Buyer Protection window starts
// completed  → Buyer Protection window over and seller payout released
// disputed   → buyer raised a problem after paying; payout is on hold
// refunded   → buyer money returned (admin, Buyer Protection orders only)
// cancelled  → cancelled before shipment
export type CompiledOrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "shipped"
  | "delivered"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled";

// manual  → buyer and seller settle over WhatsApp; TCGo never holds money.
// billplz → Buyer Protection: buyer pays TCGo's holding account, seller is
//           paid by Payment Order after delivery.
// stripe  → legacy value on old orders; no new orders use it.
export type CompiledPaymentMethod = "manual" | "billplz" | "stripe";

export type PayoutStatus = "pending" | "queued" | "processing" | "paid" | "failed";

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
  // Buyer-selected region; total is computed from this.
  region: "WM" | "EM";
  shipping: number;
  total: number;
  status: CompiledOrderStatus;
  paymentMethod: CompiledPaymentMethod;
  createdAt: number;
  confirmedAt?: number;
  paidAt?: number;
  shippedAt?: number;
  deliveredAt?: number;
  completedAt?: number;
  disputedAt?: number;
  disputeReason?: string;
  refundedAt?: number;
  cancelledAt?: number;
  cancelReason?: string;
  trackingNumber?: string;
  shippingCarrier?: string;

  // Buyer Protection (Billplz). Amounts are integer sen.
  billplzBillId?: string;
  billplzBillUrl?: string;
  amountSen?: number;
  // Set when money arrived for an order that was already cancelled.
  needsRefund?: boolean;
  payoutStatus?: PayoutStatus;
  payoutEligibleAt?: number;

  // Legacy Stripe fields on old orders.
  stripeSessionId?: string;
  stripePaymentIntentId?: string;

  // Merge bookkeeping (seller consolidating multiple confirmed orders).
  mergedFrom?: string[]; // on the surviving order: ids it absorbed
  mergedAt?: number;
  mergedInto?: string; // on an absorbed (cancelled) order: surviving id
}

export type OrderActor = "buyer" | "seller" | "admin" | "system";

type TransitionTable = Partial<
  Record<CompiledOrderStatus, Partial<Record<CompiledOrderStatus, OrderActor[]>>>
>;

// Who may move an order from one status to another. "system" is the payment
// callback or a scheduled job; admins can always do what system does.
const TRANSITIONS: TransitionTable = {
  pending: {
    confirmed: ["seller"],
    cancelled: ["buyer", "seller", "admin"],
  },
  confirmed: {
    // Manual orders: the seller says the WhatsApp payment arrived.
    // Billplz orders: only the verified payment callback can mark paid.
    paid: ["seller", "system"],
    // Manual orders can ship once the seller is happy with the WhatsApp
    // payment; Buyer Protection orders must be paid first (checked below).
    shipped: ["seller"],
    cancelled: ["buyer", "seller", "admin"],
  },
  paid: {
    shipped: ["seller"],
    cancelled: ["seller", "admin"], // manual orders only (checked below)
    refunded: ["admin"],
  },
  shipped: {
    delivered: ["buyer", "system"],
    disputed: ["buyer"],
  },
  delivered: {
    completed: ["system"],
    disputed: ["buyer"], // only inside the Buyer Protection window
  },
  disputed: {
    completed: ["admin"], // resolved for the seller
    refunded: ["admin"], // resolved for the buyer
  },
};

// Days after delivery during which a Buyer Protection order can be disputed
// and its payout is held.
export const BUYER_PROTECTION_DAYS = 3;
export const BUYER_PROTECTION_MS = BUYER_PROTECTION_DAYS * 24 * 60 * 60 * 1000;

export const canTransition = (
  order: Pick<CompiledOrder, "status" | "paymentMethod" | "deliveredAt">,
  to: CompiledOrderStatus,
  actor: OrderActor,
  now: number = Date.now(),
): boolean => {
  const allowed = TRANSITIONS[order.status]?.[to];
  if (!allowed) return false;
  const isProtected = order.paymentMethod === "billplz";
  const effective = allowed.includes(actor) || (actor === "admin" && allowed.includes("system"));
  if (!effective) return false;

  // Money TCGo holds only moves through the payment callback, refunds and
  // payouts, never because a buyer or seller pressed a button.
  if (isProtected && to === "paid" && actor === "seller") return false;
  if (isProtected && order.status === "confirmed" && to === "shipped") return false;
  if (isProtected && order.status === "paid" && to === "cancelled") return false;
  if (!isProtected && (to === "refunded" || to === "disputed" || to === "completed")) {
    return false;
  }
  if (order.status === "delivered" && to === "disputed") {
    return now < (order.deliveredAt ?? 0) + BUYER_PROTECTION_MS;
  }
  return true;
};

// Shipping for a combined parcel is the largest single-item fee.
export const summariseItems = (items: CompiledOrderItem[], region: "WM" | "EM") => {
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const shippingWM = items.reduce((m, i) => Math.max(m, i.shippingWM ?? 0), 0);
  const shippingEM = items.reduce((m, i) => Math.max(m, i.shippingEM ?? 0), 0);
  const shipping = region === "WM" ? shippingWM : shippingEM;
  return { subtotal, shippingWM, shippingEM, shipping, total: subtotal + shipping };
};

// Ringgit → integer sen. All money that leaves or enters a bank is handled in
// sen so rounding happens exactly once.
export const toSen = (rm: number) => Math.round(rm * 100);

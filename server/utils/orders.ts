import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import {
  BUYER_PROTECTION_MS,
  canTransition,
  summariseItems,
  type CompiledOrder,
  type CompiledOrderItem,
  type CompiledOrderStatus,
  type OrderActor,
} from "~/utils/orders";

// Server-side order service. Every write to compiledOrders, and every
// sold/unsold flip on cards that an order causes, goes through here inside a
// Firestore transaction, so:
//   · prices and shipping come from the card documents, not the browser;
//   · two buyers can't both get a confirmed order for the same card;
//   · status changes follow the table in utils/orders.ts for the caller's role.

const MAX_ITEMS = 50;

type CardDoc = {
  cardName?: string;
  cardSet?: string;
  condition?: string;
  imageUrl?: string;
  imageUrls?: string[];
  price?: number;
  shippingWM?: number;
  shippingEM?: number;
  seller?: string;
  sellerUid?: string;
  sold?: boolean;
};

const orders = (db: Firestore) => db.collection("compiledOrders");
const cards = (db: Firestore) => db.collection("cards");

const itemFromCard = (cardId: string, c: CardDoc): CompiledOrderItem => ({
  cardId,
  cardName: c.cardName || "",
  cardSet: c.cardSet || "",
  condition: c.condition || "",
  imageUrl: c.imageUrls?.[0] || c.imageUrl || "",
  price: Number(c.price) || 0,
  shippingWM: Number(c.shippingWM) || 0,
  shippingEM: Number(c.shippingEM) || 0,
});

const conflict = (message: string) => createError({ statusCode: 409, message });
const forbidden = (message: string) => createError({ statusCode: 403, message });

// Roles the caller holds on an order, most specific first.
const rolesFor = (order: CompiledOrder, uid: string, isAdmin: boolean): OrderActor[] => {
  const roles: OrderActor[] = [];
  if (order.sellerUid === uid) roles.push("seller");
  if (order.buyerUid === uid) roles.push("buyer");
  if (isAdmin) roles.push("admin");
  return roles;
};

export const createOrders = async (
  db: Firestore,
  buyer: { uid: string; email?: string; name?: string },
  input: { cardIds: string[]; region: "WM" | "EM"; buyerName?: string },
): Promise<CompiledOrder[]> => {
  const cardIds = [...new Set(input.cardIds)];
  if (!cardIds.length || cardIds.length > MAX_ITEMS) {
    throw createError({ statusCode: 400, message: `1–${MAX_ITEMS} cards per order` });
  }

  // Read once outside the transaction just to group by seller; each seller's
  // transaction re-reads its cards so the check-and-write is atomic.
  const snaps = await db.getAll(...cardIds.map((id) => cards(db).doc(id)));
  const bySeller = new Map<string, string[]>();
  for (const s of snaps) {
    const c = s.data() as CardDoc | undefined;
    if (!c) throw createError({ statusCode: 404, message: "A card in your cart no longer exists" });
    if (!c.sellerUid) throw conflict(`${c.cardName || "A card"} has no seller`);
    if (c.sellerUid === buyer.uid) throw conflict("You can't buy your own listing");
    bySeller.set(c.sellerUid, [...(bySeller.get(c.sellerUid) ?? []), s.id]);
  }

  const results: CompiledOrder[] = [];
  for (const [sellerUid, ids] of bySeller) {
    const order = await db.runTransaction(async (tx) => {
      const cardSnaps = await tx.getAll(...ids.map((id) => cards(db).doc(id)));
      const openSnap = await tx.get(
        orders(db).where("buyerUid", "==", buyer.uid).where("status", "==", "pending"),
      );
      const newItems: CompiledOrderItem[] = [];
      let sellerName = "";
      for (const s of cardSnaps) {
        const c = s.data() as CardDoc;
        if (c.sold) throw conflict(`${c.cardName || "A card"} has just been sold`);
        if (c.sellerUid !== sellerUid) throw conflict("A listing changed hands, refresh and retry");
        sellerName = c.seller || sellerName;
        newItems.push(itemFromCard(s.id, c));
      }

      // A buyer keeps adding to one open (pending) order per seller until the
      // seller confirms, so the seller sees one combined parcel.
      const open = openSnap.docs
        .map((d) => ({ ...(d.data() as CompiledOrder), id: d.id }))
        .find((o) => o.sellerUid === sellerUid);

      if (open) {
        const have = new Set(open.items.map((i) => i.cardId));
        const merged = [...open.items, ...newItems.filter((i) => !have.has(i.cardId))];
        // Keep the region the order was first placed under.
        const patch = { items: merged, ...summariseItems(merged, open.region) };
        tx.update(orders(db).doc(open.id), patch);
        return { ...open, ...patch };
      }

      const ref = orders(db).doc();
      const created: CompiledOrder = {
        id: ref.id,
        buyerUid: buyer.uid,
        buyerName: (input.buyerName || buyer.name || "Buyer").slice(0, 80),
        buyerEmail: buyer.email || "",
        sellerUid,
        sellerName,
        items: newItems,
        region: input.region,
        ...summariseItems(newItems, input.region),
        status: "pending",
        paymentMethod: "manual",
        createdAt: Date.now(),
      };
      tx.create(ref, created);
      return created;
    });
    results.push(order);
  }
  return results;
};

export interface TransitionExtras {
  trackingNumber?: string;
  carrier?: string;
  reason?: string;
}

// Statuses a buyer/seller/admin can request through the generic endpoint.
// "completed" and "refunded" move money, so they have their own admin routes;
// a Billplz "paid" only comes from the verified callback.
export const USER_TARGETS: CompiledOrderStatus[] = [
  "confirmed",
  "paid",
  "shipped",
  "delivered",
  "disputed",
  "cancelled",
];

export const transitionOrder = async (
  db: Firestore,
  orderId: string,
  to: CompiledOrderStatus,
  caller: { uid: string; isAdmin: boolean },
  extras: TransitionExtras = {},
): Promise<CompiledOrder> =>
  db.runTransaction(async (tx) => {
    const ref = orders(db).doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
    const order = { ...(snap.data() as CompiledOrder), id: snap.id };

    const now = Date.now();
    const actor = rolesFor(order, caller.uid, caller.isAdmin).find((r) =>
      canTransition(order, to, r, now),
    );
    if (!actor) {
      if (!rolesFor(order, caller.uid, caller.isAdmin).length) throw forbidden("Not your order");
      throw conflict(`Can't move this order from ${order.status} to ${to}`);
    }

    const cardRefs: DocumentReference[] = order.items.map((i) => cards(db).doc(i.cardId));
    const patch: Record<string, unknown> = { status: to };

    if (to === "confirmed") {
      // Reserve every card. If another order already took one, refuse rather
      // than sell the same card twice.
      const cardSnaps = cardRefs.length ? await tx.getAll(...cardRefs) : [];
      const taken = cardSnaps.filter((s) => (s.data() as CardDoc | undefined)?.sold);
      if (taken.length) {
        const names = taken.map((s) => (s.data() as CardDoc).cardName).join(", ");
        throw conflict(`Already sold: ${names}. Remove it from the order first.`);
      }
      patch.confirmedAt = now;
      for (const r of cardRefs) tx.update(r, { sold: true, soldAt: now });
    }

    if (to === "paid") patch.paidAt = now;

    if (to === "shipped") {
      patch.shippedAt = now;
      if (extras.trackingNumber) patch.trackingNumber = extras.trackingNumber.slice(0, 64);
      if (extras.carrier) patch.shippingCarrier = extras.carrier.slice(0, 64);
    }

    if (to === "delivered") {
      patch.deliveredAt = now;
      if (order.paymentMethod === "billplz") {
        patch.payoutStatus = "pending";
        patch.payoutEligibleAt = now + BUYER_PROTECTION_MS;
      }
    }

    if (to === "disputed") {
      patch.disputedAt = now;
      patch.disputeReason = (extras.reason || "").slice(0, 1000);
    }

    if (to === "cancelled") {
      patch.cancelledAt = now;
      patch.cancelReason = (extras.reason || "").slice(0, 500);
      // Cards were reserved at confirm; list them again. Pending orders never
      // reserved anything.
      if (order.status === "confirmed" || order.status === "paid") {
        for (const r of cardRefs) tx.update(r, { sold: false, soldAt: null });
      }
    }

    tx.update(ref, patch);
    return { ...order, ...patch } as CompiledOrder;
  });

// Combine un-shipped orders between one buyer and one seller into the oldest.
// All pending → stays pending. Any confirmed → result is confirmed and every
// card is reserved.
export const mergeOrders = async (
  db: Firestore,
  orderIds: string[],
  caller: { uid: string; isAdmin: boolean },
): Promise<string> => {
  const ids = [...new Set(orderIds)];
  if (ids.length < 2 || ids.length > 20) {
    throw createError({ statusCode: 400, message: "Pick 2–20 orders to merge" });
  }
  return db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...ids.map((id) => orders(db).doc(id)));
    const list = snaps
      .filter((s) => s.exists)
      .map((s) => ({ ...(s.data() as CompiledOrder), id: s.id }));
    if (list.length < 2) throw createError({ statusCode: 404, message: "Orders not found" });

    const { sellerUid, buyerUid } = list[0];
    const ok = list.every(
      (o) =>
        o.sellerUid === sellerUid &&
        o.buyerUid === buyerUid &&
        (o.status === "pending" || o.status === "confirmed") &&
        !o.billplzBillId,
    );
    if (!ok) {
      throw conflict("Orders must share a buyer and seller, be unpaid, and not yet shipped.");
    }
    if (!caller.isAdmin && caller.uid !== sellerUid && caller.uid !== buyerUid) {
      throw forbidden("Not your orders");
    }

    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const primary = sorted[0];
    const rest = sorted.slice(1);

    const seen = new Set<string>();
    const items: CompiledOrderItem[] = [];
    const reservedByThese = new Set<string>();
    for (const o of sorted) {
      for (const item of o.items) {
        if (o.status === "confirmed") reservedByThese.add(item.cardId);
        if (seen.has(item.cardId)) continue;
        seen.add(item.cardId);
        items.push(item);
      }
    }

    const becomesConfirmed = list.some((o) => o.status === "confirmed");
    // Folding pending items into a confirmed order reserves them, which is the
    // seller's call, same as confirming.
    if (becomesConfirmed && !caller.isAdmin && caller.uid !== sellerUid) {
      throw forbidden("Only the seller can merge into a confirmed order");
    }
    const now = Date.now();
    const cardRefs = items.map((i) => cards(db).doc(i.cardId));

    if (becomesConfirmed) {
      // A card from one of the pending orders may have been sold to someone
      // else in the meantime.
      const cardSnaps = await tx.getAll(...cardRefs);
      const taken = cardSnaps.filter(
        (s) => (s.data() as CardDoc | undefined)?.sold && !reservedByThese.has(s.id),
      );
      if (taken.length) {
        throw conflict(`Already sold elsewhere: ${taken.map((s) => (s.data() as CardDoc).cardName).join(", ")}`);
      }
    }

    const patch: Record<string, unknown> = {
      items,
      ...summariseItems(items, primary.region),
      status: becomesConfirmed ? "confirmed" : "pending",
      mergedFrom: rest.map((o) => o.id),
      mergedAt: now,
    };
    if (becomesConfirmed && primary.status !== "confirmed") patch.confirmedAt = now;
    tx.update(orders(db).doc(primary.id), patch);

    if (becomesConfirmed) {
      for (const r of cardRefs) tx.update(r, { sold: true, soldAt: now });
    }
    for (const o of rest) {
      tx.update(orders(db).doc(o.id), {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: `Merged into order ${primary.id.slice(0, 8)}`,
        mergedInto: primary.id,
      });
    }
    return primary.id;
  });
};

export const updateRegion = async (
  db: Firestore,
  orderId: string,
  region: "WM" | "EM",
  caller: { uid: string; isAdmin: boolean },
): Promise<CompiledOrder> =>
  db.runTransaction(async (tx) => {
    const ref = orders(db).doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
    const order = { ...(snap.data() as CompiledOrder), id: snap.id };
    if (!rolesFor(order, caller.uid, caller.isAdmin).length) throw forbidden("Not your order");
    if (!(order.status === "pending" || order.status === "confirmed") || order.billplzBillId) {
      throw conflict("Shipping region can't change once payment has started");
    }
    const patch = { region, ...summariseItems(order.items, region) };
    tx.update(ref, patch);
    return { ...order, ...patch };
  });

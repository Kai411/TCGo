// What buyers and sellers get told about, and how it reads.
//
// ONE FEED FOR BOTH ROLES. A user who buys and sells sees a single bell with
// every event in it, each tagged Buying or Selling, rather than two inboxes
// they have to remember to check.
//
// One definition of each event so the bell, the list and whatever writes the
// row can't drift into describing the same thing three ways.
//
// WRITTEN BY THE SERVER, ONLY.
// A notification is a claim that something happened — an order was paid, a
// parcel was combined. Letting a browser write one would let any signed-in
// user tell any seller anything. Firestore rules keep this collection
// read-only to its owner; every row is created by a server route.

export type NotificationKind =
  | "order_placed"
  | "order_created"
  | "order_merged"
  | "order_cancelled"
  | "new_follower";

export type NotificationAudience = "buyer" | "seller";

export const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  buyer: "Buying",
  seller: "Selling",
};

export interface AppNotification {
  id: string;
  /** Who it's for. */
  userUid: string;
  kind: NotificationKind;
  /** Which side of the sale this is about. */
  audience?: NotificationAudience | null;
  title: string;
  body: string;
  /** Where tapping it should go. */
  href?: string | null;
  /** Set when the recipient has seen it. */
  readAt?: number | null;
  createdAt: number;
  /** Loose payload for rendering — order id, buyer name, amount. */
  meta?: Record<string, unknown>;
}

export interface NotificationView {
  readAt?: number | null;
  createdAt?: number;
}

export const isUnread = (n: NotificationView): boolean => n.readAt == null;

/**
 * Read notifications are kept a week, then deleted.
 *
 * Unread ones are never removed on a timer: something nobody has seen is not
 * stale, it is still news.
 */
export const SEEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const isStaleSeen = (n: NotificationView, now = Date.now()): boolean =>
  n.readAt != null && now - n.readAt >= SEEN_RETENTION_MS;

export const unreadCount = (list: NotificationView[]): number =>
  list.reduce((t, n) => t + (isUnread(n) ? 1 : 0), 0);

/**
 * The badge caps at 9+.
 *
 * A precise count past that is noise: nobody triages differently at 23 than
 * at 47, and a three-digit badge wrecks the icon it sits on.
 */
export const badgeLabel = (count: number): string =>
  count <= 0 ? "" : count > 9 ? "9+" : String(count);

/** Newest first, which is the only order a notification list is ever read in. */
export const byNewest = <T extends NotificationView>(list: T[]): T[] =>
  [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

// ── Copy ──────────────────────────────────────────────────────────────
//
// Written as facts, not alerts. "New order — RM 84.00" tells a seller what
// happened and what it's worth; "You have a new notification!" makes them open
// it to find out. Money is in the title because it decides whether this is
// worth interrupting what they're doing.

const money = (n: unknown): string =>
  typeof n === "number" ? `RM ${n.toFixed(2)}` : "";

export interface DraftNotification {
  kind: NotificationKind;
  audience: NotificationAudience;
  title: string;
  body: string;
  href?: string | null;
  meta?: Record<string, unknown>;
}

/** To the buyer, the moment payment clears. */
export const orderPlaced = (input: {
  orderId: string;
  sellerName?: string;
  total?: number;
  itemCount?: number;
}): DraftNotification => ({
  kind: "order_placed",
  audience: "buyer",
  title: input.total != null ? `Order confirmed · ${money(input.total)}` : "Order confirmed",
  body:
    `Payment received for ${input.itemCount ?? 1} card${(input.itemCount ?? 1) === 1 ? "" : "s"}` +
    `${input.sellerName ? ` from ${input.sellerName}` : ""}. ` +
    `We'll let you know when it ships.`,
  href: `/orders/${input.orderId}`,
  meta: { orderId: input.orderId, total: input.total ?? null },
});

/**
 * To the seller.
 *
 * Links to the to-ship queue, not the order: there is no per-order seller page,
 * and the old /seller/orders/:id link was a 404.
 */
export const orderCreated = (input: {
  orderId: string;
  buyerName?: string;
  total?: number;
  itemCount?: number;
}): DraftNotification => ({
  kind: "order_created",
  audience: "seller",
  title: input.total != null ? `New order · ${money(input.total)}` : "New order",
  body:
    `${input.buyerName || "A buyer"} bought ` +
    `${input.itemCount ?? 1} card${(input.itemCount ?? 1) === 1 ? "" : "s"}. ` +
    `Pack it and print the label when you're ready.`,
  href: `/seller/orders?q=toship`,
  meta: { orderId: input.orderId, total: input.total ?? null },
});

export const orderMerged = (input: {
  parentOrderId: string;
  buyerName?: string;
  itemCount?: number;
}): DraftNotification => ({
  kind: "order_merged",
  audience: "seller",
  title: "Order combined",
  body:
    `${input.buyerName || "A buyer"} added to an order you haven't shipped yet, ` +
    `so it's now one parcel. Nothing to do — just more cards in the box.`,
  href: `/seller/orders?q=toship`,
  meta: { orderId: input.parentOrderId },
});

export const orderCancelled = (input: {
  orderId: string;
  buyerName?: string;
  refundAmount?: number;
}): DraftNotification => ({
  kind: "order_cancelled",
  audience: "seller",
  title: "Order cancelled",
  body:
    `${input.buyerName || "The buyer"} cancelled before it shipped. ` +
    `The cards are back on sale` +
    (input.refundAmount != null ? ` and ${money(input.refundAmount)} is being refunded.` : "."),
  href: `/seller/orders`,
  meta: { orderId: input.orderId, refundAmount: input.refundAmount ?? null },
});

export const newFollower = (input: {
  followerUid: string;
  followerName?: string;
}): DraftNotification => ({
  kind: "new_follower",
  audience: "seller",
  title: "New follower",
  body: `${input.followerName || "Someone"} is now following your shop.`,
  href: `/profile/${input.followerUid}`,
  meta: { followerUid: input.followerUid },
});

// Push notifications: what goes to someone's phone or browser, and when.
//
// WEB PUSH, NOT AN APP STORE APP.
// TCGo is a PWA, so pushes use the browser's own Web Push (VAPID): Chrome,
// Edge, Firefox and Samsung Internet on desktop and Android, and Safari on a
// Mac. On iPhone and iPad, Apple only allows web push for a site that has been
// added to the Home Screen (iOS 16.4+), so the settings card says so instead of
// showing a button that can't work.
//
// THE BELL IS THE RECORD, A PUSH IS THE NUDGE.
// Every in-app notification (server/utils/notify.ts) is also pushed, so a push
// never says something the bell doesn't. Chat is the one exception: messages
// have their own inbox and badge, so they push without a bell row.
//
// Everything here is pure so it can be tested without a browser or Firestore.

import type { NotificationKind } from "~/shared/notifications";

/** What a member can switch on and off, independently. */
export type PushCategory = "messages" | "orders" | "auctions";

export const PUSH_CATEGORIES: { key: PushCategory; label: string; hint: string }[] = [
  { key: "messages", label: "Messages", hint: "When someone sends you a chat message" },
  { key: "orders", label: "Orders", hint: "Paid, shipped, delivered and cancelled orders, and new followers" },
  { key: "auctions", label: "Auctions", hint: "When you're outbid, win, or sell at auction" },
];

export type PushPrefs = Record<PushCategory, boolean>;

/** Everything on. Someone who allowed notifications wants to hear about these. */
export const DEFAULT_PUSH_PREFS: PushPrefs = { messages: true, orders: true, auctions: true };

/** Stored prefs to a full set, defaulting anything missing or malformed to on. */
export const normalizePushPrefs = (raw: unknown): PushPrefs => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PUSH_PREFS };
  for (const { key } of PUSH_CATEGORIES) {
    if (typeof r[key] === "boolean") out[key] = r[key] as boolean;
  }
  return out;
};

/** Only the known boolean keys from a request body. */
export const pickPushPrefs = (raw: unknown): Partial<PushPrefs> => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Partial<PushPrefs> = {};
  for (const { key } of PUSH_CATEGORIES) {
    if (typeof r[key] === "boolean") out[key] = r[key] as boolean;
  }
  return out;
};

const KIND_CATEGORY: Record<NotificationKind, PushCategory> = {
  order_placed: "orders",
  order_created: "orders",
  order_merged: "orders",
  order_cancelled: "orders",
  order_shipped: "orders",
  order_delivered: "orders",
  new_follower: "orders",
  auction_outbid: "auctions",
  auction_won: "auctions",
  auction_sold: "auctions",
};

export const categoryForKind = (kind: NotificationKind): PushCategory =>
  KIND_CATEGORY[kind] ?? "orders";

// ── The payload ───────────────────────────────────────────────────────
//
// What the service worker (public/push-sw.js) reads. Kept small: push
// services cap payloads at about 4 KB, and a lock screen shows two lines.

export interface PushPayload {
  title: string;
  body: string;
  /** Path inside the app to open on tap. Always same-origin. */
  url: string;
  /**
   * Notifications with the same tag replace each other, so a burst of chat
   * messages from one person is one notification, not ten.
   */
  tag?: string;
}

export const PUSH_TITLE_MAX = 80;
export const PUSH_BODY_MAX = 180;

const clip = (s: string, n: number): string => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** A same-origin path, or home. A push must never open someone else's site. */
export const safePushUrl = (href: unknown): string => {
  const s = typeof href === "string" ? href.trim() : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export const buildPushPayload = (input: {
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
}): PushPayload => ({
  title: clip(input.title, PUSH_TITLE_MAX) || "TCGo",
  body: clip(input.body, PUSH_BODY_MAX),
  url: safePushUrl(input.href),
  ...(input.tag ? { tag: input.tag } : {}),
});

/** A new chat message, to the person it was sent to. */
export const chatPush = (input: {
  senderUid: string;
  senderName: string;
  preview: string;
  conversationId: string;
}): PushPayload =>
  buildPushPayload({
    title: input.senderName || "New message",
    body: input.preview || "Sent you a message",
    href: `/messages/${input.senderUid}`,
    tag: `chat-${input.conversationId}`,
  });

// ── Subscriptions ─────────────────────────────────────────────────────

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * A browser PushSubscription as JSON, checked.
 *
 * The endpoint must be https: web-push will POST to whatever URL is stored
 * here, so a made-up http or internal address would turn the server into a
 * request relay.
 */
export const parsePushSubscription = (raw: unknown): PushSubscriptionInput | null => {
  const r = (raw && typeof raw === "object" ? raw : {}) as any;
  const endpoint = typeof r.endpoint === "string" ? r.endpoint.trim() : "";
  const p256dh = typeof r.keys?.p256dh === "string" ? r.keys.p256dh : "";
  const auth = typeof r.keys?.auth === "string" ? r.keys.auth : "";
  if (!endpoint || endpoint.length > 1000 || !p256dh || !auth) return null;
  if (p256dh.length > 200 || auth.length > 100) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return null;
  return { endpoint, keys: { p256dh, auth } };
};

// ── Auctions: who has just been outbid ────────────────────────────────

export interface BidLike {
  bidderUid?: string;
  amount?: number;
}

/**
 * Everyone who bid but isn't on top any more, with their best bid.
 *
 * `alreadyTold` maps uid → the best bid of theirs we last sent an outbid
 * notice about. Someone is told once per bid of theirs that gets beaten: bid
 * again and get beaten again, and they hear about it again; refresh the page
 * and they don't.
 */
export const outbidTargets = (
  bids: BidLike[],
  topBidderUid: string | undefined,
  currentPrice: number,
  alreadyTold: Record<string, number> = {},
): { uid: string; myBest: number }[] => {
  if (!topBidderUid) return [];
  const best = new Map<string, number>();
  for (const b of bids) {
    const uid = b?.bidderUid;
    const amount = Number(b?.amount);
    if (!uid || !Number.isFinite(amount)) continue;
    if (amount > (best.get(uid) ?? -Infinity)) best.set(uid, amount);
  }
  const out: { uid: string; myBest: number }[] = [];
  for (const [uid, myBest] of best) {
    if (uid === topBidderUid) continue;
    if (myBest >= currentPrice) continue;
    if (alreadyTold[uid] != null && alreadyTold[uid] >= myBest) continue;
    out.push({ uid, myBest });
  }
  return out;
};

// ── Orders: which status change tells whom ────────────────────────────

export type AnnouncedOrderStatus = "shipped" | "delivered";

export const announcedStatus = (status: unknown): AnnouncedOrderStatus | null =>
  status === "shipped" || status === "delivered" ? status : null;

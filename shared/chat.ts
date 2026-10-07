// Buyer and seller chat: the rules both sides of the wire agree on.
//
// WHAT LIVES WHERE
// ────────────────
//   conversations/{a__b}            one per pair of people, written by the server
//   conversations/{a__b}/messages   the messages, written by the server
//   userStats/{uid}                 reply-time stats, written by the server
//   users/{uid}.lastSeenAt          "last online", written by its owner
//
// Messages go through /api/chat/send rather than straight from the browser,
// because three things about a message have to be true and a browser can't be
// trusted to say so: who sent it and when (reply times are computed from
// that), that an attached order really is between these two people, and that
// a risky message was confirmed before it went.
//
// Dependency-light: imported by the browser, Nitro and the tests.

import { MY_STATES } from "~/shared/my-states";

// ── Limits ────────────────────────────────────────────────────────────

export const CHAT_TEXT_MAX = 2000;
export const CHAT_IMAGES_MAX = 4;
/** Messages shown at first; "Show earlier" adds this many again. */
export const CHAT_PAGE_SIZE = 50;

/**
 * Photos are scaled so the long edge is at most this, then re-encoded as
 * WebP. 1280px keeps a card's attack text and a slab label readable when the
 * photo is opened full screen, at roughly a tenth of a phone camera's file.
 */
export const CHAT_IMAGE_MAX_EDGE = 1280;
export const CHAT_IMAGE_QUALITY = 0.72;
/** Bubble thumbnails are asked for at this width from the image CDN. */
export const CHAT_THUMB_WIDTH = 480;

// ── Spam cap ──────────────────────────────────────────────────────────
//
// A person can send this many messages a minute, across all conversations.
// Far above anyone typing, low enough that a script can't flood inboxes.
// Counted in userStats alongside reply times, in the same transaction.

export const SEND_LIMIT_PER_MINUTE = 30;
const SEND_WINDOW_MS = 60 * 1000;

export interface SendWindow {
  sendWindowStart?: number;
  sendCount?: number;
}

export const nextSendWindow = (
  w: SendWindow | undefined,
  now: number,
): { allowed: boolean; sendWindowStart: number; sendCount: number } => {
  const start = w?.sendWindowStart ?? 0;
  if (now - start >= SEND_WINDOW_MS) return { allowed: true, sendWindowStart: now, sendCount: 1 };
  const count = (w?.sendCount ?? 0) + 1;
  return { allowed: count <= SEND_LIMIT_PER_MINUTE, sendWindowStart: start, sendCount: Math.min(count, SEND_LIMIT_PER_MINUTE + 1) };
};

// ── Conversation ids ──────────────────────────────────────────────────

/**
 * One conversation per pair, whoever starts it. Sorting makes the id the same
 * from either side, so "Message seller" and "Message buyer" land in the same
 * thread rather than opening two.
 */
export const conversationIdFor = (a: string, b: string): string =>
  [a, b].sort().join("__");

export const otherParticipant = (participants: string[], me: string): string =>
  participants.find((p) => p !== me) ?? "";

// ── Risky messages ────────────────────────────────────────────────────
//
// Checked in the browser before sending (the sender confirms or edits), and
// again on the server, which refuses a risky message nobody confirmed. A
// message sent anyway carries its risk codes, so the recipient sees the same
// caution.
//
// The aim is to catch the common ways people get scammed or doxxed on a
// marketplace, not to censor: nothing is blocked, the sender is asked once.
// So the patterns lean towards catching rather than missing, but stay clear
// of what card chat is full of: prices, card numbers like 025/165, set codes
// and grades.

export type ChatRiskCode =
  | "phone"
  | "email"
  | "ic_number"
  | "bank_account"
  | "address"
  | "outside_contact"
  | "outside_payment"
  | "link"
  | "credentials";

export interface ChatRisk {
  code: ChatRiskCode;
  /** What was found, for the sender. */
  label: string;
  /** Why it matters, in one sentence. */
  why: string;
}

export const CHAT_RISKS: Record<ChatRiskCode, Omit<ChatRisk, "code">> = {
  phone: {
    label: "A phone number",
    why: "Scammers use phone numbers to move a deal off TCGo, where Buyer Protection can't help.",
  },
  email: {
    label: "An email address",
    why: "Sharing contact details makes it easy to be targeted outside TCGo.",
  },
  ic_number: {
    label: "What looks like an IC number",
    why: "An IC number can be used for identity fraud. TCGo never needs you to share it in chat.",
  },
  bank_account: {
    label: "What looks like a bank account number",
    why: "Paying into a bank account directly skips Buyer Protection, and your money can't be held or refunded.",
  },
  address: {
    label: "What looks like an address",
    why: "TCGo passes the delivery address to the courier for you. There's no need to share it here.",
  },
  outside_contact: {
    label: "A move to another app",
    why: "Deals arranged on WhatsApp, Telegram or social media aren't covered by Buyer Protection.",
  },
  outside_payment: {
    label: "Paying outside TCGo",
    why: "Bank transfers, e-wallets and cash deals skip Buyer Protection. If something goes wrong, TCGo can't get your money back.",
  },
  link: {
    label: "A link to another website",
    why: "Links are a common way to steal passwords. Only open links from people you trust.",
  },
  credentials: {
    label: "A code or password",
    why: "Nobody at TCGo, and no genuine buyer or seller, will ever ask for an OTP, TAC or password.",
  },
};

/** Runs of digits, allowing the single spaces, dashes and dots people type. */
const DIGIT_RUN = /\+?\d(?:[\s.-]?\d){7,}/g;

const digitsOf = (s: string): string => s.replace(/\D/g, "");

/** A Malaysian mobile or landline, with or without the 60 country code. */
const isPhoneDigits = (d: string): boolean =>
  /^(?:60|0)1\d{8,9}$/.test(d) || /^(?:60|0)[3-9]\d{7,8}$/.test(d);

/** YYMMDD-PB-###G: twelve digits whose first six are a real date. */
const isIcDigits = (d: string): boolean => {
  if (d.length !== 12) return false;
  const month = Number(d.slice(2, 4));
  const day = Number(d.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
};

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const OUTSIDE_CONTACT =
  /\b(?:whats\s?app|wasap|wassap|watsap|wsap|wa\.me|telegram|t\.me|wechat|line\s?id|instagram|insta|facebook|fb\.com|messenger|signal\s?app|call\s+me|text\s+me|sms\s+me|pm\s+me\s+(?:on|at|di))\b/i;

const OUTSIDE_PAYMENT =
  /\b(?:bank[\s-]?in|bank\s+transfer|online\s+transfer|transfer\s+(?:to|ke|direct)|ibg|duit\s?now|touch\s?(?:n|and|'n)\s?go|tng|tngo|grab\s?pay|shopee\s?pay|boost\s+(?:e-?wallet|pay)|paypal|usdt|crypto|bitcoin|cash\s+on\s+delivery|cod|cash\s+(?:deal|only|payment)|pay\s+(?:me\s+)?(?:direct(?:ly)?|outside|cash)|deal\s+outside|outside\s+(?:tcgo|the\s+app|platform)|direct\s+deal|meet\s?up|jumpa)\b/i;

const LINK =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|my|net|org|io|ly|gg|link|xyz|app|site|shop|top|info|cc)\b(?:\/\S*)?/gi;

const CREDENTIALS =
  /\b(?:otp|tac(?:\s+(?:code|number|no))?|password|passcode|pin\s+number|verification\s+code|security\s+code|kata\s+laluan)\b/i;

const STREET =
  /\b(?:jalan|jln|lorong|lrg|taman|tmn|persiaran|lebuh|lebuhraya|kampung|kg|blok|block|apartment|apt|kondo|condo|pangsapuri)\.?\s+[a-z0-9]/i;

const STATE_NAMES = MY_STATES.map((s) => s.name.toLowerCase());

/** A five-digit postcode with a state name near it reads as an address. */
const hasPostcodeAndState = (text: string): boolean => {
  if (!/\b\d{5}\b/.test(text)) return false;
  const lower = text.toLowerCase();
  return STATE_NAMES.some((s) => lower.includes(s));
};

/** Our own links are fine to share. */
const isOwnLink = (url: string): boolean => /(^|[./])tcgo\b/i.test(url);

/**
 * Everything risky about a message, each code at most once, in the order the
 * sender should read them.
 */
export const detectChatRisks = (text: string): ChatRisk[] => {
  const found = new Set<ChatRiskCode>();
  const t = (text || "").slice(0, CHAT_TEXT_MAX * 2);

  for (const m of t.match(DIGIT_RUN) ?? []) {
    const d = digitsOf(m);
    // A leading + is an international number whatever follows.
    if (m.startsWith("+") || isPhoneDigits(d)) found.add("phone");
    else if (isIcDigits(d)) found.add("ic_number");
    else if (d.length >= 10 && d.length <= 17) found.add("bank_account");
  }
  if (EMAIL.test(t)) found.add("email");
  if (STREET.test(t) || hasPostcodeAndState(t)) found.add("address");
  if (OUTSIDE_CONTACT.test(t)) found.add("outside_contact");
  if (OUTSIDE_PAYMENT.test(t)) found.add("outside_payment");
  // An email's domain is not a separate link.
  const withoutEmails = t.replace(new RegExp(EMAIL.source, "gi"), " ");
  if ((withoutEmails.match(LINK) ?? []).some((u) => !isOwnLink(u))) found.add("link");
  if (CREDENTIALS.test(t)) found.add("credentials");

  return (Object.keys(CHAT_RISKS) as ChatRiskCode[])
    .filter((code) => found.has(code))
    .map((code) => ({ code, ...CHAT_RISKS[code] }));
};

export const isChatRiskCode = (c: unknown): c is ChatRiskCode =>
  typeof c === "string" && c in CHAT_RISKS;

// ── Attachments ───────────────────────────────────────────────────────
//
// A snapshot taken by the server when the message is sent, so the bubble
// still makes sense after the order moves on or the listing sells. The bubble
// links to the live page for the current state.

export interface ChatOrderAttachment {
  type: "order";
  orderId: string;
  itemCount: number;
  firstItemName: string;
  imageUrl: string;
  total: number;
  status: string;
}

export interface ChatProductAttachment {
  type: "product";
  kind: "listing" | "auction";
  productId: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  /** Asking price, or the current bid for an auction. */
  price: number;
  sellerUid: string;
}

export type ChatAttachment = ChatOrderAttachment | ChatProductAttachment;

/** What the browser asks to attach. The server looks the rest up. */
export type ChatAttachmentRef =
  | { type: "order"; id: string }
  | { type: "product"; kind: "listing" | "auction"; id: string };

export const attachmentHref = (a: ChatAttachment): string =>
  a.type === "order"
    ? `/orders/${a.orderId}`
    : a.kind === "auction"
      ? `/auctions/${a.productId}`
      : `/cards/${a.productId}`;

// ── Documents ─────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  images: string[];
  attachment?: ChatAttachment | null;
  /** Risks the sender was warned about and sent anyway. */
  risks?: ChatRiskCode[];
  at: number;
}

export interface ChatPerson {
  name: string;
  photoURL: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  people: Record<string, ChatPerson>;
  lastMessage: { preview: string; senderUid: string; at: number } | null;
  updatedAt: number;
  /** When each participant last opened it. */
  lastReadAt: Record<string, number>;
  /** Whose turn it is to reply, and since when. See applyReplyTiming. */
  awaitingReplyFrom?: string | null;
  awaitingSince?: number | null;
}

export const isUnreadFor = (c: Pick<Conversation, "lastMessage" | "lastReadAt">, uid: string): boolean =>
  !!c.lastMessage &&
  c.lastMessage.senderUid !== uid &&
  c.lastMessage.at > (c.lastReadAt?.[uid] ?? 0);

/** One line for the inbox. */
export const messagePreview = (m: {
  text?: string;
  images?: string[];
  attachment?: ChatAttachment | null;
}): string => {
  const text = (m.text || "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 120);
  if (m.attachment?.type === "order") return "Shared an order";
  if (m.attachment?.type === "product") return `Shared ${m.attachment.name}`;
  const n = m.images?.length ?? 0;
  if (n) return n === 1 ? "Sent a photo" : `Sent ${n} photos`;
  return "";
};

// ── Reply times ───────────────────────────────────────────────────────
//
// HOW A REPLY TIME IS MEASURED
// When someone's message is waiting for an answer, the clock starts at the
// first unanswered message (a burst of three messages counts once, from the
// first). It stops when the other person sends anything. Their reply time is
// that gap. Then the clock starts for the first person, and so on.
//
// A single reply is capped at three days, so one forgotten conversation from
// last year doesn't define someone for ever. The average shown is over the
// most recent replies only, so it reflects how someone answers now.

export const REPLY_CAP_MS = 3 * 24 * 60 * 60 * 1000;
export const REPLY_SAMPLE_SIZE = 20;
/** Below this many replies, an average says more about luck than habit. */
export const REPLY_MIN_SAMPLES = 3;

export interface ReplyClock {
  awaitingReplyFrom?: string | null;
  awaitingSince?: number | null;
}

export const applyReplyTiming = (
  clock: ReplyClock,
  senderUid: string,
  recipientUid: string,
  now: number,
): { replyMs: number | null; next: Required<ReplyClock> } => {
  if (clock.awaitingReplyFrom === senderUid && clock.awaitingSince != null) {
    return {
      replyMs: Math.min(Math.max(0, now - clock.awaitingSince), REPLY_CAP_MS),
      next: { awaitingReplyFrom: recipientUid, awaitingSince: now },
    };
  }
  if (clock.awaitingReplyFrom === recipientUid && clock.awaitingSince != null) {
    // Another message in the same burst: the clock keeps its first start.
    return {
      replyMs: null,
      next: { awaitingReplyFrom: recipientUid, awaitingSince: clock.awaitingSince },
    };
  }
  return { replyMs: null, next: { awaitingReplyFrom: recipientUid, awaitingSince: now } };
};

export interface ReplyStats {
  recentReplyMs: number[];
  avgReplyMs: number | null;
  replyCount: number;
}

export const addReplySample = (stats: Partial<ReplyStats> | undefined, replyMs: number): ReplyStats => {
  const recent = [...(stats?.recentReplyMs ?? []), replyMs].slice(-REPLY_SAMPLE_SIZE);
  return {
    recentReplyMs: recent,
    avgReplyMs: Math.round(recent.reduce((t, n) => t + n, 0) / recent.length),
    replyCount: (stats?.replyCount ?? 0) + 1,
  };
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "about 25 min", "about 3 hr". Rounded the way a person would say it. */
export const formatDuration = (ms: number): string => {
  if (ms < MIN) return "under a minute";
  if (ms < HOUR) return `about ${Math.round(ms / MIN)} min`;
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `about ${h} hr`;
  }
  const d = Math.round(ms / DAY);
  return `about ${d} day${d === 1 ? "" : "s"}`;
};

export const replyTimeLabel = (stats: Partial<ReplyStats> | null | undefined): string => {
  if (!stats || (stats.recentReplyMs?.length ?? 0) < REPLY_MIN_SAMPLES || stats.avgReplyMs == null) {
    return "Not enough replies yet";
  }
  return `Replies in ${formatDuration(stats.avgReplyMs)} on average`;
};

// ── Last online ───────────────────────────────────────────────────────

/** How often an open tab writes lastSeenAt. */
export const PRESENCE_HEARTBEAT_MS = 5 * MIN;
/** Seen within this long counts as online now: a heartbeat plus slack. */
export const ONLINE_WINDOW_MS = PRESENCE_HEARTBEAT_MS + 2 * MIN;

export const isOnlineNow = (lastSeenAt: number | null | undefined, now = Date.now()): boolean =>
  !!lastSeenAt && now - lastSeenAt < ONLINE_WINDOW_MS;

export const lastSeenLabel = (lastSeenAt: number | null | undefined, now = Date.now()): string => {
  if (!lastSeenAt) return "Not seen recently";
  const gap = Math.max(0, now - lastSeenAt);
  if (gap < ONLINE_WINDOW_MS) return "Online now";
  if (gap < HOUR) return `Active ${Math.round(gap / MIN)} min ago`;
  if (gap < DAY) return `Active ${Math.round(gap / HOUR)} hr ago`;
  const d = Math.floor(gap / DAY);
  if (d === 1) return "Active yesterday";
  if (d < 30) return `Active ${d} days ago`;
  return "Active over a month ago";
};

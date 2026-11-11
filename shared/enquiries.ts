// "Drop us an enquiry": a member's question to TCGo, and the staff reply.
//
// SERVER-ONLY STORAGE.
// Enquiries live in the `enquiries` collection, which only the server routes
// touch (server/api/enquiries, server/api/mc/enquiries). Firestore's
// deny-everything rule already covers it, so there is no rules block and no
// index: a member's list is one equality query, staff's one `in` query, and
// both are sorted in memory.
//
// A CONVERSATION, NOT A TICKET SYSTEM.
// One enquiry is a short thread: the member writes, staff reply, the member
// can answer back while it's open, and staff close it when it's done.
//   open      waiting on TCGo
//   answered  TCGo replied, waiting on the member (or nothing)
//   closed    done; a new question is a new enquiry
//
// Shared by the Help Center pages, the routes and the tests. Dependency-free
// for Nitro.

export const ENQUIRY_TOPICS = [
  { code: "order", label: "An order" },
  { code: "buying", label: "Buying" },
  { code: "selling", label: "Selling and payouts" },
  { code: "auction", label: "Auctions" },
  { code: "account", label: "My account" },
  { code: "other", label: "Something else" },
] as const;

export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number]["code"];
export type EnquiryStatus = "open" | "answered" | "closed";

export interface EnquiryMessage {
  by: "member" | "tcgo";
  text: string;
  at: number;
}

export interface Enquiry {
  id: string;
  userUid: string;
  topic: EnquiryTopic;
  /** What the member typed as an order number, if anything. Not checked. */
  orderRef: string | null;
  status: EnquiryStatus;
  messages: EnquiryMessage[];
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

export const ENQUIRY_MESSAGE_MIN = 10;
export const ENQUIRY_MESSAGE_MAX = 2000;
export const ENQUIRY_ORDER_REF_MAX = 40;
/** Messages kept on one enquiry. Past this, start a new one. */
export const ENQUIRY_MESSAGES_MAX = 30;
/** Open enquiries one member can have at once, so a stuck button can't flood staff. */
export const ENQUIRY_OPEN_MAX = 3;

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  open: "Waiting for reply",
  answered: "Replied",
  closed: "Closed",
};

export const enquiryTopicLabel = (code: string): string =>
  ENQUIRY_TOPICS.find((t) => t.code === code)?.label ?? "Something else";

export const isEnquiryTopic = (code: unknown): code is EnquiryTopic =>
  ENQUIRY_TOPICS.some((t) => t.code === code);

/** Trimmed message, or an error line for the member. */
export const checkEnquiryMessage = (raw: unknown): { text: string } | { error: string } => {
  const text = String(raw ?? "").trim();
  if (text.length < ENQUIRY_MESSAGE_MIN) return { error: "Tell us a little more, at least a sentence." };
  if (text.length > ENQUIRY_MESSAGE_MAX) {
    return { error: `Keep it under ${ENQUIRY_MESSAGE_MAX.toLocaleString("en-MY")} characters.` };
  }
  return { text };
};

/** Order number as typed, minus a leading # and spaces; null when blank. */
export const normaliseOrderRef = (raw: unknown): string | null => {
  const s = String(raw ?? "").trim().replace(/^#\s*/, "").slice(0, ENQUIRY_ORDER_REF_MAX);
  return s || null;
};

/** Validate a new enquiry from the form. */
export const validateEnquiry = (
  body: { topic?: unknown; message?: unknown; orderRef?: unknown } | null | undefined,
): { topic: EnquiryTopic; text: string; orderRef: string | null } | { error: string } => {
  if (!isEnquiryTopic(body?.topic)) return { error: "Pick what it's about." };
  const msg = checkEnquiryMessage(body?.message);
  if ("error" in msg) return msg;
  return { topic: body!.topic as EnquiryTopic, text: msg.text, orderRef: normaliseOrderRef(body?.orderRef) };
};

/** Who can add a message, and the status that follows. */
export const canAddMessage = (
  e: Pick<Enquiry, "status" | "messages">,
): { ok: true } | { ok: false; reason: string } => {
  if (e.status === "closed") return { ok: false, reason: "This enquiry is closed. Send a new one instead." };
  if ((e.messages?.length ?? 0) >= ENQUIRY_MESSAGES_MAX) {
    return { ok: false, reason: "This enquiry is full. Send a new one instead." };
  }
  return { ok: true };
};

export const statusAfterMessage = (by: EnquiryMessage["by"]): EnquiryStatus =>
  by === "tcgo" ? "answered" : "open";

/** Newest activity first; open ones above the rest for staff. */
export const sortEnquiries = <T extends Pick<Enquiry, "status" | "updatedAt">>(
  list: T[],
  openFirst = false,
): T[] =>
  [...list].sort((a, b) => {
    if (openFirst && (a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

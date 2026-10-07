// Send a chat message to another member.
//
// Written here rather than from the browser so the parts that matter can't be
// made up: the sender and the time (reply times are built from them), what an
// attached order or listing actually is, and that a risky message was
// confirmed before it went. See shared/chat.ts for the data model.

import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import {
  CHAT_IMAGES_MAX,
  CHAT_TEXT_MAX,
  addReplySample,
  applyReplyTiming,
  conversationIdFor,
  detectChatRisks,
  messagePreview,
  nextSendWindow,
  type ChatAttachment,
  type ChatAttachmentRef,
  type ChatPerson,
} from "~/shared/chat";

interface Body {
  toUid?: string;
  text?: string;
  images?: string[];
  attachment?: ChatAttachmentRef | null;
  /** The sender saw the risk warning and chose to send anyway. */
  confirmRisk?: boolean;
}

const personOf = (data: any): ChatPerson => ({
  name: String(data?.customName || data?.displayName || "TCGo member").slice(0, 80),
  photoURL: String(data?.photoURL || ""),
});

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as Body;
  const toUid = String(body?.toUid || "");
  const text = String(body?.text || "").trim();
  const images = Array.isArray(body?.images) ? body.images.map(String) : [];

  if (!toUid || toUid === caller.uid) {
    throw createError({ statusCode: 400, message: "Choose someone else to message" });
  }
  if (text.length > CHAT_TEXT_MAX) {
    throw createError({ statusCode: 400, message: `Keep messages under ${CHAT_TEXT_MAX} characters` });
  }
  if (images.length > CHAT_IMAGES_MAX) {
    throw createError({ statusCode: 400, message: `Up to ${CHAT_IMAGES_MAX} photos per message` });
  }
  // Only photos our own uploader produced. Anything else is a link that would
  // render as an image in someone else's chat.
  const cloud = String(useRuntimeConfig().public.cloudinaryCloudName || "");
  const imagePrefix = `https://res.cloudinary.com/${cloud}`;
  if (images.some((u) => !u.startsWith(imagePrefix) || !u.includes("/image/upload/"))) {
    throw createError({ statusCode: 400, message: "That photo couldn't be attached" });
  }
  if (!text && !images.length && !body?.attachment) {
    throw createError({ statusCode: 400, message: "Write a message first" });
  }

  const risks = detectChatRisks(text);
  if (risks.length && !body?.confirmRisk) {
    throw createError({
      statusCode: 409,
      message: "This message needs confirming before it's sent",
      data: { risks },
    });
  }

  const db = getAdminFirestore();
  // One round of reads, in parallel: every extra await here is time the
  // sender spends watching "Sending…".
  const [meSnap, themSnap, attachment] = await Promise.all([
    db.collection("users").doc(caller.uid).get(),
    db.collection("users").doc(toUid).get(),
    resolveAttachment(db, body?.attachment ?? null, caller.uid, toUid),
  ]);
  if (!themSnap.exists) throw createError({ statusCode: 404, message: "That member doesn't exist" });

  const convId = conversationIdFor(caller.uid, toUid);
  const convRef = db.collection("conversations").doc(convId);
  const msgRef = convRef.collection("messages").doc();
  const statsRef = db.collection("userStats").doc(caller.uid);

  const message = {
    senderUid: caller.uid,
    text,
    images,
    attachment,
    risks: risks.map((r) => r.code),
    at: 0,
  };

  await db.runTransaction(async (tx) => {
    const [convSnap, statsSnap] = await Promise.all([tx.get(convRef), tx.get(statsRef)]);
    const conv = convSnap.data() ?? {};
    const now = Date.now();
    message.at = now;

    const window = nextSendWindow(statsSnap.data(), now);
    if (!window.allowed) {
      throw createError({ statusCode: 429, message: "You're sending messages very fast. Wait a minute and try again." });
    }

    const { replyMs, next } = applyReplyTiming(conv, caller.uid, toUid, now);

    tx.set(msgRef, message);
    tx.set(
      convRef,
      {
        participants: [caller.uid, toUid].sort(),
        people: {
          [caller.uid]: personOf(meSnap.data()),
          [toUid]: personOf(themSnap.data()),
        },
        lastMessage: { preview: messagePreview(message), senderUid: caller.uid, at: now },
        updatedAt: now,
        // Sending is reading: you've seen everything up to your own message.
        lastReadAt: { ...(conv.lastReadAt ?? {}), [caller.uid]: now },
        awaitingReplyFrom: next.awaitingReplyFrom,
        awaitingSince: next.awaitingSince,
        createdAt: conv.createdAt ?? now,
      },
      { merge: false },
    );
    tx.set(
      statsRef,
      {
        ...(replyMs != null ? addReplySample(statsSnap.data(), replyMs) : {}),
        sendWindowStart: window.sendWindowStart,
        sendCount: window.sendCount,
        updatedAt: now,
      },
      { merge: true },
    );
    // Sending a message means you're online, whether or not the heartbeat
    // ran. In the same commit rather than a second round trip.
    if (meSnap.exists) tx.update(meSnap.ref, { lastSeenAt: now });
  });

  return { ok: true, conversationId: convId, messageId: msgRef.id, at: message.at };
});

/**
 * Look the attachment up and keep a snapshot of it.
 *
 * An order may only be shared between its own buyer and seller, so a chat
 * can't be used to show someone else's purchase. A product may be either
 * person's listing or auction.
 */
const resolveAttachment = async (
  db: Firestore,
  ref: ChatAttachmentRef | null,
  me: string,
  them: string,
): Promise<ChatAttachment | null> => {
  if (!ref) return null;
  const id = String(ref.id || "");
  if (!id) throw createError({ statusCode: 400, message: "Attachment missing" });

  if (ref.type === "order") {
    const snap = await db.collection("compiledOrders").doc(id).get();
    const o = snap.data();
    const pair = [o?.buyerUid, o?.sellerUid].sort().join("__");
    if (!o || pair !== conversationIdFor(me, them)) {
      throw createError({ statusCode: 403, message: "You can only share orders between the two of you" });
    }
    const items = Array.isArray(o.items) ? o.items : [];
    return {
      type: "order",
      orderId: id,
      itemCount: items.length,
      firstItemName: String(items[0]?.cardName || "Order"),
      imageUrl: String(items[0]?.imageUrl || ""),
      total: Number(o.total) || 0,
      status: String(o.status || ""),
    };
  }

  if (ref.type === "product") {
    const auction = ref.kind === "auction";
    const snap = await db.collection(auction ? "auctions" : "cards").doc(id).get();
    const p = snap.data();
    if (!p || p.deletedAt || ![me, them].includes(p.sellerUid)) {
      throw createError({ statusCode: 403, message: "You can only share your own or their listings" });
    }
    if (auction && p.isPrivate && p.sellerUid !== me) {
      throw createError({ statusCode: 403, message: "That auction is private" });
    }
    return {
      type: "product",
      kind: auction ? "auction" : "listing",
      productId: id,
      name: String(p.cardName || p.title || "Card"),
      subtitle: [p.cardSet, p.condition].filter(Boolean).join(" · "),
      imageUrl: String(p.imageUrls?.[0] || p.imageUrl || ""),
      price: Number(auction ? p.currentPrice ?? p.startingPrice : p.price) || 0,
      sellerUid: String(p.sellerUid),
    };
  }

  throw createError({ statusCode: 400, message: "Unknown attachment" });
};

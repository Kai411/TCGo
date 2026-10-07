// Buyer and seller chat, in the browser.
//
// Reads come straight from Firestore (the rules let only the two people in a
// conversation see it). Sending goes through /api/chat/send, which is the only
// writer of messages. See shared/chat.ts for why.
//
// The inbox is module-level state, like useNotifications: one listener for
// the whole app, so the navbar badge and the inbox page agree.

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { computed, ref } from "vue";
import {
  CHAT_IMAGE_MAX_EDGE,
  CHAT_IMAGE_QUALITY,
  isUnreadFor,
  type ChatAttachmentRef,
  type ChatRisk,
  type Conversation,
} from "~/shared/chat";
import { isListable } from "~/shared/listing-lifecycle";

const INBOX_LIMIT = 50;

const conversations = ref<Conversation[]>([]);
const inboxLoading = ref(true);
const inboxError = ref("");
let unsubInbox: Unsubscribe | null = null;
let inboxFor: string | null = null;

/** Thrown by send() when the server wants the risk warning confirmed. */
export class RiskConfirmationNeeded extends Error {
  constructor(public risks: ChatRisk[]) {
    super("Confirm before sending");
  }
}

/**
 * Scale a photo down and re-encode it as WebP.
 *
 * Always re-encoded, even when it's already small, because re-encoding also
 * drops the camera's EXIF block, and that can hold the GPS position the photo
 * was taken at.
 */
export const shrinkChatImage = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, CHAT_IMAGE_MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Couldn't read that photo"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that photo"))),
        "image/webp",
        CHAT_IMAGE_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a photo we can read"));
    };
    img.src = url;
  });

export const useChat = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { authedFetch } = useAuthedFetch();
  const config = useRuntimeConfig();

  /** Start (or move) the inbox listener to whoever is signed in. */
  const listenInbox = () => {
    const uid = user.value?.uid;
    if (!uid) {
      unsubInbox?.();
      unsubInbox = null;
      inboxFor = null;
      conversations.value = [];
      inboxLoading.value = false;
      return;
    }
    if (inboxFor === uid && unsubInbox) return;
    unsubInbox?.();
    inboxFor = uid;
    inboxLoading.value = true;
    subscribeInbox(uid, true);
  };

  /**
   * The sorted query needs a composite index. Until it exists (or while it
   * builds) Firestore refuses it with failed-precondition, so fall back to
   * the unsorted query, which needs no index, and sort here instead.
   */
  const subscribeInbox = (uid: string, sorted: boolean) => {
    const base = collection(firestore!, "conversations");
    const q = sorted
      ? query(base, where("participants", "array-contains", uid), orderBy("updatedAt", "desc"), limit(INBOX_LIMIT))
      : query(base, where("participants", "array-contains", uid), limit(INBOX_LIMIT * 4));
    unsubInbox = onSnapshot(
      q,
      (snap) => {
        conversations.value = snap.docs
          .map((d) => ({ ...(d.data() as Omit<Conversation, "id">), id: d.id }))
          .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          .slice(0, INBOX_LIMIT);
        inboxLoading.value = false;
        inboxError.value = "";
      },
      (e: any) => {
        console.error("[chat] inbox listener failed", e);
        if (sorted && e?.code === "failed-precondition" && inboxFor === uid) {
          subscribeInbox(uid, false);
          return;
        }
        inboxError.value =
          e?.code === "permission-denied"
            ? "Couldn't load your messages: the chat rules aren't published yet."
            : "Couldn't load your messages.";
        inboxLoading.value = false;
      },
    );
  };

  const unreadConversations = computed(() =>
    user.value ? conversations.value.filter((c) => isUnreadFor(c, user.value!.uid)).length : 0,
  );

  const markRead = async (conv: Conversation | undefined) => {
    const uid = user.value?.uid;
    if (!uid || !conv || !isUnreadFor(conv, uid)) return;
    // Never behind the message itself, so a slow device clock can't leave a
    // conversation stuck unread.
    const at = Math.max(Date.now(), conv.lastMessage?.at ?? 0);
    try {
      await updateDoc(doc(firestore!, "conversations", conv.id), { [`lastReadAt.${uid}`]: at });
    } catch (e) {
      console.warn("[chat] couldn't mark read", e);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const blob = await shrinkChatImage(file);
    const form = new FormData();
    form.append("file", new File([blob], "chat.webp", { type: "image/webp" }));
    form.append("upload_preset", config.public.cloudinaryUploadPreset as string);
    form.append("folder", "tcgo-chat");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.public.cloudinaryCloudName}/image/upload`,
      { method: "POST", body: form },
    );
    if (!res.ok) throw new Error("Couldn't upload that photo");
    return (await res.json()).secure_url as string;
  };

  const send = async (input: {
    toUid: string;
    text: string;
    images?: string[];
    attachment?: ChatAttachmentRef | null;
    confirmRisk?: boolean;
  }) => {
    try {
      return await authedFetch<{ ok: true; conversationId: string }>("/api/chat/send", {
        method: "POST",
        body: input,
      });
    } catch (e: any) {
      const risks = e?.data?.data?.risks;
      if (e?.statusCode === 409 && Array.isArray(risks)) throw new RiskConfirmationNeeded(risks);
      throw new Error(e?.data?.message || e?.message || "Couldn't send that message");
    }
  };

  /** Orders between the two of you, newest first. */
  const ordersBetween = async (otherUid: string) => {
    const uid = user.value?.uid;
    if (!uid) return [];
    const col = collection(firestore!, "compiledOrders");
    const [asBuyer, asSeller] = await Promise.all([
      getDocs(query(col, where("buyerUid", "==", uid), where("sellerUid", "==", otherUid), limit(30))),
      getDocs(query(col, where("sellerUid", "==", uid), where("buyerUid", "==", otherUid), limit(30))),
    ]);
    return [...asBuyer.docs, ...asSeller.docs]
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((o) => !o.mergedInto)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  };

  /** Live listings and running auctions belonging to either of you. */
  const productsOf = async (uids: string[]) => {
    const now = Date.now();
    const lists = await Promise.all(
      uids.flatMap((uid) => [
        getDocs(query(collection(firestore!, "cards"), where("sellerUid", "==", uid), limit(60))).then((s) =>
          s.docs
            .map((d) => ({ id: d.id, kind: "listing" as const, ...(d.data() as any) }))
            .filter((c) => !c.sold && (c.status ?? "active") === "active" && isListable(c, now)),
        ),
        getDocs(query(collection(firestore!, "auctions"), where("sellerUid", "==", uid), limit(30))).then((s) =>
          s.docs
            .map((d) => ({ id: d.id, kind: "auction" as const, ...(d.data() as any) }))
            .filter(
              (a) =>
                (a.status ?? "active") === "active" &&
                (a.endsAt ?? 0) > now &&
                !a.deletedAt &&
                (!a.isPrivate || a.sellerUid === user.value?.uid),
            ),
        ),
      ]),
    );
    return lists.flat().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  };

  return {
    conversations,
    inboxLoading,
    inboxError,
    unreadConversations,
    listenInbox,
    markRead,
    uploadImage,
    send,
    ordersBetween,
    productsOf,
  };
};

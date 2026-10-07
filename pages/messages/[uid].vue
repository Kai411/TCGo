<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user && !authLoading" class="text-center py-12">
      <p class="text-ink-muted dark:text-zinc-400 mb-4">Sign in to send messages.</p>
      <button type="button" @click="goToLogin" class="px-5 py-2.5 rounded-full text-sm font-semibold bg-pokemon-red text-white">
        Sign in
      </button>
    </div>

    <div v-else-if="user && otherUid === user.uid" class="surface rounded-2xl py-16 text-center text-sm text-ink-muted dark:text-zinc-400">
      This is you. Pick someone else to message.
    </div>

    <div v-else-if="user" class="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-4 items-start">
      <!-- Inbox beside the conversation on desktop; its own page on mobile. -->
      <div class="hidden lg:block surface rounded-2xl overflow-hidden chat-pane overflow-y-auto">
        <ChatInboxList :active-uid="otherUid" />
      </div>

      <!-- On a phone the open conversation takes the whole screen, like a
           messaging app: moved to <body> (out of the page's transformed
           enter-animation wrapper) and sized to the visual viewport so the
           composer rides on top of the keyboard. -->
      <Teleport to="body" :disabled="!isPhone">
      <section
        class="flex flex-col min-w-0"
        :class="isPhone ? 'chat-screen bg-canvas dark:bg-canvas-inverse' : 'surface rounded-2xl chat-pane'"
        :style="isPhone && viewport.h ? { height: `${viewport.h}px`, transform: `translateY(${viewport.top}px)` } : undefined"
      >
        <!-- Header: who, and how responsive they are -->
        <header class="chat-header flex items-center gap-2 lg:gap-3 px-2 lg:px-4 py-2 lg:py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <NuxtLink to="/messages" class="lg:hidden w-11 h-11 shrink-0 grid place-items-center rounded-full text-ink dark:text-white active:bg-black/[0.06] dark:active:bg-white/[0.08]" aria-label="All messages">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </NuxtLink>
          <NuxtLink :to="`/profile/${otherUid}`" class="flex items-center gap-3 min-w-0 flex-1">
            <ChatAvatar :person="otherPerson" :online="online" class="w-10 h-10" />
            <div class="min-w-0">
              <p class="text-sm font-bold text-ink dark:text-white truncate">{{ otherPerson.name }}</p>
              <p class="text-[11px] text-ink-muted dark:text-zinc-400 truncate">
                <span :class="online ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''">{{ seenLabel }}</span>
                <span aria-hidden="true"> · </span>
                <span>{{ replyLabel }}</span>
              </p>
            </div>
          </NuxtLink>
        </header>

        <!-- Messages -->
        <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          <p v-if="otherMissing" class="py-10 text-center text-sm text-ink-muted dark:text-zinc-400">
            This member doesn't exist, or their account was closed.
          </p>
          <template v-else>
            <div v-if="hasMore" class="text-center">
              <button type="button" @click="showEarlier" class="text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white">
                Show earlier messages
              </button>
            </div>

            <div
              v-if="!messagesLoading && !messages.length"
              class="mx-auto max-w-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-4 py-3 text-center text-xs text-ink-muted dark:text-zinc-400"
            >
              Say hello to {{ otherPerson.name }}. Keep payment and delivery on TCGo so Buyer Protection covers you.
            </div>

            <template v-for="(m, i) in messages" :key="m.id">
              <p v-if="dayChanged(i)" class="text-center text-[11px] font-semibold text-ink-soft dark:text-zinc-500 pt-2">
                {{ dayLabel(m.at) }}
              </p>
              <ChatBubble :message="m" :mine="m.senderUid === user.uid" @open-image="lightbox = $event" />
            </template>
            <ChatBubble
              v-for="m in outbox"
              :key="m.id"
              :message="m"
              mine
              pending
              @open-image="lightbox = $event"
            />
          </template>
        </div>

        <!-- Composer -->
        <form v-if="!otherMissing" class="chat-composer border-t border-black/[0.06] dark:border-white/[0.08] p-2 lg:p-3 space-y-2" @submit.prevent="submit()">
          <div v-if="pending.length || attachment" class="space-y-2">
            <div v-if="pending.length" class="flex gap-2 overflow-x-auto">
              <div v-for="(p, i) in pending" :key="p.preview" class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-canvas-sunken">
                <img :src="p.preview" alt="" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="removeImage(i)"
                  class="hit-44 absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/60 text-white text-sm leading-none"
                  aria-label="Remove photo"
                >×</button>
              </div>
            </div>
            <div v-if="attachment" class="relative">
              <ChatAttachmentCard :attachment="attachment.preview" :link="false" />
              <button
                type="button"
                @click="attachment = null"
                class="hit-44 absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink text-white dark:bg-white dark:text-ink text-sm leading-none shadow"
                aria-label="Remove attachment"
              >×</button>
            </div>
          </div>

          <p v-if="error" class="text-xs text-pokemon-red">{{ error }}</p>

          <div class="flex items-end gap-1.5">
            <button
              type="button"
              @click="fileInput?.click()"
              :disabled="pending.length >= CHAT_IMAGES_MAX"
              class="w-11 h-11 lg:w-9 lg:h-9 shrink-0 grid place-items-center rounded-full text-ink-muted dark:text-zinc-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-[0.94] transition-transform duration-150 ease-out disabled:opacity-40"
              aria-label="Attach photos"
              title="Attach photos"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
              </svg>
            </button>
            <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
            <button
              type="button"
              @click="pickerOpen = true"
              class="w-11 h-11 lg:w-9 lg:h-9 shrink-0 grid place-items-center rounded-full text-ink-muted dark:text-zinc-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-[0.94] transition-transform duration-150 ease-out"
              aria-label="Attach an order or listing"
              title="Attach an order or listing"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              ref="textBox"
              v-model="text"
              rows="1"
              :maxlength="CHAT_TEXT_MAX"
              placeholder="Write a message"
              class="flex-1 min-w-0 resize-none max-h-32 rounded-[22px] border border-black/[0.10] dark:border-white/[0.10] bg-transparent px-3.5 py-2.5 lg:py-2 text-sm text-ink dark:text-white placeholder-ink-soft focus:outline-none focus:border-pokemon-red"
              @input="grow"
              @keydown.enter="onEnter"
            />
            <button
              type="submit"
              :disabled="!canSend"
              class="h-11 lg:h-9 shrink-0 px-4 rounded-full text-sm font-semibold bg-pokemon-red text-white disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 ease-out"
              @mousedown.prevent
            >
              Send
            </button>
          </div>
        </form>
      </section>
      </Teleport>
    </div>

    <ChatAttachPicker
      v-if="pickerOpen"
      :other-uid="otherUid"
      :other-name="otherPerson.name"
      @close="pickerOpen = false"
      @pick="(ref, preview) => { attachment = { ref, preview }; pickerOpen = false; }"
    />

    <ChatRiskDialog
      v-if="riskPrompt.length"
      :risks="riskPrompt"
      :other-name="otherPerson.name"
      @edit="riskPrompt = []; textBox?.focus()"
      @send="riskPrompt = []; submit(true)"
    />

    <div
      v-if="lightbox"
      class="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4"
      @click="lightbox = ''"
    >
      <img :src="lightbox" alt="" class="max-w-full max-h-full object-contain" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import {
  CHAT_IMAGES_MAX,
  CHAT_PAGE_SIZE,
  CHAT_TEXT_MAX,
  conversationIdFor,
  detectChatRisks,
  isOnlineNow,
  lastSeenLabel,
  replyTimeLabel,
  type ChatAttachment,
  type ChatAttachmentRef,
  type ChatMessage,
  type ChatRisk,
  type Conversation,
  type ReplyStats,
} from "~/shared/chat";
import { RiskConfirmationNeeded } from "~/composables/useChat";

useHead({ title: "Messages · TCGo" });

const route = useRoute();
const { firestore } = useFirebase();
const { user, authLoading } = useAuth();
const { goToLogin } = useSignInGate();
const { listenInbox, markRead, uploadImage, send } = useChat();

const otherUid = computed(() => String(route.params.uid || ""));
const convId = computed(() => (user.value ? conversationIdFor(user.value.uid, otherUid.value) : ""));

// ── Live state ────────────────────────────────────────────────────────

const conversation = ref<Conversation | null>(null);
const messages = ref<ChatMessage[]>([]);
const messagesLoading = ref(true);
const pageSize = ref(CHAT_PAGE_SIZE);
const hasMore = computed(() => messages.value.length >= pageSize.value);

const otherProfile = ref<any>(null);
const otherMissing = ref(false);
const otherStats = ref<Partial<ReplyStats> | null>(null);

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

const otherPerson = computed(() => ({
  name: otherProfile.value?.customName || otherProfile.value?.displayName || conversation.value?.people?.[otherUid.value]?.name || "TCGo member",
  photoURL: otherProfile.value?.photoURL || conversation.value?.people?.[otherUid.value]?.photoURL || "",
}));
const online = computed(() => isOnlineNow(otherProfile.value?.lastSeenAt, now.value));
const seenLabel = computed(() => lastSeenLabel(otherProfile.value?.lastSeenAt, now.value));
const replyLabel = computed(() => replyTimeLabel(otherStats.value));

let unsubs: Unsubscribe[] = [];
let unsubMessages: Unsubscribe | null = null;

const listenMessages = () => {
  unsubMessages?.();
  if (!convId.value) return;
  const q = query(
    collection(firestore!, "conversations", convId.value, "messages"),
    orderBy("at", "desc"),
    limit(pageSize.value),
  );
  unsubMessages = onSnapshot(
    q,
    (snap) => {
      const atBottom = nearBottom();
      const firstLoad = messagesLoading.value;
      messages.value = snap.docs.map((d) => ({ ...(d.data() as Omit<ChatMessage, "id">), id: d.id })).reverse();
      messagesLoading.value = false;
      if (firstLoad || atBottom) scrollToBottom();
    },
    (e) => {
      console.error("[chat] messages listener failed", e);
      messagesLoading.value = false;
    },
  );
};

const start = () => {
  stop();
  if (!user.value || !otherUid.value || otherUid.value === user.value.uid) return;
  messagesLoading.value = true;
  pageSize.value = CHAT_PAGE_SIZE;

  unsubs.push(
    onSnapshot(doc(firestore!, "conversations", convId.value), (snap) => {
      conversation.value = snap.exists() ? ({ ...(snap.data() as any), id: snap.id } as Conversation) : null;
      if (document.visibilityState === "visible") void markRead(conversation.value ?? undefined);
    }),
    onSnapshot(doc(firestore!, "users", otherUid.value), (snap) => {
      otherProfile.value = snap.data() ?? null;
      otherMissing.value = !snap.exists();
    }),
    onSnapshot(doc(firestore!, "userStats", otherUid.value), (snap) => {
      otherStats.value = (snap.data() as ReplyStats) ?? null;
    }),
  );
  listenMessages();
};

const stop = () => {
  unsubs.forEach((u) => u());
  unsubs = [];
  unsubMessages?.();
  unsubMessages = null;
  conversation.value = null;
  messages.value = [];
};

const showEarlier = () => {
  const el = scroller.value;
  const fromBottom = el ? el.scrollHeight - el.scrollTop : 0;
  pageSize.value += CHAT_PAGE_SIZE;
  listenMessages();
  // Keep the reader's place rather than jumping to the newest.
  setTimeout(() => {
    if (el) el.scrollTop = el.scrollHeight - fromBottom;
  }, 300);
};

const onVisible = () => {
  if (document.visibilityState === "visible") void markRead(conversation.value ?? undefined);
};

onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 30_000);
  document.addEventListener("visibilitychange", onVisible);
});
onBeforeUnmount(() => {
  stop();
  if (ticker) clearInterval(ticker);
  document.removeEventListener("visibilitychange", onVisible);
});

watch([() => user.value?.uid, otherUid], () => {
  listenInbox();
  start();
  void preAttach();
}, { immediate: true });

// ── Scrolling ─────────────────────────────────────────────────────────

const scroller = ref<HTMLElement | null>(null);
const nearBottom = () => {
  const el = scroller.value;
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
};
const scrollToBottom = () =>
  nextTick(() => {
    const el = scroller.value;
    if (el) el.scrollTop = el.scrollHeight;
  });

// ── Phone: full-screen conversation ───────────────────────────────────

/** Below the lg breakpoint the conversation covers the app chrome. Set on
 *  mount so the server render and hydration match the desktop markup. */
const isPhone = ref(false);
/** The visual viewport: on both iOS and Android it shrinks when the keyboard
 *  opens, while 100dvh doesn't, so the screen follows it to keep the
 *  composer just above the keyboard. */
const viewport = ref({ h: 0, top: 0 });
let phoneQuery: MediaQueryList | null = null;

const syncViewport = () => {
  const vv = window.visualViewport;
  const wasAtBottom = nearBottom();
  viewport.value = vv ? { h: vv.height, top: vv.offsetTop } : { h: window.innerHeight, top: 0 };
  if (wasAtBottom) scrollToBottom();
};
const syncPhone = () => {
  isPhone.value = !!phoneQuery?.matches;
  // The page behind stays still while the conversation is on top of it.
  document.documentElement.style.overflow = isPhone.value ? "hidden" : "";
  if (isPhone.value) {
    syncViewport();
    scrollToBottom();
  }
};

onMounted(() => {
  phoneQuery = window.matchMedia("(max-width: 1023.98px)");
  phoneQuery.addEventListener("change", syncPhone);
  window.visualViewport?.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("scroll", syncViewport);
  syncPhone();
});
onBeforeUnmount(() => {
  phoneQuery?.removeEventListener("change", syncPhone);
  window.visualViewport?.removeEventListener("resize", syncViewport);
  window.visualViewport?.removeEventListener("scroll", syncViewport);
  document.documentElement.style.overflow = "";
});

const dayKey = (ts: number) => new Date(ts).toDateString();
const dayChanged = (i: number) => i === 0 || dayKey(messages.value[i]!.at) !== dayKey(messages.value[i - 1]!.at);
const dayLabel = (ts: number) => {
  const today = new Date();
  const d = new Date(ts);
  if (d.toDateString() === today.toDateString()) return "Today";
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

// ── Composer ──────────────────────────────────────────────────────────

const text = ref("");
const textBox = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const pending = ref<{ file: File; preview: string; url?: string }[]>([]);
const attachment = ref<{ ref: ChatAttachmentRef; preview: ChatAttachment } | null>(null);
const error = ref("");
const pickerOpen = ref(false);
const riskPrompt = ref<ChatRisk[]>([]);
const lightbox = ref("");

const canSend = computed(() => !!text.value.trim() || pending.value.length > 0 || !!attachment.value);

const grow = () => {
  const el = textBox.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
};

const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const onEnter = (e: KeyboardEvent) => {
  // Enter sends on a keyboard; on a phone it's a new line and Send sends.
  if (e.shiftKey || e.isComposing || isTouch()) return;
  e.preventDefault();
  void submit();
};

const onFiles = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith("image/"));
  const room = CHAT_IMAGES_MAX - pending.value.length;
  if (files.length > room) error.value = `Up to ${CHAT_IMAGES_MAX} photos per message.`;
  for (const file of files.slice(0, room)) {
    pending.value.push({ file, preview: URL.createObjectURL(file) });
  }
  input.value = "";
};

const removeImage = (i: number) => {
  const [p] = pending.value.splice(i, 1);
  if (p) URL.revokeObjectURL(p.preview);
};

/**
 * Messages on their way. Shown straight away, so Send feels instant, and
 * dropped once the server has written the real one (the live listener has
 * usually delivered it by then). Sent one at a time so they arrive in the
 * order they were written.
 */
const outbox = ref<(ChatMessage & { pending: true })[]>([]);
let sendQueue: Promise<unknown> = Promise.resolve();

const submit = (confirmRisk = false) => {
  if (!canSend.value || !user.value) return;
  error.value = "";

  // Warn before anything is uploaded or sent. The server checks again.
  const risks = detectChatRisks(text.value);
  if (risks.length && !confirmRisk) {
    riskPrompt.value = risks;
    return;
  }

  // Take the draft out of the composer now, so the next message can be typed.
  const draft = {
    text: text.value.trim(),
    pending: pending.value,
    attachment: attachment.value,
  };
  const temp = {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderUid: user.value.uid,
    text: draft.text,
    images: draft.pending.map((p) => p.preview),
    attachment: draft.attachment?.preview ?? null,
    risks: risks.map((r) => r.code),
    at: Date.now(),
    pending: true as const,
  };
  outbox.value.push(temp);
  text.value = "";
  pending.value = [];
  attachment.value = null;
  nextTick(grow);
  scrollToBottom();

  const toUid = otherUid.value;
  sendQueue = sendQueue.then(async () => {
    try {
      for (const p of draft.pending) {
        if (!p.url) p.url = await uploadImage(p.file);
      }
      await send({
        toUid,
        text: draft.text,
        images: draft.pending.map((p) => p.url!),
        attachment: draft.attachment?.ref ?? null,
        confirmRisk,
      });
      draft.pending.forEach((p) => URL.revokeObjectURL(p.preview));
    } catch (e: any) {
      // Put it back in the composer rather than lose what they wrote.
      if (!text.value && !pending.value.length && !attachment.value) {
        text.value = draft.text;
        pending.value = draft.pending;
        attachment.value = draft.attachment;
        nextTick(grow);
      }
      if (e instanceof RiskConfirmationNeeded) riskPrompt.value = e.risks;
      else error.value = `Not sent: ${e?.message || "something went wrong"}. Your message is back in the box.`;
    } finally {
      outbox.value = outbox.value.filter((m) => m.id !== temp.id);
    }
  });
};

/**
 * "Message seller" on a listing, or "Message" on an order, opens here with
 * that listing or order ready to attach. Looked up so the preview is real;
 * the server checks it again on send.
 */
const preAttach = async () => {
  const orderId = typeof route.query.order === "string" ? route.query.order : "";
  const productId = typeof route.query.product === "string" ? route.query.product : "";
  if (!user.value || (!orderId && !productId)) return;
  try {
    if (orderId) {
      const snap = await getDoc(doc(firestore!, "compiledOrders", orderId));
      const o = snap.data() as any;
      if (!o) return;
      attachment.value = {
        ref: { type: "order", id: orderId },
        preview: {
          type: "order",
          orderId,
          itemCount: o.items?.length ?? 0,
          firstItemName: o.items?.[0]?.cardName ?? "Order",
          imageUrl: o.items?.[0]?.imageUrl ?? "",
          total: Number(o.total) || 0,
          status: o.status ?? "",
        },
      };
    } else {
      const kind = route.query.kind === "auction" ? "auction" : "listing";
      const snap = await getDoc(doc(firestore!, kind === "auction" ? "auctions" : "cards", productId));
      const p = snap.data() as any;
      if (!p) return;
      attachment.value = {
        ref: { type: "product", kind, id: productId },
        preview: {
          type: "product",
          kind,
          productId,
          name: p.cardName || p.title || "Card",
          subtitle: [p.cardSet, p.condition].filter(Boolean).join(" · "),
          imageUrl: p.imageUrls?.[0] || p.imageUrl || "",
          price: Number(kind === "auction" ? p.currentPrice ?? p.startingPrice : p.price) || 0,
          sellerUid: p.sellerUid,
        },
      };
    }
  } catch (e) {
    console.warn("[chat] couldn't pre-attach", e);
  }
};
</script>

<style scoped>
/* Desktop: the conversation fills the screen below the nav, so the composer
   stays put and only the messages scroll. */
.chat-pane {
  height: calc(100dvh - var(--app-nav-h, 7rem) - 8.5rem);
  min-height: 22rem;
}
/* Phone: the conversation is its own screen above the nav and tab bar
   (z-40) and the install banner (z-50), below the cart drawer (z-60) and the
   attach and warning sheets (z-70). Height comes from the visual viewport in
   script; 100dvh is the fallback before it runs. */
.chat-screen {
  position: fixed;
  inset: 0 0 auto 0;
  height: 100dvh;
  z-index: 55;
}
.chat-screen .chat-header {
  padding-top: max(0.5rem, env(safe-area-inset-top));
}
.chat-screen .chat-composer {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}
/* A 24px button with a 44px touch area. */
.hit-44::before {
  content: "";
  position: absolute;
  inset: -10px;
}
@media (min-width: 1024px) {
  .chat-pane {
    height: calc(100dvh - var(--app-nav-h, 7rem) - 5rem);
  }
}
</style>

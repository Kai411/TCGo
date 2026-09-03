<template>
  <div class="max-w-2xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to use the POS.</p>
      <button @click="goToLogin" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">Sign in</button>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold text-ink dark:text-white mb-1">POS</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-5">
        Scan your inventory QR labels to ring up a sale, then take payment.
      </p>

      <!-- Scanner -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden mb-5">
        <div class="relative bg-black aspect-[4/3]">
          <video ref="videoEl" autoplay playsinline muted class="w-full h-full object-cover" :class="scanning ? '' : 'opacity-0'" />

          <!-- Idle overlay -->
          <div v-if="!scanning" class="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-3">
            <svg class="w-12 h-12 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
            <button @click="startCamera" class="px-5 py-2.5 rounded-full bg-white text-ink font-semibold text-sm hover:opacity-90">Start scanning</button>
            <p v-if="cameraError" class="text-xs text-red-300 px-6 text-center max-w-xs">{{ cameraError }}</p>
          </div>

          <!-- Reticle + controls when scanning -->
          <template v-else>
            <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div class="w-1/2 aspect-square border-2 border-white/70 rounded-xl" />
            </div>
            <button @click="stopCamera" class="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold">Stop</button>
            <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 scale-90" leave-active-class="transition duration-300" leave-to-class="opacity-0">
              <div v-if="showFlash" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="bg-emerald-500/90 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-2xl">Added</div>
              </div>
            </Transition>
          </template>

          <!-- transient toast -->
          <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 translate-y-1" leave-active-class="transition duration-300" leave-to-class="opacity-0">
            <div v-if="toast" class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs font-medium px-3 py-1.5 rounded-full">{{ toast }}</div>
          </Transition>
        </div>

        <!-- Manual fallback -->
        <div class="p-3 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button @click="manualOpen = !manualOpen" class="text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:text-ink dark:hover:text-white">
            {{ manualOpen ? "Hide manual add" : "Can't scan? Add manually" }}
          </button>
          <div v-if="manualOpen" class="mt-2">
            <input v-model="manualSearch" type="search" placeholder="Search your inventory by name…" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white" />
            <div v-if="manualResults.length" class="mt-2 space-y-1 max-h-48 overflow-y-auto">
              <button
                v-for="item in manualResults"
                :key="item.id"
                @click="addItem(item)"
                class="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left"
              >
                <div class="w-7 h-9 shrink-0 rounded overflow-hidden"><CardImage :src="item.primaryImage" :alt="item.cardName" /></div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium text-ink dark:text-white truncate">{{ item.cardName }}</p>
                  <p class="text-[10px] text-gray-500 dark:text-zinc-400 truncate">{{ [item.setName, item.number].filter(Boolean).join(" · ") }}</p>
                </div>
                <span class="text-xs font-semibold text-pokemon-red">+ Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sold-online alert. Raised when the pre-payment check finds something
           in the basket that a buyer took online while the seller was scanning. -->
      <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-1">
        <div
          v-if="blocked.length"
          class="mb-4 rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-3.5"
        >
          <div class="flex items-start gap-2.5">
            <svg class="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-red-800 dark:text-red-200">
                {{ blocked.length === 1 ? "One card is no longer available" : `${blocked.length} cards are no longer available` }}
              </p>
              <p class="mt-0.5 text-xs text-red-700 dark:text-red-300">
                Highlighted below. Remove {{ blocked.length === 1 ? "it" : "them" }} from the pile before taking payment.
              </p>
              <button
                @click="removeBlocked"
                class="mt-2.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              >
                Remove {{ blocked.length === 1 ? "it" : `all ${blocked.length}` }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Stash -->
      <div class="mb-44 lg:mb-28">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Cart ({{ stash.length }})</h2>
          <button v-if="stash.length" @click="clearCart" class="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500">Clear</button>
        </div>
        <p v-if="!stash.length" class="text-sm text-gray-400 dark:text-zinc-500 py-6 text-center">Scan a label to add it here.</p>
        <div v-else class="space-y-2">
          <div
            v-for="(line, i) in stash"
            :key="line.id"
            class="surface rounded-xl p-2.5 flex items-center gap-3 transition-colors"
            :class="blockedIds.has(line.id)
              ? 'border-2 border-red-500 bg-red-50 dark:bg-red-500/10'
              : 'border border-black/[0.06] dark:border-white/[0.08]'"
          >
            <div class="w-10 h-14 shrink-0 rounded overflow-hidden"><CardImage :src="line.image" :alt="line.cardName" /></div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink dark:text-white truncate">{{ line.cardName }}</p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">{{ line.sub }}</p>
              <p v-if="blockedIds.has(line.id)" class="text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5">
                {{ blockedReason(line.id) }}
              </p>
              <p v-else-if="discountOf(line) > 0" class="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                <span class="line-through">RM {{ line.listPrice.toFixed(2) }}</span>
                · RM {{ discountOf(line).toFixed(2) }} off
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-1">
              <span class="text-[10px] text-gray-400">RM</span>
              <input type="number" min="0" step="0.01" v-model.number="line.soldPrice" :disabled="paying" class="w-20 text-sm text-right px-2 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums disabled:opacity-50" />
            </div>
            <button @click="removeLine(i)" :disabled="paying" class="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-40" aria-label="Remove">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Checkout bar -->
      <Transition enter-active-class="transition duration-200" enter-from-class="translate-y-full">
        <div v-if="stash.length" class="fixed bottom-20 lg:bottom-0 inset-x-0 lg:left-56 z-40 glass border-t border-black/[0.06] dark:border-white/[0.08] px-4 py-3 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div class="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400">
                {{ stash.length }} {{ stash.length === 1 ? "item" : "items" }}
                <span v-if="totals.discountTotal > 0" class="text-amber-600 dark:text-amber-400 font-semibold">
                  · RM {{ totals.discountTotal.toFixed(2) }} off
                </span>
              </p>
              <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums">RM {{ totals.total.toFixed(2) }}</p>
            </div>
            <button
              @click="openPayment"
              :disabled="paying"
              class="px-8 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              <span v-if="paying" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Pay
            </button>
          </div>
        </div>
      </Transition>

      <PosPaymentSheet
        v-if="sheetOpen"
        :phase="phase"
        :total="totals.total"
        :discount-total="totals.discountTotal"
        :discounted-count="totals.discountedCount"
        :count="stash.length || lastCount"
        :qr-image="qrImage"
        :reserved-until="reservedUntil"
        :cancelling="cancelling"
        :attempt-declined="attemptDeclined"
        :failed-reason="failedReason"
        :qr-enabled="qrEnabled"
        :receipt-sent-to="receiptSentTo"
        :sending-receipt="sendingReceipt"
        :receipt-error="receiptError"
        @send-receipt="sendReceipt"
        @scan-buyer="armBuyerScan"
        @pay="startPayment"
        @cancel="cancelPayment"
        @close="closeSheet"
        @retry="retryPayment"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { InventoryItem } from "~/composables/useInventory";
import { isPlausibleEmail, parseBuyerQr } from "~/shared/buyer-qr";
import { posTotals, lineDiscount } from "~/shared/pos-sale";
import type { PosPaymentMethod } from "~/shared/pos-sale";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · POS | TCGo" });

const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { items, listenMyInventory } = useInventory();
const { authedFetch } = useAuthedFetch();
const qrEnabled = String(useRuntimeConfig().public.posQrEnabled ?? "") === "true";

onMounted(() => {
  if (user.value) listenMyInventory();
});
watch(user, (u) => {
  if (u) listenMyInventory();
});

// ── Stash ─────────────────────────────────────────────────────────────
interface StashLine {
  id: string;
  cardName: string;
  sub: string;
  image: string;
  listPrice: number;
  soldPrice: number;
}
const stash = ref<StashLine[]>([]);

// Totals come from the shared helper so the till, the server and the
// dashboard can't drift on what a discount is worth.
const totals = computed(() => posTotals(stash.value));
const discountOf = (line: StashLine) => lineDiscount(line);

const addItem = (item: InventoryItem) => {
  if (stash.value.some((l) => l.id === item.id)) {
    showToast("Already in cart");
    return;
  }
  if (item.status === "sold") {
    showToast("Already sold");
    return;
  }
  if (item.status === "reserved" && (item.reservedUntil ?? 0) > Date.now()) {
    showToast("Being paid for on another till");
    return;
  }
  stash.value.push({
    id: item.id,
    cardName: item.cardName,
    sub: [item.setName, item.number].filter(Boolean).join(" · "),
    image: item.primaryImage,
    listPrice: item.listPrice || 0,
    soldPrice: item.listPrice || 0,
  });
  feedback();
  showToast(`Added ${item.cardName}`);
};

const removeLine = (i: number) => {
  const [gone] = stash.value.splice(i, 1);
  if (gone) blocked.value = blocked.value.filter((b) => b.itemId !== gone.id);
};

const resetReceipt = () => {
  receiptSentTo.value = "";
  receiptError.value = "";
  awaitingBuyerScan.value = false;
};

const clearCart = () => {
  stash.value = [];
  blocked.value = [];
};

// ── Feedback (beep + haptic + flash) ─────────────────────────────────
const showFlash = ref(false);
let audioCtx: AudioContext | null = null;
// Create/resume the audio context inside a user gesture (the Start button) so
// scan beeps actually play — browsers suspend contexts made outside a gesture.
const primeAudio = async () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
  } catch {}
};
// Loud enough for a shop floor, which is a noisier room than the one this was
// tuned in. Three things do the work:
//
//   - A square wave, not a sine. Its harmonics cut through background noise
//     at the same amplitude, so it reads as much louder without clipping.
//   - Two oscillators a fifth apart. A single tone gets lost against talking;
//     an interval is heard as one deliberate "ding".
//   - A real envelope. Ramping the gain instead of switching it avoids the
//     click at each end — and the click was part of why the old beep sounded
//     cheap rather than loud.
const beep = () => {
  try {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.connect(audioCtx.destination);

    // 0 → peak in 6ms, then decay. Never scheduled to exactly 0: an
    // exponential ramp to zero is undefined and silences the tone.
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.55, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    for (const hz of [1046.5, 1568]) {
      const o = audioCtx.createOscillator();
      o.type = "square";
      o.frequency.value = hz;
      o.connect(g);
      o.start(now);
      o.stop(now + 0.17);
    }
  } catch {}
};
const feedback = () => {
  beep();
  try { navigator.vibrate?.(60); } catch {}
  showFlash.value = true;
  setTimeout(() => (showFlash.value = false), 350);
};

const toast = ref("");
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const showToast = (msg: string) => {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 1800);
};

// ── Camera + QR scan loop ────────────────────────────────────────────
const videoEl = ref<HTMLVideoElement | null>(null);
const scanning = ref(false);
const cameraError = ref("");
let stream: MediaStream | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let jsQR: any = null;
const canvas = import.meta.client ? document.createElement("canvas") : null;
const recent = new Map<string, number>(); // id → last-handled ms (dedup cooldown)

const startCamera = async () => {
  cameraError.value = "";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      await videoEl.value.play();
    }
    if (!jsQR) jsQR = (await import("jsqr")).default;
    await primeAudio();
    scanning.value = true;
    loop();
  } catch (e: any) {
    cameraError.value =
      e?.name === "NotAllowedError"
        ? "Camera permission denied. Use 'Add manually' instead."
        : "Couldn't open the camera. Use 'Add manually' instead.";
  }
};

const stopCamera = () => {
  scanning.value = false;
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
};

const loop = () => {
  if (!scanning.value) return;
  const v = videoEl.value;
  if (v && canvas && v.readyState >= 2 && v.videoWidth) {
    // Downscale for speed.
    const w = 400;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(v, 0, 0, w, h);
      try {
        const img = ctx.getImageData(0, 0, w, h);
        const res = jsQR(img.data, w, h);
        if (res?.data) handleDecoded(res.data);
      } catch {}
    }
  }
  loopTimer = setTimeout(loop, 140);
};

const handleDecoded = (raw: string) => {
  // A customer code, when the till is waiting for one. Checked before the
  // inventory branch and before the `paying` guard below — this is the one
  // scan that is only ever wanted AFTER a payment, not during a sale.
  const buyerUid = parseBuyerQr(raw);
  if (buyerUid) {
    if (!awaitingBuyerScan.value) return;
    void resolveBuyer(raw);
    return;
  }

  if (!raw.startsWith("tcgo:inv:")) return; // ignore foreign QR codes silently
  // Scanning is meaningless once a payment is on screen, and adding to a cart
  // whose total is already being charged would silently undercharge.
  if (paying.value) return;
  const id = raw.slice("tcgo:inv:".length);
  const now = Date.now();
  const last = recent.get(id) ?? 0;
  if (now - last < 1800) return; // cooldown so one label isn't added repeatedly
  recent.set(id, now);

  const item = items.value.find((i) => i.id === id);
  if (!item) {
    showToast("Not in your inventory");
    return;
  }
  addItem(item);
};

onBeforeUnmount(stopCamera);

// ── Manual fallback ───────────────────────────────────────────────────
const manualOpen = ref(false);
const manualSearch = ref("");
const manualResults = computed(() => {
  const q = manualSearch.value.trim().toLowerCase();
  if (q.length < 2) return [];
  return items.value
    .filter((i) => i.status !== "sold" && i.status !== "reserved")
    .filter((i) => i.cardName.toLowerCase().includes(q))
    .slice(0, 12);
});

// ── Payment ───────────────────────────────────────────────────────────
type Phase = "choose" | "starting" | "awaiting" | "paid" | "failed";

interface BlockedItem {
  itemId: string;
  cardName: string;
  reason: "sold" | "reserved" | "unavailable";
}

const sheetOpen = ref(false);
const phase = ref<Phase>("choose");
const paying = computed(() => sheetOpen.value && phase.value !== "choose" && phase.value !== "failed");
const blocked = ref<BlockedItem[]>([]);
const blockedIds = computed(() => new Set(blocked.value.map((b) => b.itemId)));
const saleId = ref("");

// ── Receipt ──────────────────────────────────────────────────────────
// Offered once the money is in. The sale stands whether or not this succeeds,
// so every failure here is reported without touching the sale record.
const receiptSentTo = ref("");
const sendingReceipt = ref(false);
const receiptError = ref("");
/** True while the camera should treat a customer code as the thing it wants. */
const awaitingBuyerScan = ref(false);

const sendReceipt = async (email: string) => {
  const addr = email.trim();
  if (!addr || sendingReceipt.value || !saleId.value) return;
  if (!isPlausibleEmail(addr)) {
    receiptError.value = "That doesn't look like an email address.";
    return;
  }
  sendingReceipt.value = true;
  receiptError.value = "";
  try {
    const res = await authedFetch<{ to: string; sandbox: boolean }>(
      "/api/pos/send-receipt",
      { method: "POST", body: { saleId: saleId.value, email: addr } },
    );
    receiptSentTo.value = res.to;
    awaitingBuyerScan.value = false;
  } catch (e: any) {
    receiptError.value =
      e?.data?.message || e?.message || "Couldn't send that. Try again.";
  } finally {
    sendingReceipt.value = false;
  }
};

/** Point the camera at the customer's phone instead of a price tag. */
const armBuyerScan = async () => {
  receiptError.value = "";
  awaitingBuyerScan.value = true;
  if (!scanning.value) await startCamera();
  showToast("Scan the customer's TCGo code");
};

const resolveBuyer = async (code: string) => {
  try {
    const res = await authedFetch<{ email: string; name: string }>(
      "/api/pos/lookup-buyer",
      { method: "POST", body: { code } },
    );
    awaitingBuyerScan.value = false;
    // Straight to sending: they scanned to avoid typing, so stopping to
    // confirm an address they cannot read from here helps nobody.
    await sendReceipt(res.email);
  } catch (e: any) {
    awaitingBuyerScan.value = false;
    receiptError.value =
      e?.data?.message || e?.message || "Couldn't read that customer code.";
  }
};
const qrImage = ref("");
const reservedUntil = ref(0);
const cancelling = ref(false);
const failedReason = ref("");
// A declined attempt on a charge that is still open for a retry.
const attemptDeclined = ref(false);
const lastCount = ref(0);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const blockedReason = (itemId: string) => {
  const hit = blocked.value.find((b) => b.itemId === itemId);
  if (!hit) return "";
  return hit.reason === "reserved"
    ? "Being paid for on another till"
    : "Sold online — remove from the pile";
};

const removeBlocked = () => {
  const gone = blockedIds.value;
  stash.value = stash.value.filter((l) => !gone.has(l.id));
  blocked.value = [];
  showToast("Removed");
};

/**
 * Availability is checked BEFORE the method sheet opens, so the seller learns
 * a card went while they were scanning at the point they can still pull it out
 * of the pile — not with a customer's phone already out.
 */
const openPayment = async () => {
  if (!stash.value.length) return;
  blocked.value = [];
  failedReason.value = "";

  try {
    const res = await authedFetch<{ ok: boolean; blocked: BlockedItem[] }>(
      "/api/pos/check-stock",
      { method: "POST", body: { itemIds: stash.value.map((l) => l.id) } },
    );
    if (!res.ok) {
      blocked.value = res.blocked ?? [];
      try { navigator.vibrate?.([80, 60, 80]); } catch {}
      showToast("Some cards are no longer available");
      return;
    }
  } catch (e: any) {
    showToast(e?.data?.message || "Couldn't check stock — try again");
    return;
  }

  phase.value = "choose";
  sheetOpen.value = true;
};

const startPayment = async (method: PosPaymentMethod) => {
  if (method === "cash") return payCash();
  phase.value = "starting";
  failedReason.value = "";
  attemptDeclined.value = false;

  try {
    const res = await authedFetch<{
      saleId: string;
      qrPayload: string;
      reservedUntil: number;
    }>("/api/pos/create-charge", {
      method: "POST",
      body: {
        method,
        lines: stash.value.map((l) => ({ itemId: l.id, soldPrice: l.soldPrice })),
      },
    });

    saleId.value = res.saleId;
    reservedUntil.value = res.reservedUntil;

    // The payload is a raw EMVCo string; the QR itself is drawn here.
    const mod: any = await import("qrcode");
    const QRCode = mod.default ?? mod;
    qrImage.value = await QRCode.toDataURL(res.qrPayload, {
      margin: 0,
      width: 420,
      // DuitNow payloads are long, and a till gets scanned in poor light at an
      // angle — the extra redundancy of level Q is worth the density.
      errorCorrectionLevel: "Q",
    });

    phase.value = "awaiting";
    startPolling();
  } catch (e: any) {
    // 409 carries the items that blocked the sale, so they can be highlighted
    // rather than just described.
    const conflict = e?.data?.data?.blocked as BlockedItem[] | undefined;
    if (conflict?.length) {
      blocked.value = conflict;
      sheetOpen.value = false;
      showToast("Some cards are no longer available");
      return;
    }
    failedReason.value = e?.data?.message || e?.message || "Couldn't start the payment.";
    phase.value = "failed";
  }
};

const payCash = async () => {
  phase.value = "starting";
  try {
    const res = await authedFetch<{ count: number }>("/api/pos/cash-sale", {
      method: "POST",
      body: { lines: stash.value.map((l) => ({ itemId: l.id, soldPrice: l.soldPrice })) },
    });
    lastCount.value = res.count;
    phase.value = "paid";
    stash.value = [];
    recent.clear();
  } catch (e: any) {
    const conflict = e?.data?.data?.blocked as BlockedItem[] | undefined;
    if (conflict?.length) {
      blocked.value = conflict;
      sheetOpen.value = false;
      showToast("Some cards are no longer available");
      return;
    }
    failedReason.value = e?.data?.message || "Couldn't record the sale.";
    phase.value = "failed";
  }
};

// The webhook is authoritative, but it can't reach localhost in development
// and can lag in production — so the till asks too. Both settle idempotently.
const startPolling = () => {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!saleId.value) return;
    try {
      const res = await authedFetch<{
        status: string;
        settled: boolean;
        lastAttemptFailed?: boolean;
      }>("/api/pos/charge-status", {
        method: "POST",
        body: { saleId: saleId.value },
      });
      // Declined but retryable — tell the seller without killing the QR.
      attemptDeclined.value = !!res.lastAttemptFailed;
      if (res.status === "paid") {
        stopPolling();
        lastCount.value = stash.value.length;
        phase.value = "paid";
        stash.value = [];
        recent.clear();
        try { navigator.vibrate?.(120); } catch {}
      } else if (res.status === "failed" || res.status === "cancelled") {
        stopPolling();
        failedReason.value =
          res.status === "cancelled"
            ? "The payment window expired. Nothing was charged."
            : "The customer's payment was declined.";
        phase.value = "failed";
      }
    } catch {
      // Transient — keep waiting rather than dropping a live payment.
    }
  }, 2500);
};

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
};

const cancelPayment = async () => {
  if (!saleId.value || cancelling.value) return;
  cancelling.value = true;
  try {
    const res = await authedFetch<{ paidInstead?: boolean }>("/api/pos/cancel", {
      method: "POST",
      body: { saleId: saleId.value },
    });
    stopPolling();
    if (res.paidInstead) {
      // They paid in the moment it took to reach for Cancel.
      lastCount.value = stash.value.length;
      phase.value = "paid";
      stash.value = [];
      recent.clear();
    } else {
      sheetOpen.value = false;
      showToast("Payment cancelled — cards released");
    }
  } catch (e: any) {
    showToast(e?.data?.message || "Couldn't cancel — try again");
  } finally {
    cancelling.value = false;
  }
};

const retryPayment = () => {
  phase.value = "choose";
  failedReason.value = "";
};

const closeSheet = () => {
  stopPolling();
  sheetOpen.value = false;
  phase.value = "choose";
  qrImage.value = "";
  saleId.value = "";
  reservedUntil.value = 0;
  attemptDeclined.value = false;
  // The next sale is a different customer. Carrying "sent to …" across would
  // tell the seller a receipt had gone out for a sale that hasn't happened.
  resetReceipt();
};

// A till left open with a live hold would keep stock locked for the full
// window. Release it on the way out.
onBeforeUnmount(() => {
  stopPolling();
  if (saleId.value && phase.value === "awaiting") {
    void authedFetch("/api/pos/cancel", {
      method: "POST",
      body: { saleId: saleId.value },
    }).catch(() => {});
  }
});
</script>

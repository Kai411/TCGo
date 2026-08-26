<template>
  <div class="max-w-2xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to use the POS.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">Sign in with Google</button>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold text-ink dark:text-white mb-1">POS</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-5">
        Scan your inventory QR labels to ring up an in-person sale. Adjust the price for any haggling, then mark paid.
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

      <!-- Stash -->
      <div class="mb-44 lg:mb-24">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Cart ({{ stash.length }})</h2>
          <button v-if="stash.length" @click="stash = []" class="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500">Clear</button>
        </div>
        <p v-if="!stash.length" class="text-sm text-gray-400 dark:text-zinc-500 py-6 text-center">Scan a label to add it here.</p>
        <div v-else class="space-y-2">
          <div v-for="(line, i) in stash" :key="line.id" class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-2.5 flex items-center gap-3">
            <div class="w-10 h-14 shrink-0 rounded overflow-hidden"><CardImage :src="line.image" :alt="line.cardName" /></div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink dark:text-white truncate">{{ line.cardName }}</p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">{{ line.sub }}</p>
              <p v-if="line.soldPrice !== line.listPrice" class="text-[10px] text-amber-600 dark:text-amber-400">List RM {{ line.listPrice.toFixed(2) }}</p>
            </div>
            <div class="shrink-0 flex items-center gap-1">
              <span class="text-[10px] text-gray-400">RM</span>
              <input type="number" min="0" step="0.01" v-model.number="line.soldPrice" class="w-20 text-sm text-right px-2 py-1 rounded-md border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-ink dark:text-white tabular-nums" />
            </div>
            <button @click="stash.splice(i, 1)" class="shrink-0 text-gray-400 hover:text-red-500" aria-label="Remove">
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
              <p class="text-[11px] text-gray-500 dark:text-zinc-400">Total · {{ stash.length }} {{ stash.length === 1 ? "item" : "items" }}</p>
              <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums">RM {{ total.toFixed(2) }}</p>
            </div>
            <button @click="checkout" :disabled="checkingOut" class="px-6 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 flex items-center gap-2">
              <span v-if="checkingOut" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Mark paid
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { InventoryItem } from "~/composables/useInventory";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · POS | TCGo" });

const { user, signInWithGoogle } = useAuth();
const { items, listenMyInventory, markItemSold } = useInventory();

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
const total = computed(() => stash.value.reduce((s, l) => s + (l.soldPrice || 0), 0));

const addItem = (item: InventoryItem) => {
  if (stash.value.some((l) => l.id === item.id)) {
    showToast("Already in cart");
    return;
  }
  if (item.status === "sold") {
    showToast("Already sold");
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
const beep = () => {
  try {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.18;
    o.start();
    o.stop(audioCtx.currentTime + 0.1);
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
  if (!raw.startsWith("tcgo:inv:")) return; // ignore foreign QR codes silently
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
    .filter((i) => i.status !== "sold" && i.cardName.toLowerCase().includes(q))
    .slice(0, 12);
});

// ── Checkout ──────────────────────────────────────────────────────────
const checkingOut = ref(false);
const checkout = async () => {
  if (!stash.value.length || checkingOut.value) return;
  if (!confirm(`Mark ${stash.value.length} item(s) as sold for RM ${total.value.toFixed(2)}?`)) return;
  checkingOut.value = true;
  try {
    for (const line of stash.value) {
      await markItemSold(line.id, line.soldPrice);
    }
    const n = stash.value.length;
    stash.value = [];
    recent.clear();
    showToast(`Sold ${n} item${n === 1 ? "" : "s"} ✓`);
  } catch (e: any) {
    alert(e?.message || "Checkout failed. Please try again.");
  } finally {
    checkingOut.value = false;
  }
};
</script>

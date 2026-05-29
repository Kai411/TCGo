<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 bg-black/90 flex flex-col"
      @click.self="close"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 h-14 bg-black text-white"
      >
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold">Scan Card</h2>
          <span
            v-if="premiumEnabled && user && isPremium"
            class="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300"
          >
            Premium · Unlimited
          </span>
          <span
            v-else-if="user"
            class="text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/80"
            :class="{ 'text-red-300 bg-red-500/20': remaining === 0 }"
          >
            {{ used }}/{{ FREE_SCAN_LIMIT }} this month
          </span>
        </div>
        <button
          @click="close"
          class="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Sign-in gate: scanner is auth-only -->
      <div
        v-if="!user"
        class="flex-1 flex flex-col items-center justify-center text-center px-6 text-white"
      >
        <svg
          class="w-12 h-12 mb-4 text-white/70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <h3 class="text-lg font-semibold mb-1">Sign in to scan</h3>
        <p class="text-sm text-white/70 mb-6 max-w-xs">
          Free accounts get {{ FREE_SCAN_LIMIT }} scans per month.
        </p>
        <button
          @click="handleSignIn"
          class="bg-white text-ink px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
        >
          Sign in with Google
        </button>
      </div>

      <!-- Quota exhausted: upgrade prompt -->
      <div
        v-else-if="remaining === 0"
        class="flex-1 flex flex-col items-center justify-center text-center px-6 text-white"
      >
        <div
          class="w-14 h-14 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mb-4"
        >
          <svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-semibold mb-1">
          You've used all {{ FREE_SCAN_LIMIT }} scans
        </h3>
        <p class="text-sm text-white/70 mb-2 max-w-xs">
          Quota resets {{ resetDateLabel }}.<template v-if="premiumEnabled"> Upgrade to Premium for unlimited scans.</template>
        </p>
        <template v-if="premiumEnabled">
          <a
            v-if="adminWhatsAppLink"
            :href="adminWhatsAppLink"
            target="_blank"
            rel="noopener"
            class="mt-4 inline-flex items-center gap-2 bg-amber-500 text-ink px-6 py-3 rounded-full font-semibold hover:bg-amber-400 transition-colors"
          >
            Upgrade via WhatsApp
          </a>
          <p v-else class="mt-4 text-xs text-white/50">
            Premium upgrade isn't configured yet — set NUXT_PUBLIC_ADMIN_WHATSAPP.
          </p>
        </template>
      </div>

      <!-- Always-on camera viewfinder. Capture is non-blocking: each scan
           queues a 'processing' item and ID runs in the background so the
           user can keep snapping. -->
      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        @dragenter.prevent="dragOver = true"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="handleDrop"
      >
        <video
          ref="videoEl"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover"
        />
        <!-- Card framing overlay. Sits in the upper half so the bottom
             stack (hint + capture button) has its own breathing room. -->
        <div
          class="absolute inset-x-0 top-16 bottom-44 pointer-events-none flex items-center justify-center"
        >
          <div
            class="border-2 border-white/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] max-h-full"
            style="aspect-ratio: 2.5 / 3.5; height: 100%"
          ></div>
        </div>

        <!-- Top stack: warning, upload, queue status -->
        <div
          class="absolute top-4 left-0 right-0 flex flex-col items-center gap-3 px-4 z-10"
        >
          <p
            v-if="cameraError"
            class="bg-red-600/90 text-white text-sm px-3 py-2 rounded w-full max-w-sm text-center"
          >
            {{ cameraError }}
          </p>
          <label
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 text-ink text-xs font-semibold shadow-card cursor-pointer hover:bg-white transition-colors"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload photo instead
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileUpload"
            />
          </label>
          <!-- Live queue status -->
          <div
            v-if="queue.length"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-[11px] font-semibold backdrop-blur"
          >
            <span
              v-if="processingCount() > 0"
              class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"
            />
            <span
              v-else
              class="inline-block w-2 h-2 rounded-full bg-emerald-400"
            />
            {{ queue.length }} scanned
            <span v-if="processingCount() > 0" class="text-white/70">
              · identifying {{ processingCount() }}
            </span>
          </div>
        </div>

        <!-- 'Captured' flash toast -->
        <Transition
          enter-active-class="transition duration-200"
          enter-from-class="opacity-0 scale-90"
          leave-active-class="transition duration-300"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showFlash"
            class="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          >
            <div
              class="bg-emerald-500/90 text-white rounded-full px-5 py-3 text-sm font-semibold shadow-2xl flex items-center gap-2"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Captured
            </div>
          </div>
        </Transition>

        <!-- Drop overlay -->
        <div
          v-if="dragOver"
          class="absolute inset-0 z-20 bg-black/80 border-4 border-dashed border-white/60 rounded-lg flex flex-col items-center justify-center pointer-events-none"
        >
          <svg
            class="w-14 h-14 text-white/90 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p class="text-white text-lg font-semibold">Drop photo to scan</p>
        </div>

        <!-- Bottom: capture + Done. The hint text sits inside the gradient
             so it gets a small breath of dark behind it instead of fighting
             the live camera frame for contrast. -->
        <div
          class="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-8 pt-8 bg-gradient-to-t from-black/80 to-transparent"
        >
          <p class="text-center text-white/80 text-xs px-4 mb-5">
            Line up the card and tap capture, or drag a photo anywhere.
          </p>
          <div class="relative w-full flex items-center justify-center">
            <button
              @click="capture"
              :disabled="!streamReady"
              class="w-16 h-16 rounded-full bg-white border-4 border-white/40 disabled:opacity-40 hover:scale-105 transition-transform"
              aria-label="Capture"
            ></button>
            <button
              v-if="queue.length > 0"
              @click="finishScanning"
              class="absolute right-6 inline-flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg hover:bg-emerald-600 transition-colors"
            >
              Done · {{ queue.length }}
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  close: [];
  finished: [];
}>();

const { uploadImage } = useStorage();
const { lookupByNameAndNumber } = useCardCatalog();
const { queue, addProcessing, updateItem, pickMatch, processingCount } =
  useScanQueue();
const { user, signInWithGoogle } = useAuth();
const { isPremium, remaining, used, tryConsumeScan } = useScanQuota();
const { profile } = useMyProfile();
const { premiumEnabled } = useFeatureFlags();

const config = useRuntimeConfig();
const adminWhatsAppLink = computed(() => {
  const num = config.public.adminWhatsApp;
  if (!num) return "";
  const msg = encodeURIComponent(
    `Hi! I'd like to upgrade to TCGo Premium (user: ${user.value?.email || user.value?.uid || "anon"}).`,
  );
  return `https://wa.me/${num}?text=${msg}`;
});

const resetDateLabel = computed(() => {
  if (!profile.value?.scansResetAt) return "next month";
  const d = new Date(profile.value.scansResetAt);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
});

const handleSignIn = async () => {
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error("[CardScanner] sign-in failed:", e);
  }
};

const videoEl = ref<HTMLVideoElement | null>(null);
const stream = ref<MediaStream | null>(null);
const streamReady = ref(false);
const cameraError = ref("");
const dragOver = ref(false);
const showFlash = ref(false);

const startCamera = async () => {
  cameraError.value = "";
  streamReady.value = false;
  try {
    // Ask for the highest practical resolution. Browsers clamp to what the
    // device supports — `ideal` lets them pick the closest available rather
    // than rejecting outright. 4K target keeps small text on cards readable.
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
    });
    if (videoEl.value) {
      videoEl.value.srcObject = stream.value;
      await videoEl.value.play();
      streamReady.value = true;
    }
  } catch (e: any) {
    cameraError.value =
      e.name === "NotAllowedError"
        ? "Camera permission denied. Use 'Upload photo' instead."
        : "Couldn't open camera. Use 'Upload photo' instead.";
  }
};

const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach((t) => t.stop());
    stream.value = null;
  }
  streamReady.value = false;
};

// Only start the camera if user is signed in AND has quota.
// Watch so camera starts when sign-in completes from inside the modal.
watch(
  [user, remaining],
  ([u, r]) => {
    if (u && r > 0 && !streamReady.value) startCamera();
    if ((!u || r === 0) && streamReady.value) stopCamera();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopCamera();
});

const close = () => {
  stopCamera();
  emit("close");
};

const finishScanning = () => {
  stopCamera();
  emit("finished");
};

const flash = () => {
  showFlash.value = true;
  setTimeout(() => {
    showFlash.value = false;
  }, 700);
};

// User taps the big capture button → grab frame → enqueue + process.
const capture = async () => {
  const video = videoEl.value;
  if (!video || !streamReady.value) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      acceptScan(blob);
    },
    "image/jpeg",
    0.9,
  );
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  acceptScan(file);
  input.value = "";
};

const handleDrop = async (event: DragEvent) => {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) {
    acceptScan(file);
  }
};

const onDragLeave = (event: DragEvent) => {
  const current = event.currentTarget as HTMLElement | null;
  const related = event.relatedTarget as Node | null;
  if (current && related && current.contains(related)) return;
  dragOver.value = false;
};

// Adds a fresh queue item (status: processing) and fires off the upload +
// ID pipeline. Returns immediately so the camera stays interactive.
// Reserves one scan from the user's monthly quota first — if over cap,
// no-op (the UI already shows the upgrade overlay when remaining === 0).
const acceptScan = async (blob: Blob) => {
  const allowed = await tryConsumeScan();
  if (!allowed) return;
  flash();
  // Use the local object URL as a quick preview until the Cloudinary
  // upload completes — that gives the user something to look at right away.
  const localPreview = URL.createObjectURL(blob);
  const id = addProcessing(localPreview);
  void processInBackground(id, blob, localPreview);
};

const MAX_DIM = 1600;
const resizeBlob = (blob: Blob): Promise<Blob> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= MAX_DIM && height <= MAX_DIM) {
        resolve(blob);
        return;
      }
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(blob);
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((out) => resolve(out || blob), "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });

// All the heavy lifting (Cloudinary upload, Gemini ID, TCG API) happens
// here in the background. Updates the queue item as each stage completes.
const processInBackground = async (
  id: string,
  blob: Blob,
  localPreview: string,
) => {
  // 1. Upload the user's photo to Cloudinary so it survives a refresh.
  let uploadedUrl = localPreview;
  try {
    const file = new File([blob], `scan-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    uploadedUrl = await uploadImage(file);
    updateItem(id, { scannedImageUrl: uploadedUrl });
    URL.revokeObjectURL(localPreview);
  } catch {
    // Upload failed — keep the local preview so the user still sees it.
  }

  // 2. Identify the card via Gemini.
  let name = "";
  let number = "";
  let language = "EN";
  let artist = "";
  try {
    const resized = await resizeBlob(blob);
    const imageBase64 = await blobToBase64(resized);
    const res = await $fetch<{
      name: string;
      number: string;
      language: string;
      artist?: string;
    }>("/api/identify-card", {
      method: "POST",
      body: { imageBase64, mimeType: "image/jpeg" },
    });
    name = res.name || "";
    number = res.number || "";
    language = res.language || "EN";
    artist = res.artist || "";
  } catch (e: any) {
    // User-facing message — never expose raw model/HTTP error strings.
    // 503 means the model is overloaded (transient, worth a retry); other
    // codes get a generic "couldn't read this card" with a search hint.
    const status = e?.response?.status || e?.statusCode;
    const friendly =
      status === 503
        ? "The card recognizer is busy — try again in a moment."
        : status === 429
          ? "Too many scans at once — please slow down."
          : "Couldn't read this card. Try a clearer photo or search by name below.";
    updateItem(id, { status: "failed", error: friendly });
    return;
  }
  updateItem(id, {
    detectedName: name,
    detectedNumber: number,
    language,
    artist,
  });

  // 3. For non-English cards, skip the TCGo DB lookup — the Pokémon catalog
  // is English-first (TCGCSV's JP coverage is partial and Gemini returns
  // English-translated names anyway, so matching is unreliable). Use the
  // user's scanned image + Gemini's translated name + printed set number
  // directly. Seller can still set their own price manually.
  if (language !== "EN") {
    updateItem(id, {
      status: "ready",
      cardName: name,
      cardSet: "",
      cardNumber: number,
      imageUrl: undefined,
      tcgoPrice: null,
    });
    return;
  }

  // 4. Look up the card in the TCGo DB (Supabase cards_catalog + card_prices).
  //    First tries exact-ish name + number; falls back to name-only
  //    suggestions if nothing matches.
  let lookup: Awaited<ReturnType<typeof lookupByNameAndNumber>>;
  try {
    lookup = await lookupByNameAndNumber(name, number, { language: "EN" });
  } catch {
    updateItem(id, {
      status: "failed",
      error: "Couldn't reach the card database. Try again or search by name.",
    });
    return;
  }

  // 5. Resolve to a queue item state:
  //    - exactly one exact match → auto-pick (status: ready, price attached)
  //    - multiple exact matches → user picks from candidate list
  //    - no exact match but suggestions exist → show as needs-pick with hint
  //    - nothing at all → mark failed
  if (lookup.exact.length === 1) {
    pickMatch(id, lookup.exact[0]);
  } else if (lookup.exact.length > 1) {
    updateItem(id, { status: "needs-pick", matches: lookup.exact });
  } else if (lookup.suggestions.length > 0) {
    updateItem(id, { status: "needs-pick", matches: lookup.suggestions });
  } else {
    updateItem(id, {
      status: "failed",
      error: "No matches found in TCGo DB — fill in manually below.",
    });
  }
};
</script>

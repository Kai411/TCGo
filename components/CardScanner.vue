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
        <h2 class="text-base font-semibold">Scan Card</h2>
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

      <!-- Stage 1: Camera viewfinder -->
      <div
        v-if="stage === 'camera'"
        class="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
      >
        <video
          ref="videoEl"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover"
        />
        <!-- Card framing overlay -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            class="border-2 border-white/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style="aspect-ratio: 2.5 / 3.5; height: 65%"
          ></div>
        </div>
        <p
          v-if="cameraError"
          class="absolute top-4 left-4 right-4 bg-red-600/90 text-white text-sm px-3 py-2 rounded"
        >
          {{ cameraError }}
        </p>
        <p
          class="absolute bottom-28 left-4 right-4 text-center text-white/80 text-xs"
        >
          Line the card up inside the frame, then tap capture.
        </p>
        <!-- Capture button -->
        <div
          class="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-8 pt-6 bg-gradient-to-t from-black/80 to-transparent"
        >
          <button
            @click="capture"
            :disabled="!streamReady"
            class="w-16 h-16 rounded-full bg-white border-4 border-white/40 disabled:opacity-40 hover:scale-105 transition-transform"
            aria-label="Capture"
          ></button>
        </div>
        <!-- File fallback -->
        <label
          class="absolute bottom-10 right-6 text-xs text-white/70 underline cursor-pointer"
        >
          Upload photo instead
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileUpload"
          />
        </label>
      </div>

      <!-- Stage 2: Processing -->
      <div
        v-else-if="stage === 'processing'"
        class="flex-1 flex flex-col items-center justify-center text-white px-6"
      >
        <img
          v-if="capturedPreview"
          :src="capturedPreview"
          class="max-h-48 rounded-lg mb-6 shadow-lg"
        />
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"
        ></div>
        <p class="text-sm">{{ processingMessage }}</p>
        <p v-if="ocrProgress > 0" class="text-xs text-white/60 mt-2">
          {{ Math.round(ocrProgress * 100) }}%
        </p>
      </div>

      <!-- Stage 3: Pick a match -->
      <div
        v-else-if="stage === 'matches'"
        class="flex-1 bg-white overflow-y-auto"
      >
        <div class="max-w-2xl mx-auto p-4">
          <div v-if="capturedPreview" class="flex gap-3 mb-4 items-center">
            <img
              :src="capturedPreview"
              class="w-16 h-20 object-cover rounded border border-gray-200"
            />
            <div class="text-sm">
              <p class="text-gray-500">Detected:</p>
              <p class="font-medium text-gray-900">
                {{ detectedName || "(no name)" }}
                <span v-if="detectedNumber" class="text-gray-400">
                  · {{ detectedNumber }}</span
                >
              </p>
            </div>
          </div>

          <div v-if="matches.length === 0" class="text-center py-10">
            <p class="text-gray-700 font-medium mb-2">No matches found</p>
            <p class="text-sm text-gray-500 mb-4">
              Try a clearer photo or search manually.
            </p>
            <div class="flex gap-2 max-w-sm mx-auto">
              <input
                v-model="manualSearch"
                type="text"
                placeholder="e.g. Charizard"
                class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                @keydown.enter.prevent="runManualSearch"
              />
              <button
                @click="runManualSearch"
                :disabled="searching || !manualSearch"
                class="bg-pokemon-blue text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {{ searching ? "..." : "Search" }}
              </button>
            </div>
          </div>

          <div v-else>
            <p class="text-sm font-semibold text-gray-900 mb-3">
              Select your card ({{ matches.length }} match{{
                matches.length === 1 ? "" : "es"
              }})
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                v-for="m in matches"
                :key="m.id"
                @click="confirmMatch(m)"
                :disabled="saving"
                class="text-left bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:border-pokemon-blue transition-colors disabled:opacity-50"
              >
                <img
                  :src="m.images.small"
                  :alt="m.name"
                  class="w-full aspect-[2.5/3.5] object-cover"
                />
                <div class="p-2">
                  <p class="text-xs font-semibold text-gray-900 truncate">
                    {{ m.name }}
                  </p>
                  <p class="text-[10px] text-gray-500 truncate">
                    {{ m.set.name }} · {{ m.number }}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <button
            @click="resetToCamera"
            class="mt-6 w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- Stage 4: Saving -->
      <div
        v-else-if="stage === 'saving'"
        class="flex-1 flex flex-col items-center justify-center text-white"
      >
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"
        ></div>
        <p class="text-sm">Adding to your collection...</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { TcgCard } from "~/composables/usePokemonTcg";

const emit = defineEmits<{
  close: [];
  added: [];
}>();

const { uploadImage } = useStorage();
const { searchByNameAndNumber, searchByName } = usePokemonTcg();
const { addCard } = useCollection();

type Stage = "camera" | "processing" | "matches" | "saving";
const stage = ref<Stage>("camera");

const videoEl = ref<HTMLVideoElement | null>(null);
const stream = ref<MediaStream | null>(null);
const streamReady = ref(false);
const cameraError = ref("");

const capturedBlob = ref<Blob | null>(null);
const capturedPreview = ref("");

const detectedName = ref("");
const detectedNumber = ref("");
const matches = ref<TcgCard[]>([]);
const manualSearch = ref("");
const searching = ref(false);
const saving = ref(false);

const ocrProgress = ref(0);
const processingMessage = ref("Reading card...");

const startCamera = async () => {
  cameraError.value = "";
  streamReady.value = false;
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
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

onMounted(() => {
  startCamera();
});

onBeforeUnmount(() => {
  stopCamera();
  if (capturedPreview.value) URL.revokeObjectURL(capturedPreview.value);
});

const close = () => {
  stopCamera();
  emit("close");
};

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
    async (blob) => {
      if (!blob) return;
      await processBlob(blob);
    },
    "image/jpeg",
    0.9,
  );
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await processBlob(file);
};

const processBlob = async (blob: Blob) => {
  stopCamera();
  capturedBlob.value = blob;
  if (capturedPreview.value) URL.revokeObjectURL(capturedPreview.value);
  capturedPreview.value = URL.createObjectURL(blob);

  stage.value = "processing";
  ocrProgress.value = 0;

  try {
    processingMessage.value = "Cleaning up image...";
    const img = await loadImage(blob);
    // Top strip: card name. Bottom strip: set number.
    const nameCanvas = preprocessRegion(img, {
      x: 0,
      y: 0.03,
      width: 1,
      height: 0.15,
    });
    const numberCanvas = preprocessRegion(img, {
      x: 0,
      y: 0.88,
      width: 1,
      height: 0.1,
    });

    processingMessage.value = "Reading card text...";
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") ocrProgress.value = m.progress;
      },
    });

    let nameText = "";
    let numberText = "";
    try {
      const nameResult = await worker.recognize(nameCanvas);
      nameText = nameResult.data.text || "";
      const numberResult = await worker.recognize(numberCanvas);
      numberText = numberResult.data.text || "";
    } finally {
      await worker.terminate();
    }

    const name = parseName(nameText);
    const number = parseNumber(numberText);
    detectedName.value = name;
    detectedNumber.value = number;

    processingMessage.value = "Looking up card...";
    let results: TcgCard[] = [];
    if (name && number) {
      results = await searchByNameAndNumber(name, number);
    }
    if (results.length === 0 && name) {
      results = await searchByName(name);
    }
    matches.value = results;
    stage.value = "matches";
  } catch (e) {
    console.error(e);
    matches.value = [];
    stage.value = "matches";
  }
};

const loadImage = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
};

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Crop to region, upscale, grayscale, contrast-stretch, threshold.
// Strips out holo color noise and glare so Tesseract sees clean text.
const preprocessRegion = (img: HTMLImageElement, region: Region): HTMLCanvasElement => {
  const sx = img.width * region.x;
  const sy = img.height * region.y;
  const sw = img.width * region.width;
  const sh = img.height * region.height;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imgData.data;
  const gray = new Uint8Array(px.length / 4);

  let min = 255;
  let max = 0;
  let sum = 0;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
    sum += g;
  }

  const range = max - min || 1;
  const meanNorm = ((sum / gray.length - min) / range) * 255;
  // Bias the threshold slightly above mean — text is darker than background.
  const threshold = Math.max(90, Math.min(180, meanNorm * 0.95));

  for (let j = 0; j < gray.length; j++) {
    const stretched = ((gray[j] - min) / range) * 255;
    const v = stretched > threshold ? 255 : 0;
    const i = j * 4;
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    px[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
};

const parseNumber = (raw: string): string => {
  // e.g. "020/189", "20/189", "020 / 189". Strip OCR junk first.
  const cleaned = raw.replace(/[^0-9/\s]/g, "");
  const m = cleaned.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (!m) return "";
  // Strip leading zeros; the TCG API expects "20" not "020".
  return m[1].replace(/^0+/, "") || "0";
};

const parseName = (raw: string): string => {
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Best candidate: longest mostly-alphabetic line.
  let best = "";
  let bestScore = 0;
  for (const line of lines) {
    const cleaned = line.replace(/[^A-Za-z\s'-]/g, "").trim();
    if (cleaned.length < 3) continue;
    const letters = (cleaned.match(/[A-Za-z]/g) || []).length;
    if (letters > bestScore) {
      bestScore = letters;
      best = cleaned;
    }
  }
  // Card names are usually 1-2 words. Limit to first 3 to avoid HP/type stragglers.
  return best ? best.split(/\s+/).slice(0, 3).join(" ") : "";
};

const runManualSearch = async () => {
  if (!manualSearch.value) return;
  searching.value = true;
  try {
    detectedName.value = manualSearch.value;
    detectedNumber.value = "";
    matches.value = await searchByName(manualSearch.value);
  } catch (e) {
    matches.value = [];
  } finally {
    searching.value = false;
  }
};

const resetToCamera = () => {
  matches.value = [];
  detectedName.value = "";
  detectedNumber.value = "";
  manualSearch.value = "";
  if (capturedPreview.value) {
    URL.revokeObjectURL(capturedPreview.value);
    capturedPreview.value = "";
  }
  capturedBlob.value = null;
  stage.value = "camera";
  startCamera();
};

const confirmMatch = async (match: TcgCard) => {
  if (saving.value) return;
  saving.value = true;
  stage.value = "saving";
  try {
    let scannedUrl = "";
    if (capturedBlob.value) {
      const file = new File([capturedBlob.value], `scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      try {
        scannedUrl = await uploadImage(file);
      } catch {
        scannedUrl = "";
      }
    }

    await addCard({
      cardName: match.name,
      cardSet: match.set.name,
      cardNumber: match.number,
      rarity: match.rarity || "",
      imageUrl: match.images.large || match.images.small,
      tcgApiId: match.id,
      scannedImageUrl: scannedUrl,
    });

    emit("added");
    close();
  } catch (e: any) {
    alert(e.message || "Failed to save card");
    stage.value = "matches";
  } finally {
    saving.value = false;
  }
};
</script>

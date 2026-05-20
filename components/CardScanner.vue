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
          Line up the card and tap capture, or drag a photo anywhere.
        </p>

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
const dragOver = ref(false);

const capturedBlob = ref<Blob | null>(null);
const capturedPreview = ref("");

const detectedName = ref("");
const detectedNumber = ref("");
const matches = ref<TcgCard[]>([]);
const manualSearch = ref("");
const searching = ref(false);
const saving = ref(false);

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

const handleDrop = async (event: DragEvent) => {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) {
    await processBlob(file);
  }
};

// dragleave fires when crossing child element borders — only clear when the
// pointer actually leaves the drop zone (relatedTarget outside).
const onDragLeave = (event: DragEvent) => {
  const current = event.currentTarget as HTMLElement | null;
  const related = event.relatedTarget as Node | null;
  if (current && related && current.contains(related)) return;
  dragOver.value = false;
};

// Phone photos are 3-5 MB; base64-encoded that's ~7 MB up the wire and a
// slow Gemini call. 1600px on the longest side keeps card text legible when
// the card only fills part of the frame, while shrinking the payload to
// ~350 KB.
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
      // Strip the "data:image/...;base64," prefix — Gemini wants raw base64.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });

const processBlob = async (blob: Blob) => {
  stopCamera();
  capturedBlob.value = blob;
  if (capturedPreview.value) URL.revokeObjectURL(capturedPreview.value);
  capturedPreview.value = URL.createObjectURL(blob);

  stage.value = "processing";

  try {
    processingMessage.value = "Identifying card...";
    const resized = await resizeBlob(blob);
    const imageBase64 = await blobToBase64(resized);
    const { name, number } = await $fetch<{ name: string; number: string }>(
      "/api/identify-card",
      {
        method: "POST",
        body: { imageBase64, mimeType: "image/jpeg" },
      },
    );

    detectedName.value = name;
    detectedNumber.value = number;

    processingMessage.value = "Looking up card...";
    let results: TcgCard[] = [];
    // number on alt-arts can exceed the printed total (e.g. 222/193), so the
    // TCG API may return nothing for the strict pair. Strip the "/total" and
    // search by just the card number when that happens.
    const cardNumber = number.includes("/") ? number.split("/")[0] : number;
    if (name && cardNumber) {
      results = await searchByNameAndNumber(name, cardNumber);
    }
    if (results.length === 0 && name) {
      results = await searchByName(name);
    }
    matches.value = results;
    stage.value = "matches";
  } catch (e: any) {
    console.error("identify-card failed:", e);
    matches.value = [];
    stage.value = "matches";
  }
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

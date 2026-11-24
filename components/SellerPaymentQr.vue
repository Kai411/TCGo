<template>
  <div>
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ink dark:text-zinc-100 mb-1">Counter payment QR</p>
        <p class="text-sm text-ink-muted dark:text-zinc-400">
          Your own DuitNow, TNG or bank QR. The POS shows it with the amount, the
          customer pays you directly, and you mark the sale paid.
        </p>
      </div>
      <button
        v-if="qr && !busy"
        class="shrink-0 text-sm font-semibold text-pokemon-red hover:underline"
        @click="pick"
      >
        Replace
      </button>
    </div>

    <!-- Saved -->
    <div v-if="qr" class="mt-3 flex items-center gap-4">
      <div class="w-28 h-28 shrink-0 rounded-xl bg-white p-1.5 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
        <img :src="qr" alt="Your payment QR" class="w-full h-full object-contain" />
      </div>
      <div class="min-w-0 space-y-1.5">
        <p class="text-sm text-ink-subtle dark:text-zinc-200">Shown on the POS when you choose QR.</p>
        <p class="text-micro text-ink-soft dark:text-zinc-500">
          Only you can see this. It's kept with your private details, not on your public profile.
        </p>
        <button
          class="text-label font-semibold text-ink-muted dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
          :disabled="busy"
          @click="remove"
        >
          Remove
        </button>
      </div>
    </div>

    <!-- Empty -->
    <button
      v-else
      type="button"
      :disabled="busy"
      class="mt-3 w-full flex items-center gap-3 rounded-xl border border-dashed border-black/[0.14] dark:border-white/[0.16] px-4 py-4 text-left hover:border-pokemon-red transition-colors disabled:opacity-60"
      @click="pick"
    >
      <span class="w-10 h-10 shrink-0 rounded-lg bg-ink/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
        <span v-if="busy" class="animate-spin rounded-full h-4 w-4 border-b-2 border-pokemon-red" />
        <svg v-else class="w-5 h-5 text-ink dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M17.5 14v7M14 17.5h7" />
        </svg>
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-ink dark:text-white">
          {{ busy ? "Uploading…" : "Upload your QR" }}
        </span>
        <span class="block text-micro text-ink-muted dark:text-zinc-400">
          A screenshot or photo from your bank or e-wallet app. Without one, the POS takes cash only.
        </span>
      </span>
    </button>

    <p v-if="warning" class="mt-2 text-label text-amber-700 dark:text-amber-300">{{ warning }}</p>
    <p v-if="error" class="mt-2 text-label text-rose-600 dark:text-rose-400">{{ error }}</p>

    <input ref="fileEl" type="file" accept="image/*" class="hidden" @change="onFile" />
  </div>
</template>

<script setup lang="ts">
const { profile, updateProfile } = useMyProfile();
const { uploadImage } = useStorage();

const qr = computed(() => profile.value?.posPaymentQr || "");
const fileEl = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const error = ref("");
const warning = ref("");

const pick = () => {
  error.value = "";
  fileEl.value?.click();
};

/**
 * Is there a readable QR in the picture? Advisory only: bank QR cards carry
 * logos and frames that can defeat the decoder, so a miss warns rather than
 * refusing the upload.
 */
const hasQr = async (file: File): Promise<boolean> => {
  try {
    const jsQR = (await import("jsqr")).default;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return true;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return !!jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return true;
  }
};

const onFile = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || busy.value) return;
  if (!file.type.startsWith("image/")) {
    error.value = "That isn't an image. Pick a screenshot or photo of your QR.";
    return;
  }
  busy.value = true;
  error.value = "";
  warning.value = "";
  try {
    const readable = await hasQr(file);
    const url = await uploadImage(file);
    await updateProfile({ posPaymentQr: url });
    if (!readable) {
      warning.value =
        "Saved, but we couldn't read a QR code in that image. Scan it with your own phone to check it works, or upload a clearer one.";
    }
  } catch {
    error.value = "Couldn't save your QR. Try again.";
  } finally {
    busy.value = false;
  }
};

const remove = async () => {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  warning.value = "";
  try {
    await updateProfile({ posPaymentQr: "" });
  } catch {
    error.value = "Couldn't remove it. Try again.";
  } finally {
    busy.value = false;
  }
};
</script>

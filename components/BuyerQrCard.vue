<template>
  <div class="rounded-xl border border-black/[0.08] p-5 dark:border-white/[0.10]">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-bold text-ink dark:text-white">Your customer code</h2>
        <p class="mt-1 text-[13px] leading-relaxed text-ink-muted dark:text-zinc-400">
          Show this at a TCGo shop counter and your receipt is emailed to you —
          no need to read your address out loud.
        </p>
      </div>
    </div>

    <div v-if="qr" class="mt-4 flex flex-col items-center">
      <!-- White plate regardless of theme: a dark-inverted QR is unreadable to
           a lot of scanners, and this exists to be scanned. -->
      <div class="rounded-xl bg-white p-3 shadow-sm">
        <img :src="qr" alt="Your TCGo customer code" width="180" height="180" class="block h-[180px] w-[180px]" />
      </div>
      <p class="mt-3 text-center text-[12px] text-ink-soft dark:text-zinc-500">
        It identifies your account, not your email — the shop only ever gets
        the address when they send a receipt.
      </p>
    </div>

    <p v-else-if="error" class="mt-4 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>
    <p v-else class="mt-4 text-[13px] text-ink-soft dark:text-zinc-500">Generating…</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { buyerQrPayload } from "~/shared/buyer-qr";

const { user } = useAuth();

const qr = ref("");
const error = ref("");

watch(
  () => user.value?.uid,
  async (uid) => {
    qr.value = "";
    error.value = "";
    if (!uid) return;
    try {
      // Loaded on demand — the library is only needed by people who open this
      // card, and it has no business in the main bundle.
      const mod: any = await import("qrcode");
      const QRCode = mod.default ?? mod;
      qr.value = await QRCode.toDataURL(buyerQrPayload(uid), {
        margin: 1,
        width: 360,
        // A counter scan happens in one motion at an awkward angle, often on a
        // phone screen with a fingerprint on it. H tolerates ~30% damage.
        errorCorrectionLevel: "H",
      });
    } catch (e: any) {
      error.value = e?.message || "Couldn't generate your code.";
    }
  },
  { immediate: true },
);
</script>

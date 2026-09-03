<template>
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
    @click.self="$emit('close')"
  >
    <div
      class="surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <!-- ── Choosing how to take the money ───────────────────────────── -->
      <template v-if="phase === 'choose'">
        <div class="flex items-baseline justify-between mb-1">
          <h3 class="text-base font-bold text-ink dark:text-white">Take payment</h3>
          <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums">
            RM {{ total.toFixed(2) }}
          </p>
        </div>
        <p v-if="discountTotal > 0" class="text-xs text-amber-600 dark:text-amber-400 mb-4">
          RM {{ discountTotal.toFixed(2) }} off {{ discountedCount }}
          {{ discountedCount === 1 ? "item" : "items" }}
        </p>
        <p v-else class="text-xs text-gray-500 dark:text-zinc-400 mb-4">
          {{ count }} {{ count === 1 ? "item" : "items" }}
        </p>

        <div class="space-y-2">
          <button
            v-if="qrEnabled"
            @click="$emit('pay', 'duitnow_qr')"
            class="w-full flex items-center gap-3 p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.10] hover:border-pokemon-red transition-colors text-left"
          >
            <span class="w-9 h-9 shrink-0 rounded-lg bg-ink/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
              <svg class="w-5 h-5 text-ink dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM19 19h2M17 21h4" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink dark:text-white">DuitNow QR</span>
              <span class="block text-[11px] text-gray-500 dark:text-zinc-400">
                Customer scans with any banking app
              </span>
            </span>
          </button>

          <!-- Kept visible rather than hidden: sellers were promised it on the
               landing page, so saying "not yet" beats saying nothing. -->
          <div
            class="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.10] opacity-60 cursor-not-allowed"
          >
            <span class="w-9 h-9 shrink-0 rounded-lg bg-ink/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
              <svg class="w-5 h-5 text-ink dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 8.5a8 8 0 0 1 0 7M9.5 5.5a13 13 0 0 1 0 13" />
                <rect x="12" y="4" width="9" height="16" rx="2" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink dark:text-white">Tap to pay</span>
              <span class="block text-[11px] text-gray-500 dark:text-zinc-400">Coming soon</span>
            </span>
          </div>

          <button
            @click="$emit('pay', 'cash')"
            class="w-full flex items-center gap-3 p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.10] hover:border-pokemon-red transition-colors text-left"
          >
            <span class="w-9 h-9 shrink-0 rounded-lg bg-ink/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
              <svg class="w-5 h-5 text-ink dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink dark:text-white">Cash</span>
              <span class="block text-[11px] text-gray-500 dark:text-zinc-400">
                Record the sale, no payment taken
              </span>
            </span>
          </button>
        </div>

        <button
          @click="$emit('close')"
          class="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold text-ink-subtle dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08]"
        >
          Back
        </button>
      </template>

      <!-- ── Reserving stock / talking to the acquirer ────────────────── -->
      <template v-else-if="phase === 'starting'">
        <div class="py-10 text-center">
          <span class="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-pokemon-red" />
          <p class="mt-4 text-sm font-medium text-ink dark:text-white">Holding the cards…</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            Making sure nobody buys them online while you take payment.
          </p>
        </div>
      </template>

      <!-- ── The QR itself ───────────────────────────────────────────── -->
      <template v-else-if="phase === 'awaiting'">
        <div class="text-center">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            DuitNow QR
          </p>
          <p class="mt-1 text-2xl font-extrabold text-ink dark:text-white tabular-nums">
            RM {{ total.toFixed(2) }}
          </p>

          <div class="mt-4 mx-auto w-56 h-56 rounded-2xl bg-white p-3 shadow-card flex items-center justify-center">
            <img v-if="qrImage" :src="qrImage" alt="DuitNow QR code" class="w-full h-full" />
            <span v-else class="text-xs text-gray-400">Generating…</span>
          </div>

          <p class="mt-4 text-sm text-ink dark:text-white font-medium">
            Ask the customer to scan this
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            Any Malaysian banking or e-wallet app
          </p>

          <!-- A decline is not the end of the sale: the same QR still
               works, and most customers just try another account. -->
          <div
            v-if="attemptDeclined"
            class="mt-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 px-3 py-2"
          >
            <p class="text-xs font-bold text-amber-800 dark:text-amber-200">
              That payment was declined
            </p>
            <p class="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              The QR still works — ask them to try again, or cancel and take cash.
            </p>
          </div>

          <div class="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
            <span class="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
            Waiting for payment
            <span v-if="secondsLeft > 0" class="tabular-nums">· {{ countdown }}</span>
          </div>

          <button
            @click="$emit('cancel')"
            :disabled="cancelling"
            class="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold text-ink-subtle dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] disabled:opacity-50"
          >
            {{ cancelling ? "Cancelling…" : "Cancel payment" }}
          </button>
        </div>
      </template>

      <!-- ── Done ────────────────────────────────────────────────────── -->
      <template v-else-if="phase === 'paid'">
        <div class="py-8 text-center">
          <div class="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <svg class="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p class="mt-4 text-lg font-bold text-ink dark:text-white">Paid</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            RM {{ total.toFixed(2) }} · {{ count }} {{ count === 1 ? "item" : "items" }} marked sold
          </p>

          <!-- Receipt.
               Offered after payment rather than before: asking for an email
               while a customer is holding a phone up to a QR is asking them to
               do two things at once, and the sale is already recorded whether
               or not this succeeds. -->
          <div class="mt-6 text-left">
            <p v-if="receiptSentTo" class="rounded-xl bg-emerald-500/10 px-3.5 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">
              Receipt sent to <span class="font-semibold">{{ receiptSentTo }}</span>.
            </p>

            <template v-else>
              <label class="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-zinc-400">
                Email a receipt <span class="font-normal">— optional</span>
              </label>
              <div class="flex gap-2">
                <input
                  v-model="receiptEmail"
                  type="email"
                  inputmode="email"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="customer@email.com"
                  class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-pokemon-red dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-white"
                  @keydown.enter.prevent="$emit('send-receipt', receiptEmail)"
                />
                <button
                  type="button"
                  :disabled="sendingReceipt || !receiptEmail.trim()"
                  @click="$emit('send-receipt', receiptEmail)"
                  class="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-ink"
                >
                  {{ sendingReceipt ? "Sending…" : "Send" }}
                </button>
              </div>

              <button
                type="button"
                @click="$emit('scan-buyer')"
                class="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-pokemon-red hover:underline"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
                Scan their TCGo code instead
              </button>

              <p v-if="receiptError" class="mt-2 text-[12.5px] text-rose-600 dark:text-rose-400">
                {{ receiptError }}
              </p>
            </template>
          </div>

          <button
            @click="$emit('close')"
            class="w-full mt-4 py-3 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600"
          >
            New sale
          </button>
        </div>
      </template>

      <template v-else-if="phase === 'failed'">
        <div class="py-8 text-center">
          <div class="mx-auto w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg class="w-7 h-7 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p class="mt-4 text-lg font-bold text-ink dark:text-white">Payment didn't go through</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            {{ failedReason || "Nothing was charged. The cards are back on sale." }}
          </p>
          <div class="flex gap-2 mt-6">
            <button
              @click="$emit('close')"
              class="flex-1 py-3 rounded-xl text-sm font-semibold border border-black/[0.06] dark:border-white/[0.08] text-ink-subtle dark:text-zinc-300"
            >
              Close
            </button>
            <button
              @click="$emit('retry')"
              class="flex-1 py-3 rounded-xl text-sm font-bold bg-ink text-white dark:bg-white dark:text-ink"
            >
              Try again
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PosPaymentMethod } from "~/shared/pos-sale";

const receiptEmail = ref("");

const props = defineProps<{
  phase: "choose" | "starting" | "awaiting" | "paid" | "failed";
  total: number;
  discountTotal: number;
  discountedCount: number;
  count: number;
  qrImage: string;
  /** Epoch ms when the hold lapses. */
  reservedUntil: number;
  cancelling: boolean;
  /** Set once a receipt has gone out, so the form gives way to a confirmation. */
  receiptSentTo?: string;
  sendingReceipt?: boolean;
  receiptError?: string;
  /** Latest attempt declined, but the QR is still live for a retry. */
  attemptDeclined: boolean;
  failedReason: string;
  qrEnabled: boolean;
}>();

defineEmits<{
  (e: "pay", method: PosPaymentMethod): void;
  (e: "cancel"): void;
  (e: "close"): void;
  (e: "retry"): void;
  (e: "send-receipt", email: string): void;
  (e: "scan-buyer"): void;
}>();

// A live countdown, so the seller can see the hold is finite rather than
// wondering whether the till has frozen.
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  tick = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
  if (tick) clearInterval(tick);
});

const secondsLeft = computed(() =>
  props.reservedUntil ? Math.max(0, Math.round((props.reservedUntil - now.value) / 1000)) : 0,
);
const countdown = computed(() => {
  const s = secondsLeft.value;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
});
</script>

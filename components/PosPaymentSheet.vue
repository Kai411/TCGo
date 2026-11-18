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
            v-if="shopQr"
            @click="$emit('pay', 'shop_qr')"
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
              <span class="block text-sm font-semibold text-ink dark:text-white">Your shop's QR</span>
              <span class="block text-micro text-gray-500 dark:text-zinc-400">
                Customer scans it and pays you directly
              </span>
            </span>
          </button>

          <!-- No QR saved yet. Shown in place of the option rather than
               hidden, so the seller learns where QR payments come from. -->
          <NuxtLink
            v-else
            to="/seller/settings#payment-qr"
            class="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-black/[0.12] dark:border-white/[0.14] hover:border-pokemon-red transition-colors text-left"
          >
            <span class="w-9 h-9 shrink-0 rounded-lg bg-ink/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
              <svg class="w-5 h-5 text-ink-muted dark:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M17.5 14v7M14 17.5h7" />
              </svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink dark:text-white">Add your shop's QR</span>
              <span class="block text-micro text-gray-500 dark:text-zinc-400">
                Upload your DuitNow, TNG or bank QR in Seller settings to take QR payments
              </span>
            </span>
            <span class="shrink-0 text-xs font-semibold text-pokemon-red">Set up</span>
          </NuxtLink>

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
              <span class="block text-micro text-gray-500 dark:text-zinc-400">Coming soon</span>
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
              <span class="block text-micro text-gray-500 dark:text-zinc-400">
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

      <!-- ── Reserving stock ─────────────────────────────────────────── -->
      <template v-else-if="phase === 'starting'">
        <div class="py-10 text-center">
          <span class="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-pokemon-red" />
          <p class="mt-4 text-sm font-medium text-ink dark:text-white">Holding the cards…</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            Making sure nobody buys them online while you take payment.
          </p>
        </div>
      </template>

      <!-- ── The shop's own QR ───────────────────────────────────────────
           Turned toward the customer. The amount is the biggest thing on
           screen because a static QR doesn't carry one: the customer types
           it into their app, so it has to be readable from across a counter. -->
      <template v-else-if="phase === 'awaiting'">
        <div class="text-center">
          <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">Scan to pay</p>
          <p class="mt-1 text-3xl font-extrabold text-ink dark:text-white tabular-nums">
            RM {{ total.toFixed(2) }}
          </p>

          <div class="mt-4 mx-auto w-60 max-w-full aspect-square rounded-2xl bg-white p-2 shadow-card flex items-center justify-center overflow-hidden">
            <img :src="shopQr" alt="Shop payment QR code" class="w-full h-full object-contain" />
          </div>

          <p class="mt-4 text-sm text-ink dark:text-white font-medium">
            Ask the customer to pay exactly RM {{ total.toFixed(2) }}
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-zinc-400">
            Check the money arrived in your bank or e-wallet app, then mark it paid.
          </p>

          <p
            class="mt-3 text-xs tabular-nums"
            :class="secondsLeft > 0 ? 'text-gray-500 dark:text-zinc-400' : 'text-amber-700 dark:text-amber-300 font-semibold'"
          >
            <template v-if="secondsLeft > 0">Cards held for {{ countdown }}</template>
            <template v-else>The hold ended. Mark paid only if the money arrived.</template>
          </p>

          <p v-if="markError" class="mt-3 text-label text-rose-600 dark:text-rose-400">
            {{ markError }}
          </p>

          <button
            @click="$emit('mark-paid')"
            :disabled="marking || cancelling"
            class="w-full mt-5 py-3 rounded-xl text-sm font-bold bg-pokemon-red text-white hover:bg-pokemon-red-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="marking" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            {{ marking ? "Marking paid…" : "Mark as paid" }}
          </button>
          <button
            @click="$emit('cancel')"
            :disabled="cancelling || marking"
            class="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-ink-subtle dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] disabled:opacity-50"
          >
            {{ cancelling ? "Cancelling…" : "Cancel sale" }}
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
            <p v-if="receiptSentTo" class="rounded-xl bg-emerald-500/10 px-3.5 py-3 text-label text-emerald-700 dark:text-emerald-300">
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
                  class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-ui text-ink outline-none focus:border-pokemon-red dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-white"
                  @keydown.enter.prevent="$emit('send-receipt', receiptEmail)"
                />
                <button
                  type="button"
                  :disabled="sendingReceipt || !receiptEmail.trim()"
                  @click="$emit('send-receipt', receiptEmail)"
                  class="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-label font-bold text-white disabled:opacity-40 dark:bg-white dark:text-ink"
                >
                  {{ sendingReceipt ? "Sending…" : "Send" }}
                </button>
              </div>

              <button
                type="button"
                @click="$emit('scan-buyer')"
                class="mt-2 inline-flex items-center gap-1.5 text-label font-semibold text-pokemon-red hover:underline"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </svg>
                Scan their TCGo code instead
              </button>

              <p v-if="receiptError" class="mt-2 text-label text-rose-600 dark:text-rose-400">
                {{ receiptError }}
              </p>
            </template>
          </div>

          <button
            @click="$emit('close')"
            class="w-full mt-4 py-3 rounded-xl text-sm font-semibold bg-pokemon-red text-white hover:bg-pokemon-red-dark transition-colors"
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
          <p class="mt-4 text-lg font-bold text-ink dark:text-white">Sale not completed</p>
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
  /** The seller's own payment QR image. Empty when none is saved. */
  shopQr: string;
  /** Epoch ms when the hold lapses. */
  reservedUntil: number;
  cancelling: boolean;
  /** "Mark as paid" in flight, and why it last failed. */
  marking: boolean;
  markError?: string;
  /** Set once a receipt has gone out, so the form gives way to a confirmation. */
  receiptSentTo?: string;
  sendingReceipt?: boolean;
  receiptError?: string;
  failedReason: string;
}>();

defineEmits<{
  (e: "pay", method: PosPaymentMethod): void;
  (e: "mark-paid"): void;
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

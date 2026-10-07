<template>
  <div class="max-w-3xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to view your funds.</p>
      <button @click="goToLogin" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">Sign in</button>
    </div>

    <template v-else>
      <div class="flex items-center gap-2 mb-1">
        <NuxtLink to="/seller" class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Dashboard
        </NuxtLink>
      </div>
      <h1 class="text-2xl font-bold text-ink dark:text-white mb-1">Your funds</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Money collected from your online (FPX) sales, held by TCGo until payout. In-person (POS) sales aren't shown here — you receive those directly.
      </p>

      <!-- Available — the hero card.
           Deliberately NOT the brand red: money you're owed is good news, and a
           red gradient made the primary balance read like an error banner. Dark
           ink keeps the hero weight; emerald carries the "ready" meaning. -->
      <div
        class="relative overflow-hidden rounded-2xl p-5 mb-3 bg-ink dark:bg-[#202027] border border-transparent dark:border-white/[0.08]"
      >
        <!-- Soft emerald wash, purely decorative -->
        <div
          class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40"
          style="background: radial-gradient(50% 50% at 50% 50%, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0) 100%)"
          aria-hidden="true"
        />
        <div class="relative">
          <p class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Available for payout
          </p>
          <p class="text-3xl sm:text-4xl font-bold tabular-price text-white mt-2 tracking-tightest">
            RM {{ fmt(availableTotal) }}
          </p>
          <!-- The fee is stated before the button, not after. A seller who
               reads "available RM 40" and banks RM 38.75 has been surprised
               by their own money, which is the one surprise to never allow. -->
          <p v-if="availableTotal > 0" class="text-xs text-white/70 mt-2">
            Withdrawing costs RM {{ fmt(withdrawalFee) }}, so
            <span class="font-semibold text-white">RM {{ fmt(Math.max(0, payoutPreview)) }}</span>
            reaches your bank. It's charged per payout, not per order — one
            request covering ten sales costs the same as one covering a single
            card.
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <button
              @click="doRequestPayout"
              :disabled="!canWithdraw || requesting"
              class="px-4 py-2 rounded-lg text-sm font-bold bg-white text-ink hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <span v-if="requesting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-ink" />
              Request payout
            </button>
            <p v-if="bankLine" class="text-xs text-white/70 min-w-0 truncate">to {{ bankLine }}</p>
          </div>
          <p v-if="!bankLine" class="text-xs text-white/70 mt-2">
            <NuxtLink to="/seller/verify" class="underline font-semibold text-white">Add your bank account</NuxtLink>
            to receive payouts.
          </p>
          <!-- A failed transfer IS a problem, so this one keeps a warning tone. -->
          <p
            v-if="lastFailureReason"
            class="text-xs text-amber-100 mt-3 bg-amber-500/20 border border-amber-400/30 rounded-lg px-3 py-2"
          >
            A previous transfer didn't go through ({{ lastFailureReason }}). The funds are
            available again — check your bank details and request once more.
          </p>
        </div>
      </div>

      <!-- Pending + Locked + Paid this month -->
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <NuxtLink
          to="/seller/payouts"
          class="surface rounded-xl p-4 hover:shadow-card-hover transition-shadow"
        >
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400" />
            <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">Pending payout</p>
            <svg class="w-3 h-3 ml-auto text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </div>
          <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums mt-1">RM {{ fmt(queuedTotal) }}</p>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
            {{ queued.length }} order{{ queued.length === 1 ? "" : "s" }} · {{ pendingCaption }}
          </p>
        </NuxtLink>

        <NuxtLink
          to="/seller/funds/locked"
          class="surface rounded-xl p-4 hover:shadow-card-hover transition-shadow"
        >
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-gray-300 dark:bg-zinc-600" />
            <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">Locked</p>
            <svg class="w-3 h-3 ml-auto text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </div>
          <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums mt-1">RM {{ fmt(lockedTotal) }}</p>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
            {{ locked.length }} order{{ locked.length === 1 ? "" : "s" }} · until delivered + {{ holdDays }}d
          </p>
        </NuxtLink>

        <!-- Paid this month. Counts money that actually landed, keyed off
             payoutPaidAt, so it can't be inflated by a requested-but-unpaid
             batch. -->
        <div class="surface rounded-xl p-4 col-span-2 lg:col-span-1">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500" />
            <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">Paid this month</p>
          </div>
          <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums mt-1">RM {{ fmt(paidThisMonthTotal) }}</p>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
            {{ paidThisMonth.length }} order{{ paidThisMonth.length === 1 ? "" : "s" }} · {{ monthLabel }}
          </p>
        </div>
      </div>

      <!-- Payout status.
           "Pending payout" was a single number with no way to tell whether a
           request was still waiting on us or already moving at the bank. These
           are genuinely different states and the seller is entitled to know
           which one their money is in. -->
      <section v-if="queued.length" class="mb-6">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
          Payout status
        </p>
        <div class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          <div v-for="e in queued" :key="e.order.id" class="flex items-center gap-3 px-3 py-2.5">
            <span class="shrink-0 w-2 h-2 rounded-full" :class="payoutDot(e)" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink dark:text-white truncate">
                {{ e.order.buyerName }} · {{ e.order.items.length }} item{{ e.order.items.length === 1 ? "" : "s" }}
              </p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400">{{ payoutStage(e) }}</p>
            </div>
            <span class="shrink-0 text-sm font-bold text-ink dark:text-white tabular-nums">RM {{ fmt(e.amount) }}</span>
          </div>
        </div>
        <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-2">
          Bank transfers usually land the next working day once submitted.
        </p>
      </section>


      <!-- Payout history -->
      <section>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">Payout history</p>
        <p v-if="!paidOut.length" class="text-sm text-gray-400 dark:text-zinc-500 py-3">No payouts yet.</p>
        <div v-else class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          <div v-for="e in paidOut" :key="e.order.id" class="flex items-center gap-3 px-3 py-2.5">
            <div class="w-8 h-8 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink dark:text-white truncate">{{ e.order.buyerName }}</p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400">Paid out{{ e.order.payoutPaidAt ? " · " + fmtDate(e.order.payoutPaidAt) : "" }}</p>
            </div>
            <span class="shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">RM {{ fmt(e.amount) }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PAYOUT_HOLD_DAYS, type FundEntry } from "~/composables/useSellerFunds";
import { bankName, resolveBankCode } from "~/shared/banks";
import { payoutDetailsComplete } from "~/shared/payout-details";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Funds | TCGo" });

const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { profile } = useMyProfile();
const { listenSellerCompiledOrders } = useCompiledOrders();
const {
  available,
  locked,
  queued,
  paidOut,
  availableTotal,
  withdrawalFee,
  payoutPreview,
  canWithdraw,
  lockedTotal,
  queuedTotal,
  lastFailureReason,
  requestPayout,
} = useSellerFunds();

const holdDays = PAYOUT_HOLD_DAYS;

// ── Paid this month ───────────────────────────────────────────────────
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
const monthLabel = new Date().toLocaleDateString("en-MY", { month: "long" });
const paidThisMonth = computed(() =>
  paidOut.value.filter((e) => (e.order.payoutPaidAt ?? 0) >= monthStart),
);
const paidThisMonthTotal = computed(
  () => Math.round(paidThisMonth.value.reduce((t, e) => t + e.amount, 0) * 100) / 100,
);

// A payout Billplz already settled shows as pending until something tells us.
// The callback is the primary path; this is the self-heal for one that never
// arrived, so the seller is never stuck waiting on an admin.
const { authedFetch: syncFetch } = useAuthedFetch();
const syncPayouts = async () => {
  try {
    await syncFetch("/api/payouts/sync-mine", { method: "POST" });
  } catch {
    /* best effort — the page still renders from Firestore */
  }
};
onMounted(() => { if (user.value) void syncPayouts(); });
watch(user, (u) => { if (u) void syncPayouts(); });

// categorizeFunds folds both into "queued", but they mean different things:
//   queued     -> request received, waiting for TCGo to submit the batch
//   processing -> submitted to the bank, transfer in flight
const isSubmitted = (e: FundEntry) => e.order.payoutStatus === "processing";

const payoutStage = (e: FundEntry) =>
  isSubmitted(e)
    ? "Sent to the bank - transfer in progress"
    : "Requested - awaiting approval";

const payoutDot = (e: FundEntry) =>
  isSubmitted(e) ? "bg-blue-500" : "bg-amber-400";

const pendingCaption = computed(() =>
  queued.value.some(isSubmitted) ? "transfer in progress" : "awaiting approval",
);

onMounted(() => {
  if (user.value) listenSellerCompiledOrders();
});
watch(user, (u) => {
  if (u) listenSellerCompiledOrders();
});

const fmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

// Empty unless we have *everything* Billplz needs to transfer — a partially
// filled bank section must not read as "ready to be paid".
const bankLine = computed(() => {
  const p = profile.value;
  if (!payoutDetailsComplete(p)) return "";
  const tail = p!.bankAccountNumber!.slice(-4);
  return `${bankName(resolveBankCode(p!.bankCode, p!.bankName))} ••••${tail}`;
});

const requesting = ref(false);
const doRequestPayout = async () => {
  if (requesting.value || !canWithdraw.value) return;
  if (!bankLine.value) {
    if (confirm("Add your bank account and IC number first to receive payouts. Go to verification?")) {
      navigateTo("/seller/verify");
    }
    return;
  }
  if (
    !confirm(
      `Withdraw RM ${fmt(availableTotal.value)} to ${bankLine.value}?\n\n` +
        `Withdrawal fee  −RM ${fmt(withdrawalFee)}\n` +
        `Reaches your bank  RM ${fmt(payoutPreview.value)}`,
    )
  )
    return;
  requesting.value = true;
  try {
    const res = await requestPayout();
    alert(
      `RM ${fmt(res.amount)} on its way for ${res.orders} order${res.orders === 1 ? "" : "s"} ` +
        `(RM ${fmt(res.grossAmount)} less the RM ${fmt(res.withdrawalFee)} withdrawal fee). ` +
        `We'll transfer to your bank shortly.`,
    );
  } catch (e: any) {
    alert(e?.data?.message || e?.message || "Couldn't request payout. Please try again.");
  } finally {
    requesting.value = false;
  }
};
</script>

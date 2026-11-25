<template>
  <div class="sl-page sl-page--narrow">
    <SellerGate v-if="!user" message="Sign in to view your funds." />

    <template v-else>
      <SellerPageHead
        title="Funds"
        description="Money from your online (FPX) sales, held by TCGo until you ask for a payout. In-person (POS) sales go straight to you, so they aren't here."
      />

      <!-- The one thing to do here: withdraw what's available. -->
      <section class="mc-card mc-card-pad">
        <p class="mc-label flex items-center gap-2">
          <span class="mc-dot" data-tone="good" aria-hidden="true" />
          Available for payout
        </p>
        <p class="mc-hero-value mc-num mt-1">RM {{ fmt(availableTotal) }}</p>
        <p v-if="availableTotal > 0" class="mc-small mt-1.5">
          After the RM {{ fmt(withdrawalFee) }} withdrawal fee,
          <span class="mc-num font-semibold text-[var(--ink-2)]">RM {{ fmt(Math.max(0, payoutPreview)) }}</span>
          reaches your bank. The fee is per payout, not per order, so one
          request covering ten sales costs the same as one.
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            class="mc-btn mc-btn-primary"
            :disabled="!canWithdraw || requesting || !!lockEnds"
            @click="doRequestPayout"
          >
            <span v-if="requesting" class="sf-spin" aria-hidden="true" />
            Request payout
          </button>
          <span v-if="bankLine" class="mc-meta min-w-0 truncate">to {{ bankLine }}</span>
        </div>

        <p v-if="lockText" class="mc-callout mt-3" role="status">{{ lockText }}</p>
        <p v-if="!bankLine" class="mc-callout mt-3">
          <NuxtLink to="/seller/settings#bank" class="font-semibold underline underline-offset-2">Add your bank account</NuxtLink>
          to receive payouts.
        </p>
        <p v-if="lastFailureReason" class="mc-callout mt-3" data-tone="bad">
          A previous transfer didn't go through ({{ lastFailureReason }}). The
          money is available again. Check your bank details and request once more.
        </p>
      </section>

      <!-- Where the rest of the money is. -->
      <div class="mc-card mc-cells mt-3" data-cols="3">
        <NuxtLink to="/seller/payouts" class="mc-cell-btn">
          <span class="mc-label flex items-center gap-2">
            <span class="mc-dot" data-tone="warn" aria-hidden="true" />
            Payout requested
          </span>
          <span class="mc-stat-value mc-num mt-1 block">RM {{ fmt(queuedTotal) }}</span>
          <span class="mc-small mt-1 block">
            {{ queued.length }} order{{ queued.length === 1 ? "" : "s" }} · {{ pendingCaption }}
          </span>
        </NuxtLink>
        <NuxtLink to="/seller/funds/locked" class="mc-cell-btn">
          <span class="mc-label flex items-center gap-2">
            <span class="mc-dot" aria-hidden="true" />
            Locked
          </span>
          <span class="mc-stat-value mc-num mt-1 block">RM {{ fmt(lockedTotal) }}</span>
          <span class="mc-small mt-1 block">
            {{ locked.length }} order{{ locked.length === 1 ? "" : "s" }} · until delivered + {{ holdDays }} days
          </span>
        </NuxtLink>
        <div>
          <span class="mc-label flex items-center gap-2">
            <span class="mc-dot" data-tone="info" aria-hidden="true" />
            Paid out this month
          </span>
          <span class="mc-stat-value mc-num mt-1 block">RM {{ fmt(paidThisMonthTotal) }}</span>
          <span class="mc-small mt-1 block">
            {{ paidThisMonth.length }} order{{ paidThisMonth.length === 1 ? "" : "s" }} · {{ monthLabel }}
          </span>
        </div>
      </div>

      <section v-if="queued.length" class="mc-section">
        <h2 class="mc-h2 mb-2.5">On its way</h2>
        <div class="mc-card overflow-hidden">
          <div v-for="e in queued" :key="e.order.id" class="mc-row">
            <span class="mc-dot" :data-tone="isSubmitted(e) ? 'info' : 'warn'" aria-hidden="true" />
            <div class="min-w-0">
              <p class="mc-row-title">
                {{ e.order.buyerName }} · {{ e.order.items.length }} item{{ e.order.items.length === 1 ? "" : "s" }}
              </p>
              <p class="mc-meta">{{ payoutStage(e) }}</p>
            </div>
            <span class="mc-num font-semibold">RM {{ fmt(e.amount) }}</span>
          </div>
        </div>
        <p class="mc-small mt-2">Bank transfers usually land the next working day once sent.</p>
      </section>

      <section class="mc-section">
        <div class="mc-section-head !mb-2.5">
          <h2 class="mc-h2">Paid out</h2>
          <NuxtLink to="/seller/payouts" class="mc-btn mc-btn-ghost mc-btn-sm">All payouts</NuxtLink>
        </div>
        <div class="mc-card overflow-hidden">
          <p v-if="!paidOut.length" class="mc-empty">No payouts yet.</p>
          <div v-for="e in paidOut" v-else :key="e.order.id" class="mc-row">
            <span class="mc-dot" data-tone="good" aria-hidden="true" />
            <div class="min-w-0">
              <p class="mc-row-title">{{ e.order.buyerName }}</p>
              <p class="mc-meta">Paid out{{ e.order.payoutPaidAt ? " · " + fmtDate(e.order.payoutPaidAt) : "" }}</p>
            </div>
            <span class="mc-num font-semibold">RM {{ fmt(e.amount) }}</span>
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
const { lockedUntil: lockEnds, lockText } = useSecurityLock();

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
  isSubmitted(e) ? "Sent to the bank, transfer in progress" : "Requested, awaiting approval";

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
  if (requesting.value || !canWithdraw.value || lockEnds.value) return;
  if (!bankLine.value) {
    if (confirm("Add your bank account and IC number first to receive payouts. Go to Seller settings?")) {
      navigateTo("/seller/settings#bank");
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
        (res.held
          ? `${res.heldMessage || "Our team will check your account before sending it."}`
          : `We'll transfer to your bank shortly.`),
    );
  } catch (e: any) {
    alert(e?.data?.message || e?.message || "Couldn't request payout. Please try again.");
  } finally {
    requesting.value = false;
  }
};
</script>

<style>
.sf-spin {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: sf-spin 0.7s linear infinite;
}
@keyframes sf-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

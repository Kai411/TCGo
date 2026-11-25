<template>
  <div class="sl-page sl-page--narrow">
    <SellerGate v-if="!user" message="Sign in to view your payouts." />

    <template v-else>
      <SellerPageHead
        title="Payouts"
        back="/seller/funds"
        back-label="Funds"
        description="Every payout you've requested, newest first. Open one for its full history."
      >
        <button type="button" class="mc-btn mc-btn-sm" :disabled="loading" @click="reload">
          {{ loading ? "Checking…" : "Refresh" }}
        </button>
      </SellerPageHead>

      <div v-if="loading && !payouts.length" class="mc-skel h-[160px]" aria-busy="true" aria-label="Loading payouts" />

      <div v-else-if="!payouts.length" class="mc-card mc-empty">
        <span class="font-semibold text-[var(--ink-2)]">No payouts yet.</span>
        Once funds unlock and you request a payout, it shows up here with its full history.
      </div>

      <div v-else class="mc-card overflow-hidden">
        <NuxtLink v-for="p in payouts" :key="p.id" :to="`/seller/payouts/${p.id}`" class="mc-row">
          <span class="mc-dot" :data-tone="toneFor(p.status)" aria-hidden="true" />
          <div class="min-w-0">
            <p class="mc-row-title mc-num">RM {{ fmt(p.amount) }}</p>
            <p class="mc-meta truncate">
              {{ p.orderIds?.length ?? 0 }} order{{ (p.orderIds?.length ?? 0) === 1 ? "" : "s" }}
              · {{ p.recipient?.bankName }} {{ p.recipient?.bankAccountNumber }}
              · {{ when(p.requestedAt) }}
            </p>
          </div>
          <span class="mc-meta flex items-center gap-2">
            {{ LABEL[p.status] }}
            <svg class="w-4 h-4 mc-ink-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </span>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PAYOUT_STATUS_LABEL as LABEL, type PayoutBatch } from "~/shared/payout-ledger";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Payouts | TCGo" });

const {user} = useAuth();
const { authedFetch } = useAuthedFetch();

const payouts = ref<PayoutBatch[]>([]);
const loading = ref(false);

const load = async () => {
  if (!user.value) return;
  loading.value = true;
  try {
    const res = await authedFetch<{ payouts: PayoutBatch[] }>("/api/payouts/mine");
    payouts.value = res.payouts ?? [];
  } finally {
    loading.value = false;
  }
};

// Reconcile before reading: a callback Billplz never managed to deliver would
// otherwise leave this list showing "in progress" for an already-paid transfer.
const reload = async () => {
  loading.value = true;
  try {
    await authedFetch("/api/payouts/sync-mine", { method: "POST" }).catch(() => {});
  } finally {
    await load();
  }
};

onMounted(() => { if (user.value) void reload(); });
watch(user, (u) => { if (u) void reload(); });

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (t?: number) =>
  t ? new Date(t).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "";

const toneFor = (s: PayoutBatch["status"]) =>
  ({ queued: "warn", processing: "info", paid: "good", failed: "bad" })[s];
</script>

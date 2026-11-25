<template>
  <div class="sl-page sl-page--narrow">
    <SellerPageHead title="Payout" back="/seller/payouts" back-label="All payouts" />

    <div v-if="loading" class="mc-skel h-[200px]" aria-busy="true" aria-label="Loading payout" />

    <div v-else-if="!payout" class="mc-card mc-empty">
      <span class="font-semibold text-[var(--ink-2)]">Payout not found.</span>
      It may belong to another account.
    </div>

    <template v-else>
      <section class="mc-card">
        <div class="mc-card-pad">
          <p class="mc-label flex items-center gap-2">
            <span class="mc-dot" :data-tone="toneFor(payout.status)" aria-hidden="true" />
            {{ LABEL[payout.status] }}
          </p>
          <p class="mc-hero-value mc-num mt-1">RM {{ fmt(payout.amount) }}</p>
          <p v-if="nextStep" class="mc-small mt-1.5">{{ nextStep }}</p>
          <p v-if="payout.status === 'queued' && payout.identityHold" class="mc-callout mt-3">
            The account name doesn't match the name on your verified ID, so our
            team checks the account before sending. Nothing is needed from you
            unless we get in touch.
          </p>
          <p v-if="payout.status === 'failed' && payout.failureReason" class="mc-callout mt-3" data-tone="bad">
            {{ payout.failureReason }}. The money was released back and can be requested again.
          </p>
        </div>
        <div class="mc-divider mc-cells" style="--cols: 2">
          <div>
            <p class="mc-label">To</p>
            <p class="mt-1 font-semibold">
              {{ payout.recipient?.bankName }}
              <span class="mc-num font-normal text-[var(--ink-2)]">{{ payout.recipient?.bankAccountNumber }}</span>
            </p>
          </div>
          <div>
            <p class="mc-label">Orders</p>
            <p class="mt-1 font-semibold mc-num">{{ payout.orderIds?.length ?? 0 }}</p>
          </div>
        </div>
      </section>

      <section class="mc-section">
        <h2 class="mc-h2 mb-2.5">Status history</h2>
        <div class="mc-card mc-card-pad">
          <ol>
            <li v-for="(e, i) in history" :key="e.key" class="relative flex gap-3 pb-5 last:pb-0">
              <span v-if="i < history.length - 1" class="pd-line" aria-hidden="true" />
              <span class="mc-dot relative mt-1.5" :data-tone="historyTone(e.key)" aria-hidden="true" />
              <div class="min-w-0 flex-1">
                <p class="font-semibold">{{ e.label }}</p>
                <p v-if="e.detail" class="mc-meta mt-0.5">{{ e.detail }}</p>
                <p class="mc-small mc-num mt-0.5">{{ stamp(e.at) }}</p>
              </div>
            </li>
          </ol>
          <p v-if="payout.status === 'processing'" class="mc-small mt-3">
            Waiting on the bank. This page checks for an update each time you open it.
          </p>
        </div>
      </section>

      <section v-if="payout.orderIds?.length" class="mc-section">
        <h2 class="mc-h2 mb-2.5">Orders in this payout</h2>
        <div class="flex flex-wrap gap-2">
          <NuxtLink v-for="id in payout.orderIds" :key="id" :to="`/orders/${id}`" class="mc-tag pd-order">
            #{{ id.slice(0, 8) }}
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  PAYOUT_STATUS_LABEL as LABEL,
  payoutHistory,
  payoutNextStep,
  type PayoutBatch,
} from "~/shared/payout-ledger";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Payout | TCGo" });

const route = useRoute();
const { user } = useAuth();
const { authedFetch } = useAuthedFetch();

const payout = ref<PayoutBatch | null>(null);
const loading = ref(true);

const load = async () => {
  if (!user.value) return;
  loading.value = true;
  try {
    // Reconcile first so an undelivered callback can't leave this stuck.
    await authedFetch("/api/payouts/sync-mine", { method: "POST" }).catch(() => {});
    const res = await authedFetch<{ payouts: PayoutBatch[] }>("/api/payouts/mine");
    payout.value = (res.payouts ?? []).find((p) => p.id === route.params.id) ?? null;
  } finally {
    loading.value = false;
  }
};

onMounted(load);
watch(user, (u) => { if (u) void load(); });

const history = computed(() => (payout.value ? payoutHistory(payout.value) : []));
const nextStep = computed(() => (payout.value ? payoutNextStep(payout.value) : null));

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stamp = (t: number) =>
  new Date(t).toLocaleString("en-MY", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const historyTone = (k: string) =>
  ({ requested: "warn", executed: "info", paid: "good", failed: "bad" })[k];
const toneFor = (s: PayoutBatch["status"]) =>
  ({ queued: "warn", processing: "info", paid: "good", failed: "bad" })[s];
</script>

<style>
.pd-line {
  position: absolute;
  left: 3.5px;
  top: 18px;
  bottom: 0;
  width: 1px;
  background: var(--line-strong);
}
.pd-order {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  transition: background-color 120ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .pd-order:hover {
    background: var(--surface-3);
  }
}
</style>

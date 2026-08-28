<template>
  <div class="max-w-2xl mx-auto">
    <NuxtLink
      to="/seller/payouts"
      class="inline-flex items-center gap-1 text-sm text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors mb-4"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      All payouts
    </NuxtLink>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
    </div>

    <EmptyState v-else-if="!payout" headline="Payout not found" caption="It may belong to another account." />

    <template v-else>
      <!-- Headline -->
      <section class="surface rounded-2xl p-5 sm:p-6 mb-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Payout</p>
            <p class="mt-2 text-3xl font-bold text-ink dark:text-white tabular-price leading-none tracking-tightest">
              RM {{ fmt(payout.amount) }}
            </p>
          </div>
          <span class="chip shrink-0" :class="chipFor(payout.status)">{{ LABEL[payout.status] }}</span>
        </div>

        <p v-if="nextStep" class="mt-3 text-xs text-ink-muted dark:text-zinc-400">{{ nextStep }}</p>
        <p
          v-if="payout.status === 'failed' && payout.failureReason"
          class="mt-3 text-xs rounded-lg bg-pokemon-red/[0.08] text-pokemon-red px-3 py-2"
        >
          {{ payout.failureReason }} — the funds were released back and can be requested again.
        </p>

        <dl class="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-[11px] text-ink-muted dark:text-zinc-400">To</dt>
            <dd class="mt-0.5 font-semibold text-ink dark:text-white">
              {{ payout.recipient?.bankName }}
              <span class="tabular-price font-normal text-ink-muted dark:text-zinc-400">{{ payout.recipient?.bankAccountNumber }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Orders</dt>
            <dd class="mt-0.5 font-semibold text-ink dark:text-white tabular-price">{{ payout.orderIds?.length ?? 0 }}</dd>
          </div>
        </dl>
      </section>

      <!-- Status history -->
      <section class="surface rounded-2xl p-5 sm:p-6 mb-4">
        <p class="eyebrow mb-4">Status history</p>
        <ol class="relative">
          <li
            v-for="(e, i) in history"
            :key="e.key"
            class="relative flex gap-3 pb-5 last:pb-0"
          >
            <!-- Connector, drawn between dots rather than through the last one -->
            <span
              v-if="i < history.length - 1"
              class="absolute left-[5px] top-4 bottom-0 w-px bg-black/[0.10] dark:bg-white/[0.12]"
              aria-hidden="true"
            />
            <span class="relative mt-1 shrink-0 w-[11px] h-[11px] rounded-full ring-4 ring-canvas-raised dark:ring-[#1B1B20]" :class="dotFor(e.key)" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink dark:text-white">{{ e.label }}</p>
              <p v-if="e.detail" class="text-[11px] text-ink-muted dark:text-zinc-400 mt-0.5">{{ e.detail }}</p>
              <p class="text-[11px] text-ink-soft dark:text-zinc-500 mt-0.5 tabular-price">{{ stamp(e.at) }}</p>
            </div>
          </li>
        </ol>

        <p v-if="payout.status === 'processing'" class="mt-1 text-[11px] text-ink-soft dark:text-zinc-500">
          Waiting on the bank. This page checks for an update each time you open it.
        </p>
      </section>

      <!-- Orders covered -->
      <section v-if="payout.orderIds?.length" class="surface rounded-2xl p-5 sm:p-6">
        <p class="eyebrow mb-3">Orders in this payout</p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="id in payout.orderIds"
            :key="id"
            :to="`/orders/${id}`"
            class="chip hover:bg-ink/[0.08] dark:hover:bg-white/[0.10] transition-colors"
          >
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

const dotFor = (k: string) =>
  ({ requested: "bg-amber-400", executed: "bg-blue-500", paid: "bg-emerald-500", failed: "bg-pokemon-red" })[k] ??
  "bg-ink-soft";
const chipFor = (s: PayoutBatch["status"]) =>
  ({
    queued: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    failed: "bg-pokemon-red/10 text-pokemon-red",
  })[s];
</script>

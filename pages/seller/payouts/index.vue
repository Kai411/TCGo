<template>
  <div class="max-w-3xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-ink-muted dark:text-zinc-400 text-lg mb-4">Sign in to view your payouts.</p>
      <button @click="signInWithGoogle" class="bg-ink text-white px-6 py-3 rounded-lg font-medium">
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-5">
        <div>
          <NuxtLink
            to="/seller/funds"
            class="inline-flex items-center gap-1 text-sm text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Funds
          </NuxtLink>
          <h1 class="mt-1 text-2xl font-bold text-ink dark:text-white">Payouts</h1>
        </div>
        <button
          @click="reload"
          :disabled="loading"
          class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink-muted dark:text-zinc-300 hover:text-ink dark:hover:text-white transition-colors disabled:opacity-50"
        >
          {{ loading ? "Checking…" : "Refresh" }}
        </button>
      </div>

      <div v-if="loading && !payouts.length" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
      </div>

      <EmptyState
        v-else-if="!payouts.length"
        headline="No payouts yet"
        caption="Once funds unlock and you request a payout, every one shows up here with its full history."
      />

      <div v-else class="space-y-2.5">
        <NuxtLink
          v-for="p in payouts"
          :key="p.id"
          :to="`/seller/payouts/${p.id}`"
          class="surface rounded-2xl p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
        >
          <span class="shrink-0 w-2 h-2 rounded-full" :class="dotFor(p.status)" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-ink dark:text-white">
              RM {{ fmt(p.amount) }}
              <span class="ml-1.5 chip" :class="chipFor(p.status)">{{ LABEL[p.status] }}</span>
            </p>
            <p class="text-[11px] text-ink-muted dark:text-zinc-400 mt-0.5">
              {{ p.orderIds?.length ?? 0 }} order{{ (p.orderIds?.length ?? 0) === 1 ? "" : "s" }}
              · {{ p.recipient?.bankName }} {{ p.recipient?.bankAccountNumber }}
              · {{ when(p.requestedAt) }}
            </p>
          </div>
          <svg class="w-4 h-4 shrink-0 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PAYOUT_STATUS_LABEL as LABEL, type PayoutBatch } from "~/shared/payout-ledger";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Payouts | TCGo" });

const { user, signInWithGoogle } = useAuth();
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

const dotFor = (s: PayoutBatch["status"]) =>
  ({ queued: "bg-amber-400", processing: "bg-blue-500", paid: "bg-emerald-500", failed: "bg-pokemon-red" })[s];
const chipFor = (s: PayoutBatch["status"]) =>
  ({
    queued: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    failed: "bg-pokemon-red/10 text-pokemon-red",
  })[s];
</script>

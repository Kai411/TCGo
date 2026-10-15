<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!isAdmin" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">
        Your role doesn't include access to payouts.
      </p>
      <p class="text-[13px] text-ink-soft dark:text-zinc-500 mt-1.5">
        Ask an admin to grant it if you need it.
      </p>
    </div>

    <template v-else>
      <AutoPayoutPanel class="mb-6" />

      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Payouts</h1>
        <button
          @click="load"
          :disabled="loading"
          class="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 disabled:opacity-50"
        >
          Reload
        </button>
      </div>

      <div v-if="error" class="mb-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 text-sm">
        {{ error }}
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"/>
      </div>

      <template v-else>
        <!-- Totals -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div v-for="s in STATUSES" :key="s" class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-4">
            <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">{{ PAYOUT_STATUS_LABEL[s] }}</p>
            <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums mt-1">RM {{ fmt(totals[s] || 0) }}</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-4 bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1 w-fit">
          <button
            v-for="s in STATUSES"
            :key="s"
            @click="tab = s"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            :class="tab === s ? 'bg-white dark:bg-white/[0.10] text-gray-900 dark:text-zinc-100 shadow-sm' : 'text-gray-500 dark:text-zinc-400'"
          >
            {{ PAYOUT_STATUS_LABEL[s] }}
            <span class="ml-1 text-xs opacity-60">{{ countFor(s) }}</span>
          </button>
        </div>

        <p v-if="!visible.length" class="text-sm text-gray-500 dark:text-zinc-400 py-10 text-center">
          Nothing here.
        </p>

        <div v-else class="space-y-3">
          <div
            v-for="p in visible"
            :key="p.id"
            class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-4"
          >
            <div class="flex items-start justify-between gap-4 flex-wrap">
              <div class="min-w-0">
                <p class="font-bold text-ink dark:text-white">{{ p.sellerName }}</p>
                <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  {{ p.recipient.name }} · {{ p.recipient.bankName }} · {{ p.recipient.bankAccountNumber }}
                </p>
                <p class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                  {{ p.orderIds.length }} order{{ p.orderIds.length === 1 ? "" : "s" }} · requested {{ fmtDate(p.requestedAt) }}
                </p>
                <p v-if="!p.autoPayoutSupported" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Automated transfer unavailable for this bank — transfer manually, then record the reference.
                </p>
                <p v-if="p.failureReason" class="text-xs text-red-600 dark:text-red-400 mt-1">
                  {{ p.failureReason }}
                </p>
                <p v-if="p.manualReference" class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                  Manual reference: {{ p.manualReference }}
                </p>
                <p v-if="p.billplzStatus" class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  Billplz: {{ p.billplzStatus }}<template v-if="p.billplzInstructionId"> · {{ p.billplzInstructionId }}</template>
                </p>
              </div>

              <div class="text-right shrink-0">
                <p class="text-xl font-extrabold text-ink dark:text-white tabular-nums">RM {{ fmt(p.amount) }}</p>
                <div class="flex gap-2 mt-2 justify-end flex-wrap">
                  <button
                    v-if="p.status === 'queued' && p.autoPayoutSupported"
                    @click="execute(p)"
                    :disabled="busy === p.id"
                    class="px-3 py-1.5 rounded-lg text-xs font-bold bg-pokemon-red text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {{ busy === p.id ? "Sending…" : "Send via Billplz" }}
                  </button>
                  <button
                    v-if="p.status === 'processing'"
                    @click="refresh(p)"
                    :disabled="busy === p.id"
                    class="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {{ busy === p.id ? "Checking…" : "Check status" }}
                  </button>
                  <button
                    v-if="p.status !== 'paid'"
                    @click="markManual(p)"
                    :disabled="busy === p.id"
                    class="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 disabled:opacity-50"
                  >
                    Record manual transfer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Payouts — TCGo Admin" });

import {
  PAYOUT_STATUS_LABEL,
  type PayoutBatch,
  type PayoutBatchStatus,
} from "~/shared/payout-ledger";

useHead({ title: "Admin · Payouts | TCGo" });

const STATUSES: PayoutBatchStatus[] = ["queued", "processing", "paid", "failed"];

const { me, can } = useStaffAuth();
const isAdmin = computed(() => can("payouts.view"));
const { mcFetch } = useMcFetch();

const payouts = ref<PayoutBatch[]>([]);
const totals = ref<Record<string, number>>({});
const loading = ref(true);
const error = ref("");
const busy = ref("");
const tab = ref<PayoutBatchStatus>("queued");

const load = async () => {
  if (!isAdmin.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const res = await mcFetch<{ payouts: PayoutBatch[]; totals: Record<string, number> }>(
      "/api/payouts/list",
    );
    payouts.value = res.payouts;
    totals.value = res.totals;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load payouts.";
  } finally {
    loading.value = false;
  }
};

// Keyed on the staff session, not the Firebase user: a staff-only account
// never signs into Firebase, so watching `user` would leave this page
// permanently loading for exactly the people it's built for.
watch(() => me.value?.permissions, load, { immediate: true });

const visible = computed(() => payouts.value.filter((p) => p.status === tab.value));
const countFor = (s: PayoutBatchStatus) => payouts.value.filter((p) => p.status === s).length;

const fmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const run = async (id: string, fn: () => Promise<unknown>) => {
  busy.value = id;
  error.value = "";
  try {
    await fn();
    await load();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Something went wrong.";
  } finally {
    busy.value = "";
  }
};

const execute = (p: PayoutBatch) =>
  confirm(`Send RM ${fmt(p.amount)} to ${p.recipient.name} (${p.recipient.bankName} ${p.recipient.bankAccountNumber})?`)
    ? run(p.id, () => mcFetch("/api/payouts/execute", { method: "POST", body: { payoutId: p.id } }))
    : undefined;

const refresh = (p: PayoutBatch) =>
  run(p.id, () => mcFetch("/api/payouts/refresh", { method: "POST", body: { payoutId: p.id } }));

const markManual = (p: PayoutBatch) => {
  const reference = prompt(`Bank reference for the RM ${fmt(p.amount)} transfer to ${p.recipient.name}:`);
  if (!reference?.trim()) return;
  return run(p.id, () =>
    mcFetch("/api/payouts/mark-manual", {
      method: "POST",
      body: { payoutId: p.id, reference: reference.trim() },
    }),
  );
};
</script>

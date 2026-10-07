<template>
  <div class="max-w-6xl">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl font-bold text-ink dark:text-white">Refunds</h1>
        <p class="text-sm text-ink-muted dark:text-zinc-400">
          Buyers who cancelled a paid order. Sending a refund creates a Billplz Payment Order to the buyer's bank.
        </p>
      </div>
      <button
        type="button"
        @click="load"
        :disabled="loading"
        class="px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white disabled:opacity-50"
      >
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </div>

    <div class="flex flex-wrap gap-2 mb-4 text-xs">
      <span v-for="(amt, status) in totals" :key="status" class="px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-200">
        {{ status }} · RM {{ Number(amt).toFixed(2) }}
      </span>
    </div>

    <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-if="!loading && !refunds.length" class="py-16 text-center text-sm text-ink-muted dark:text-zinc-400">
      No refund requests yet.
    </div>

    <div v-else class="overflow-x-auto rounded-xl border border-black/[0.08] dark:border-white/[0.10]">
      <table class="w-full min-w-[900px] text-sm">
        <thead class="bg-black/[0.03] dark:bg-white/[0.04] text-left text-[11px] uppercase tracking-wide text-ink-muted dark:text-zinc-400">
          <tr>
            <th class="px-3 py-2.5">Order</th>
            <th class="px-3 py-2.5">Refund</th>
            <th class="px-3 py-2.5">Reason</th>
            <th class="px-3 py-2.5">Pay to</th>
            <th class="px-3 py-2.5">Status</th>
            <th class="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
          <tr v-for="r in refunds" :key="r.id" class="align-top">
            <td class="px-3 py-3">
              <NuxtLink :to="`/orders/${r.orderId}`" target="_blank" class="font-mono text-xs font-semibold text-pokemon-red hover:underline">
                #{{ String(r.orderId).slice(0, 8).toUpperCase() }}
              </NuxtLink>
              <p class="text-xs text-ink-muted dark:text-zinc-400">{{ r.buyerName || r.buyerUid }}</p>
              <p class="text-[11px] text-ink-soft dark:text-zinc-500">{{ fmt(r.createdAt) }}</p>
            </td>
            <td class="px-3 py-3 tabular-nums">
              <p class="font-bold text-ink dark:text-white">RM {{ Number(r.amount).toFixed(2) }}</p>
              <p class="text-[11px] text-ink-soft dark:text-zinc-500">
                RM {{ Number(r.orderTotal).toFixed(2) }} − RM {{ Number(r.fee).toFixed(2) }} fee
              </p>
            </td>
            <td class="px-3 py-3 text-xs text-ink dark:text-zinc-200 max-w-[16rem]">{{ r.reason }}</td>
            <td class="px-3 py-3 text-xs text-ink dark:text-zinc-200">
              <p class="font-semibold">{{ r.holderName }}</p>
              <p>{{ r.bank }} · {{ r.account }}</p>
              <p class="text-ink-soft dark:text-zinc-500">IC {{ r.ic }}</p>
            </td>
            <td class="px-3 py-3 text-xs">
              <span class="inline-flex px-2 py-0.5 rounded-full font-semibold" :class="statusClass(r.status)">{{ r.status }}</span>
              <p v-if="r.failureReason" class="mt-1 text-red-600 dark:text-red-400">{{ r.failureReason }}</p>
              <p v-if="!r.autoPayoutSupported" class="mt-1 text-amber-600 dark:text-amber-400">Bank not automated — transfer by hand.</p>
            </td>
            <td class="px-3 py-3 text-right">
              <button
                v-if="r.status === 'requested'"
                type="button"
                @click="send(r)"
                :disabled="busy === r.id"
                class="px-3 py-1.5 rounded-lg text-xs font-bold bg-pokemon-red text-white disabled:opacity-50"
              >
                {{ busy === r.id ? "Sending…" : "Send refund" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Refunds | Mintcondition" });

interface RefundRow {
  id: string;
  orderId: string;
  buyerUid: string;
  buyerName: string | null;
  status: string;
  orderTotal: number;
  fee: number;
  amount: number;
  reason: string;
  holderName: string;
  bank: string;
  account: string;
  ic: string;
  autoPayoutSupported: boolean;
  failureReason: string | null;
  createdAt: number;
  paidAt: number | null;
}

const { mcFetch } = useMcFetch();
const refunds = ref<RefundRow[]>([]);
const totals = ref<Record<string, number>>({});
const loading = ref(false);
const error = ref("");
const busy = ref<string | null>(null);

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const res = await mcFetch<{ refunds: RefundRow[]; totals: Record<string, number> }>("/api/mc/refunds");
    refunds.value = res.refunds;
    totals.value = res.totals;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load refunds.";
  } finally {
    loading.value = false;
  }
};

const send = async (r: RefundRow) => {
  if (!confirm(`Send RM ${r.amount.toFixed(2)} to ${r.holderName} (${r.bank} ${r.account})?`)) return;
  busy.value = r.id;
  error.value = "";
  try {
    await mcFetch("/api/mc/refunds/execute", { method: "POST", body: { refundId: r.id } });
    await load();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't send the refund.";
    await load();
  } finally {
    busy.value = null;
  }
};

const statusClass = (s: string) =>
  s === "paid"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : s === "failed"
      ? "bg-red-500/10 text-red-700 dark:text-red-400"
      : s === "processing"
        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-400";

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>

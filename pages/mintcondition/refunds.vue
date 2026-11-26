<template>
  <div class="mc-page">
    <div class="mc-page-head">
      <div>
        <p class="mc-eyebrow mb-1">Money</p>
        <h1 class="mc-h1">Refunds</h1>
        <p class="mc-meta mt-1">
          <template v-if="!loading && countFor('requested')">
            <span class="mc-num">RM {{ fmt(totals.requested || 0) }}</span> to send to
            {{ countFor("requested") }} {{ countFor("requested") === 1 ? "buyer" : "buyers" }}.
          </template>
          <template v-else>Buyers who cancelled a paid order.</template>
        </p>
      </div>
      <button type="button" :disabled="loading" class="mc-btn" @click="load">
        {{ loading ? "Loading…" : "Refresh" }}
      </button>
    </div>

    <p v-if="error" class="mc-callout mb-6" data-tone="bad" role="alert">{{ error }}</p>

    <div class="mc-tabs mb-4" role="tablist" aria-label="Refund status">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="tab === t.key"
        @click="tab = t.key"
      >
        {{ t.label }}<span class="mc-tab-count">{{ countFor(t.key) }}</span>
      </button>
    </div>

    <div v-if="loading && !refunds.length" class="grid gap-3" aria-busy="true" aria-label="Loading">
      <div class="mc-skel h-[120px]" />
      <div class="mc-skel h-[120px]" />
    </div>

    <template v-else>
      <p class="mc-small mb-3">
        {{ TABS.find((t) => t.key === tab)?.hint }}
        <template v-if="visible.length && tab !== 'other'">
          Total <span class="mc-num">RM {{ fmt(totals[tab] || 0) }}</span>.
        </template>
      </p>

      <p v-if="!visible.length" class="mc-card mc-empty">{{ TABS.find((t) => t.key === tab)?.empty }}</p>

      <ul v-else class="mc-card mc-list">
        <li v-for="r in visible" :key="r.id" class="mc-item">
          <div class="mc-item-head">
            <div>
              <p class="mc-list-title">{{ r.buyerName || "Buyer" }}</p>
              <p class="mc-small mt-0.5">
                <NuxtLink :to="`/orders/${r.orderId}`" target="_blank" class="mc-link mc-mono">
                  #{{ String(r.orderId).slice(0, 8).toUpperCase() }}
                </NuxtLink>
                · asked {{ fmtDate(r.createdAt) }}
                <template v-if="r.paidAt"> · paid {{ fmtDate(r.paidAt) }}</template>
                <template v-if="r.status !== tab && tab === 'other'"> · {{ r.status }}</template>
              </p>
            </div>
            <div class="text-right">
              <p class="mc-amount">RM {{ fmt(r.amount) }}</p>
              <p class="mc-small mc-num">RM {{ fmt(r.orderTotal) }} less RM {{ fmt(r.fee) }} fee</p>
            </div>
          </div>

          <p class="mc-quote">{{ r.reason }}</p>

          <dl class="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)] mc-meta">
            <dt class="mc-ink-3">Pay to</dt>
            <dd>{{ r.holderName }} · {{ r.bank }} · <span class="mc-num">{{ r.account }}</span></dd>
            <dt class="mc-ink-3">IC</dt>
            <dd class="mc-num">{{ r.ic }}</dd>
          </dl>

          <p v-if="r.failureReason" class="mc-callout mt-3" data-tone="bad">
            Last attempt failed: {{ r.failureReason }}
          </p>
          <p v-if="!r.autoPayoutSupported && r.status === 'requested'" class="mc-callout mt-3" data-tone="info">
            This bank can't take an automated transfer. Send it by hand.
          </p>

          <div v-if="r.status === 'requested'" class="mc-item-actions">
            <button
              type="button"
              class="mc-btn mc-btn-sm mc-btn-primary"
              :disabled="busy === r.id"
              @click="send(r)"
            >
              {{ busy === r.id ? "Sending…" : "Send refund" }}
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatRM } from "~/shared/format-money";
definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Refunds — TCGo Admin" });

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
  if (!confirm(`Send ${formatRM(r.amount)} to ${r.holderName} (${r.bank} ${r.account})?`)) return;
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

type TabKey = "requested" | "processing" | "paid" | "other";
const TABS: { key: TabKey; label: string; hint: string; empty: string }[] = [
  { key: "requested", label: "To send", hint: "Sending one creates a Billplz Payment Order to the buyer's bank.", empty: "No refunds to send." },
  { key: "processing", label: "Sending", hint: "Sent to Billplz and waiting for the bank to confirm.", empty: "No refunds in flight." },
  { key: "paid", label: "Paid", hint: "Confirmed by the bank.", empty: "No refunds paid yet." },
  { key: "other", label: "Other", hint: "Any other status.", empty: "Nothing else." },
];
const tab = ref<TabKey>("requested");
const tabOf = (s: string): TabKey =>
  s === "requested" || s === "processing" || s === "paid" ? s : "other";
const visible = computed(() =>
  refunds.value
    .filter((r) => tabOf(r.status) === tab.value)
    .sort((a, b) => (tab.value === "requested" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt)),
);
const countFor = (k: TabKey) => refunds.value.filter((r) => tabOf(r.status) === k).length;

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ms?: number | null) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

onMounted(load);
</script>

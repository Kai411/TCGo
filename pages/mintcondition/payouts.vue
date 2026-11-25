<template>
  <div class="mc-page">
    <div v-if="!isAdmin" class="mc-card mc-card-pad">
      <p class="mc-h2">Your role doesn't include access to payouts.</p>
      <p class="mc-small mt-1">Ask an admin to grant it if you need it.</p>
    </div>

    <template v-else>
      <div class="mc-page-head">
        <div>
          <p class="mc-eyebrow mb-1">Money</p>
          <h1 class="mc-h1">Payouts</h1>
          <p class="mc-meta mt-1">
            <template v-if="!loading && countFor('queued')">
              <span class="mc-num">RM {{ fmt(totals.queued || 0) }}</span> waiting in
              {{ countFor("queued") }} {{ countFor("queued") === 1 ? "batch" : "batches" }}.
            </template>
            <template v-else>Money owed to sellers, and the transfers that pay it.</template>
          </p>
        </div>
        <button :disabled="loading" class="mc-btn" @click="load">
          {{ loading ? "Loading…" : "Refresh" }}
        </button>
      </div>

      <p v-if="error" class="mc-callout mb-6" data-tone="bad" role="alert">{{ error }}</p>

      <div class="mc-tabs mb-4" role="tablist" aria-label="Payout status">
        <button
          v-for="s in STATUSES"
          :key="s"
          type="button"
          role="tab"
          :aria-selected="tab === s"
          @click="tab = s"
        >
          {{ TAB_LABEL[s] }}<span class="mc-tab-count">{{ countFor(s) }}</span>
        </button>
      </div>

      <div v-if="loading" class="grid gap-3" aria-busy="true" aria-label="Loading">
        <div class="mc-skel h-[112px]" />
        <div class="mc-skel h-[112px]" />
      </div>

      <template v-else>
        <p class="mc-small mb-3">
          {{ TAB_HINT[tab] }}
          <template v-if="visible.length">
            Total <span class="mc-num">RM {{ fmt(totals[tab] || 0) }}</span>.
          </template>
        </p>

        <p v-if="!visible.length" class="mc-card mc-empty">{{ EMPTY[tab] }}</p>

        <ul v-else class="mc-card mc-list">
          <li v-for="p in visible" :key="p.id" class="mc-item">
            <div class="mc-item-head">
              <div>
                <p class="mc-list-title">{{ p.sellerName }}</p>
                <p class="mc-meta mt-0.5">
                  {{ p.recipient.name }} · {{ p.recipient.bankName }} ·
                  <span class="mc-num">{{ p.recipient.bankAccountNumber }}</span>
                </p>
                <p class="mc-small mt-0.5">
                  {{ p.orderIds.length }} {{ p.orderIds.length === 1 ? "order" : "orders" }} ·
                  requested {{ fmtDate(p.requestedAt) }}
                  <template v-if="p.billplzStatus">
                    · Billplz {{ p.billplzStatus }}<template v-if="p.billplzInstructionId"> <span class="mc-mono">{{ p.billplzInstructionId }}</span></template>
                  </template>
                  <template v-if="p.manualReference"> · bank ref <span class="mc-mono">{{ p.manualReference }}</span></template>
                </p>
              </div>
              <p class="mc-amount">RM {{ fmt(p.amount) }}</p>
            </div>

            <p v-if="p.status === 'queued' && p.identityHold" class="mc-callout mt-3">
              Held: the account name doesn't match the seller's verified ID. Check it below before sending.
            </p>
            <p v-else-if="p.failureReason" class="mc-callout mt-3" data-tone="bad">
              {{ p.failureReason }}
            </p>
            <p v-if="!p.autoPayoutSupported && p.status !== 'paid'" class="mc-callout mt-3" data-tone="info">
              This bank can't take an automated transfer. Send it by hand, then record the bank reference.
            </p>

            <div v-if="p.status !== 'paid'" class="mc-item-actions">
              <button
                v-if="p.status === 'queued' && p.autoPayoutSupported && !p.identityHold"
                class="mc-btn mc-btn-sm mc-btn-primary"
                :disabled="busy === p.id"
                @click="execute(p)"
              >
                {{ busy === p.id ? "Sending…" : "Send via Billplz" }}
              </button>
              <button
                v-if="p.status === 'processing'"
                class="mc-btn mc-btn-sm"
                :disabled="busy === p.id"
                @click="refresh(p)"
              >
                {{ busy === p.id ? "Checking…" : "Check status" }}
              </button>
              <button class="mc-btn mc-btn-sm" :disabled="busy === p.id" @click="markManual(p)">
                Record manual transfer
              </button>
            </div>

            <AdminIdentityPanel
              v-if="p.status === 'queued' && p.identityHold"
              :uid="p.sellerUid"
              :name="p.sellerName"
              start-open
              @approved="load"
            />
          </li>
        </ul>
      </template>

      <!-- Settings come after the work: the queue is what people open this page for. -->
      <section class="mt-10" aria-labelledby="mc-auto">
        <h2 id="mc-auto" class="mc-h2 mb-3">Automatic payouts</h2>
        <AutoPayoutPanel @ran="load" />
      </section>
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

const STATUSES: PayoutBatchStatus[] = ["queued", "processing", "paid", "failed"];

// Staff-side wording: what each tab asks of the person reading it.
const TAB_LABEL: Record<PayoutBatchStatus, string> = {
  queued: "To send",
  processing: "Sending",
  paid: "Paid",
  failed: "Failed",
};
const TAB_HINT: Record<PayoutBatchStatus, string> = {
  queued: "Requested by sellers and not sent yet. Held and manual ones are listed first.",
  processing: "Sent to Billplz and waiting for the bank to confirm.",
  paid: "Confirmed by the bank or recorded by hand.",
  failed: "The bank rejected these. Fix the cause, then record a manual transfer.",
};
const EMPTY: Record<PayoutBatchStatus, string> = {
  queued: "Nothing to send.",
  processing: "No transfers in flight.",
  paid: "No payouts paid yet.",
  failed: "No failed payouts.",
};

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

// Items that need a person (identity hold, manual bank) go first, then oldest.
const needsHand = (p: PayoutBatch) => (p.identityHold || !p.autoPayoutSupported ? 0 : 1);
const visible = computed(() =>
  payouts.value
    .filter((p) => p.status === tab.value)
    .sort((a, b) =>
      tab.value === "queued"
        ? needsHand(a) - needsHand(b) || a.requestedAt - b.requestedAt
        : 0,
    ),
);
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

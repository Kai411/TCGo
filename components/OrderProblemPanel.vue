<template>
  <!-- Buyer, before anything has been reported -->
  <div
    v-if="role === 'buyer' && !problem && reportCheck.ok"
    class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5"
  >
    <p class="text-sm font-semibold text-ink dark:text-white">Something wrong with this order?</p>
    <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
      Tell the seller and we'll hold the payment while you sort it out.
      <template v-if="order.status === 'delivered'">You have {{ CLAIM_WINDOW_DAYS }} days after delivery.</template>
      <NuxtLink to="/refund-policy" target="_blank" class="underline">How it works</NuxtLink>
    </p>
    <button
      type="button"
      @click="openReport"
      class="mt-3 px-4 py-2 rounded-lg text-sm font-semibold border border-red-200 dark:border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors"
    >
      Report a problem
    </button>
  </div>

  <!-- The problem and the conversation about it -->
  <div
    v-if="problem"
    class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5"
  >
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-sm font-bold text-ink dark:text-white">Reported problem</h2>
        <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{{ problemReasonLabel(problem.reasonCode) }}</p>
      </div>
      <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" :class="badgeClass">
        {{ PROBLEM_STATUS_LABEL[problem.status] }}
      </span>
    </div>

    <p v-if="hint" class="mt-3 text-xs text-gray-600 dark:text-zinc-300 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-3">
      {{ hint }}
    </p>

    <ul class="mt-3 space-y-2">
      <li
        v-for="(m, i) in problem.messages || []"
        :key="i"
        class="rounded-lg px-3 py-2 text-sm"
        :class="m.by === role ? 'bg-black/[0.04] dark:bg-white/[0.06]' : m.by === 'tcgo' ? 'bg-amber-500/10' : 'border border-black/[0.06] dark:border-white/[0.08]'"
      >
        <p class="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
          {{ m.by === role ? "You" : m.by === "tcgo" ? "TCGo" : m.by === "buyer" ? "Buyer" : "Seller" }}
          · {{ fmt(m.at) }}
        </p>
        <p class="text-ink dark:text-zinc-100 whitespace-pre-line">{{ m.text }}</p>
      </li>
    </ul>

    <template v-if="actions.length">
      <textarea
        v-if="actions.includes('reply')"
        v-model="message"
        rows="2"
        :maxlength="PROBLEM_MESSAGE_MAX"
        placeholder="Write a message"
        class="mt-3 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
      />
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          v-if="actions.includes('reply')"
          type="button"
          :disabled="busy || !message.trim()"
          @click="act('reply')"
          class="px-3 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-50"
        >
          Send
        </button>
        <button
          v-if="actions.includes('agree_refund')"
          type="button"
          :disabled="busy"
          @click="act('agree_refund', `Refund RM ${Number(order.total).toFixed(2)} to the buyer in full? You won't be paid for this order.`)"
          class="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-ink dark:text-white disabled:opacity-50"
        >
          Agree to full refund
        </button>
        <button
          v-if="actions.includes('resolve')"
          type="button"
          :disabled="busy"
          @click="act('resolve', 'Mark this as resolved? The seller will be paid as normal.')"
          class="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.10] text-ink dark:text-white disabled:opacity-50"
        >
          It's resolved
        </button>
        <button
          v-if="actions.includes('escalate')"
          type="button"
          :disabled="busy"
          @click="act('escalate', 'Ask TCGo to step in? We\'ll read what you both said and decide where the payment goes.')"
          class="px-3 py-2 rounded-lg text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
        >
          Ask TCGo to step in
        </button>
      </div>
    </template>
    <p v-if="actionError" class="mt-2 text-xs text-red-600">{{ actionError }}</p>
  </div>

  <!-- Report form -->
  <div
    v-if="reportOpen"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
    @click.self="reportOpen = false"
  >
    <form
      class="surface w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08]"
      @submit.prevent="submitReport"
      novalidate
    >
      <h3 class="text-base font-bold text-ink dark:text-white">Report a problem</h3>
      <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
        The seller sees what you write here. The payment stays on hold until it's sorted.
      </p>

      <div class="mt-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">What went wrong?</label>
          <select v-model="report.reasonCode" class="field-sm">
            <option value="" disabled>Choose one</option>
            <option v-for="r in PROBLEM_REASONS" :key="r.code" :value="r.code">{{ r.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">What happened?</label>
          <textarea
            v-model="report.details"
            rows="3"
            :maxlength="PROBLEM_DETAILS_MAX"
            placeholder="Describe it for the seller. Photos help: share a link if you have them."
            class="field-sm"
          />
        </div>

        <p class="pt-1 text-xs font-semibold text-ink dark:text-white">If a refund is agreed, where should it go?</p>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Account holder name</label>
          <input v-model="bank.holderName" type="text" autocomplete="name" class="field-sm" />
          <p v-if="bankErrors.holderName" class="mt-1 text-xs text-red-600">{{ bankErrors.holderName }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">IC number of account holder</label>
          <input v-model="bank.identityNumber" type="text" inputmode="numeric" class="field-sm" />
          <p v-if="bankErrors.identityNumber" class="mt-1 text-xs text-red-600">{{ bankErrors.identityNumber }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Bank</label>
          <select v-model="bank.bankCode" class="field-sm">
            <option value="" disabled>Choose your bank</option>
            <option v-for="b in bankOptions" :key="b.code" :value="b.code">{{ b.name }}</option>
          </select>
          <p v-if="bankErrors.bankCode" class="mt-1 text-xs text-red-600">{{ bankErrors.bankCode }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Bank account number</label>
          <input v-model="bank.bankAccountNumber" type="text" inputmode="numeric" class="field-sm" />
          <p v-if="bankErrors.bankAccountNumber" class="mt-1 text-xs text-red-600">{{ bankErrors.bankAccountNumber }}</p>
        </div>
        <p class="text-[11px] text-gray-500 dark:text-zinc-400">
          Only TCGo staff see your bank details and IC, and only to send a refund.
        </p>
      </div>

      <p v-if="reportError" class="mt-3 text-xs text-red-600">{{ reportError }}</p>

      <div class="flex gap-2 mt-4">
        <button
          type="button"
          @click="reportOpen = false"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200"
        >
          Not now
        </button>
        <button
          type="submit"
          :disabled="busy"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {{ busy ? "Sending…" : "Report problem" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import {
  CLAIM_WINDOW_DAYS,
  PROBLEM_DETAILS_MAX,
  PROBLEM_MESSAGE_MAX,
  PROBLEM_REASONS,
  PROBLEM_STATUS_LABEL,
  SELLER_REPLY_BUSINESS_DAYS,
  canReportProblem,
  problemActionsFor,
  problemReasonLabel,
  validateProblemReport,
  type OrderProblem,
  type ProblemAction,
} from "~/shared/order-problems";
import { banksFor } from "~/shared/banks";
import { emptyRefundForm, validateRefundRecipient } from "~/shared/refunds";

// "Report a problem" on an order: the buyer raises it, buyer and seller try
// to sort it out, and either can ask TCGo to decide. Rules and wording live
// in shared/order-problems.ts and the Refund Policy.
const props = defineProps<{ order: any; role: "buyer" | "seller" }>();

const { authedFetch } = useAuthedFetch();

const problem = computed<OrderProblem | null>(() => props.order?.problem ?? null);
const reportCheck = computed(() => canReportProblem(props.order));
const actions = computed(() => problemActionsFor(problem.value, props.role));

const hint = computed(() => {
  const p = problem.value;
  if (!p) return "";
  if (p.status === "open") {
    return props.role === "seller"
      ? `Please reply within ${SELLER_REPLY_BUSINESS_DAYS} business days. You can agree to a refund, or ask TCGo to step in if you can't agree. Payment for this order is on hold until it's settled.`
      : "Try to sort it out with the seller here first. If you can't agree, ask TCGo to step in.";
  }
  if (p.status === "escalated") return "TCGo is reviewing what you've both said and will decide where the payment goes.";
  if (p.status === "refunded") return "A full refund is on its way to the buyer's bank.";
  if (p.status === "released") return "TCGo decided the payment goes to the seller.";
  return "";
});

const badgeClass = computed(() => {
  const s = problem.value?.status;
  if (s === "escalated") return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (s === "open") return "bg-red-500/10 text-red-700 dark:text-red-400";
  return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
});

// ── Reporting ────────────────────────────────────────────────────────
const reportOpen = ref(false);
const report = reactive({ reasonCode: "", details: "" });
const bank = reactive(emptyRefundForm());
const bankErrors = ref<Record<string, string>>({});
const reportError = ref("");
const busy = ref(false);
const bankOptions = computed(() => banksFor(!!useRuntimeConfig().public.billplzSandbox));

const openReport = () => {
  reportError.value = "";
  bankErrors.value = {};
  reportOpen.value = true;
};

const submitReport = async () => {
  if (busy.value) return;
  reportError.value = validateProblemReport(report) ?? "";
  bankErrors.value = validateRefundRecipient(bank) as Record<string, string>;
  if (reportError.value || Object.keys(bankErrors.value).length) return;
  busy.value = true;
  try {
    await authedFetch("/api/orders/problem/report", {
      method: "POST",
      body: { orderId: props.order.id, ...report, refund: { ...bank } },
    });
    reportOpen.value = false;
  } catch (e: any) {
    const fields = e?.data?.data?.fields;
    if (fields) bankErrors.value = fields;
    reportError.value = e?.data?.message || e?.message || "Couldn't send the report.";
  } finally {
    busy.value = false;
  }
};

// ── Acting on it ─────────────────────────────────────────────────────
const message = ref("");
const actionError = ref("");

const act = async (action: ProblemAction, confirmText?: string) => {
  if (busy.value) return;
  if (confirmText && !confirm(confirmText)) return;
  busy.value = true;
  actionError.value = "";
  try {
    await authedFetch("/api/orders/problem/respond", {
      method: "POST",
      body: { orderId: props.order.id, action, message: message.value },
    });
    message.value = "";
  } catch (e: any) {
    actionError.value = e?.data?.message || e?.message || "Couldn't do that. Try again.";
  } finally {
    busy.value = false;
  }
};

const fmt = (ms?: number) =>
  ms ? new Date(ms).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
</script>

<style scoped>
.field-sm {
  @apply w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white;
}
</style>

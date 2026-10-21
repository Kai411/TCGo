<template>
  <PaymentResultShell
    :phase="phase"
    :order="order"
    :copy="copy"
    :paying="paying"
    @pay="payNow"
  >
    <template v-if="order">
      <PaymentOrderSummary :order="order" total-label="Order total" />
      <p class="text-center text-xs text-gray-400 dark:text-zinc-500 max-w-md mx-auto leading-relaxed">
        FPX payments usually fail because the bank's page timed out or the
        transfer went over your bank's FPX limit. Trying again opens a fresh
        bank session.
      </p>
    </template>
  </PaymentResultShell>
</template>

<script setup lang="ts">
// The buyer backed out at the bank, or the bank declined. Billplz sends
// everyone to /payment/success; that page forwards billplz[paid]=false here.
// Anything other than an open, unpaid order goes back to the success page,
// which knows how to explain it.
import type { PaymentResultCopy } from "~/composables/usePaymentResult";

const route = useRoute();
const { order, phase, view, paying, payNow } = usePaymentResult();

const PURCHASES = { to: "/activity?tab=purchases", label: "All purchases" };

// An auction win lapses if it isn't paid in time, so the deadline is the one
// thing worth repeating here.
const keepIt = computed(() => {
  const o = order.value;
  if (!o?.auctionId || !o.paymentDueAt) return "";
  const due = new Date(o.paymentDueAt).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Pay by ${due} to keep your auction win.`;
});

const copy = computed<PaymentResultCopy | null>(() => {
  switch (view.value) {
    case "unpaid":
      return {
        badge: "cross",
        title: "Payment not completed",
        eyebrow: "Nothing charged",
        headline: "Payment not completed.",
        body: `The payment was cancelled or your bank didn't complete it, so no money was taken. ${keepIt.value || "The order is still open. Try again whenever you're ready."}`,
        primary: { action: "pay", label: "Try again" },
        secondary: PURCHASES,
      };
    case "awaiting":
      return {
        badge: "clock",
        title: "Awaiting payment",
        eyebrow: "Awaiting payment",
        headline: "This order isn't paid yet.",
        body: `Nothing has been charged. ${keepIt.value || "Pay by FPX to confirm the order with the seller."}`,
        primary: { action: "pay", label: "Pay now" },
        secondary: PURCHASES,
      };
    default:
      return null;
  }
});

// Declared after `copy`: unhead may read the title getter synchronously.
useHead({
  title: () => (copy.value ? `${copy.value.title} | TCGo` : "Payment | TCGo"),
});

watch(
  view,
  (v) => {
    if (v && v !== "unpaid" && v !== "awaiting") {
      void navigateTo({ path: "/payment/success", query: route.query }, { replace: true });
    }
  },
  { immediate: true },
);
</script>

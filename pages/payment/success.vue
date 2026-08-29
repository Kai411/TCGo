<template>
  <PaymentResultShell
    :phase="phase"
    :order="order"
    :copy="copy"
    :paying="paying"
    @pay="payNow"
  >
    <template #notice>
      <p
        v-if="view === 'confirming' && delayed"
        role="status"
        class="mt-4 mx-auto max-w-md text-left rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
      >
        Still waiting for the confirmation. Your money is safe — the order
        updates by itself the moment it arrives, even if you leave this page.
      </p>
    </template>

    <template v-if="order">
      <!-- A real sequence: each step is a status the order moves through, and
           the marker shows where it is right now. -->
      <section v-if="view === 'success'" class="surface rounded-2xl p-5">
        <h2 class="eyebrow">What happens next</h2>
        <ol class="mt-4">
          <li
            v-for="(step, i) in steps"
            :key="step.title"
            class="relative flex gap-3 pb-4 last:pb-0"
          >
            <span
              v-if="i < steps.length - 1"
              aria-hidden="true"
              class="absolute left-2 top-5 bottom-0 w-px bg-gray-200 dark:bg-white/[0.10]"
            />
            <span
              class="relative z-10 mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
              :class="STEP_DOT[step.state]"
            >
              <svg v-if="step.state === 'done'" class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <div class="min-w-0">
              <p
                class="text-sm font-semibold"
                :class="step.state === 'todo' ? 'text-gray-400 dark:text-zinc-500' : 'text-ink dark:text-white'"
              >
                {{ step.title }}
              </p>
              <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{{ step.detail }}</p>
            </div>
          </li>
        </ol>
      </section>

      <PaymentOrderSummary
        :order="order"
        :total-label="view === 'success' ? 'Total paid' : 'Order total'"
      />

      <div v-if="view === 'success'" class="grid sm:grid-cols-2 gap-4">
        <section class="surface rounded-2xl p-5">
          <h2 class="eyebrow">Delivering to</h2>
          <template v-if="order.deliveryAddress">
            <p class="mt-2 text-sm font-medium text-ink dark:text-white">{{ order.deliveryAddress.name }}</p>
            <p class="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
              {{ order.deliveryAddress.address1 }}<template v-if="order.deliveryAddress.address2">, {{ order.deliveryAddress.address2 }}</template><br />
              {{ order.deliveryAddress.postcode }} {{ order.deliveryAddress.city }}<br />
              {{ stateName(order.deliveryAddress.state) }}
            </p>
          </template>
          <p v-else class="mt-2 text-sm text-gray-500 dark:text-zinc-400">
            No address on this order — check the order page.
          </p>
        </section>

        <section class="surface rounded-2xl p-5">
          <h2 class="eyebrow">Receipt</h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">{{ receiptLine }}</p>
          <p v-if="order.billplzBillId" class="mt-1 text-[11px] font-mono text-gray-400 dark:text-zinc-500">
            FPX · ref {{ order.billplzBillId }}
          </p>
          <a
            :href="`/invoices/${order.id}`"
            target="_blank"
            rel="noopener"
            class="mt-3 inline-flex text-xs font-bold text-pokemon-red hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-red/40 rounded"
          >
            View invoice ↗
          </a>
        </section>
      </div>
    </template>
  </PaymentResultShell>
</template>

<script setup lang="ts">
// Where Billplz sends the buyer after FPX. Observes the order live: the
// webhook flips it to `paid`, and this page follows. A declined payment
// (billplz[paid]=false) is handed to /payment/failed.
import { stateName } from "~/shared/my-states";
import type { PaymentResultCopy } from "~/composables/usePaymentResult";

const route = useRoute();
const { orderId, order, phase, view, paying, payNow } = usePaymentResult();

const shortId = computed(() => order.value?.id.slice(0, 8) ?? "");
const orderPath = computed(() => `/orders/${orderId.value}`);
const PURCHASES = { to: "/activity?tab=purchases", label: "All purchases" };
const BROWSE = { to: "/", label: "Keep browsing" };

const copy = computed<PaymentResultCopy | null>(() => {
  const o = order.value;
  if (!o) return null;
  switch (view.value) {
    case "success":
      return {
        badge: "check",
        title: "Payment received",
        eyebrow: "Payment received",
        headline: "You're all set.",
        body: `${o.sellerName} has been notified and will pack your order for the courier.`,
        primary: { to: orderPath.value, label: "View order" },
        secondary: BROWSE,
      };
    case "confirming":
      return {
        badge: "spinner",
        title: "Confirming payment",
        eyebrow: "Almost there",
        headline: "Confirming your payment…",
        body: "Your bank approved the transfer. We're waiting for the payment provider to confirm it — usually a few seconds. This page updates by itself.",
        secondary: { to: orderPath.value, label: "View order" },
      };
    case "awaiting":
      return {
        badge: "clock",
        title: "Awaiting payment",
        eyebrow: "Awaiting payment",
        headline: "This order isn't paid yet.",
        body: "Nothing has been charged. Pay by FPX to confirm the order with the seller.",
        primary: { action: "pay", label: "Pay now" },
        secondary: PURCHASES,
      };
    case "mismatch":
      return {
        badge: "alert",
        title: "Payment on hold",
        eyebrow: "On hold",
        headline: "We need to check this payment.",
        body: `The amount received doesn't match the order total, so it hasn't been settled. Don't pay again — contact support and quote order #${shortId.value}.`,
        primary: { to: orderPath.value, label: "View order" },
        secondary: PURCHASES,
      };
    case "merged":
      return {
        badge: "arrow",
        title: "Order combined",
        eyebrow: "Combined",
        headline: "This order was combined with another.",
        body: "The seller merged it with your other order from them, so your items ship together under one waybill.",
        primary: { to: `/orders/${o.mergedInto}`, label: "View the combined order" },
        secondary: PURCHASES,
      };
    case "cancelled":
      return {
        badge: "cross",
        title: "Order cancelled",
        eyebrow: "Cancelled",
        headline: "This order was cancelled.",
        body: "No further action is needed. If you paid for it and haven't heard from the seller, contact support and quote the order number.",
        primary: PURCHASES,
        secondary: BROWSE,
      };
    default:
      // "unpaid" belongs to /payment/failed — see the redirect below.
      return null;
  }
});

// Declared after `copy`: unhead may read the title getter synchronously.
useHead({
  title: () => (copy.value ? `${copy.value.title} | TCGo` : "Payment | TCGo"),
});

// The bank said no. Hand over to the failed page, params intact, so a
// refresh there still knows what happened.
watch(
  view,
  (v) => {
    if (v === "unpaid") {
      void navigateTo({ path: "/payment/failed", query: route.query }, { replace: true });
    }
  },
  { immediate: true },
);

// The webhook normally lands within seconds of the redirect. Past that,
// reassure rather than leave a spinner hanging with no explanation.
const CONFIRM_PATIENCE_MS = 25_000;
const delayed = ref(false);
let patience: ReturnType<typeof setTimeout> | null = null;
watch(
  view,
  (v) => {
    if (patience) clearTimeout(patience);
    patience = null;
    delayed.value = false;
    if (v === "confirming") {
      patience = setTimeout(() => (delayed.value = true), CONFIRM_PATIENCE_MS);
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (patience) clearTimeout(patience);
});

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

type StepState = "done" | "current" | "todo";
interface Step {
  title: string;
  detail: string;
  state: StepState;
}

const STEP_DOT: Record<StepState, string> = {
  done: "bg-emerald-500 text-white",
  current: "bg-white dark:bg-[#1B1B20] ring-2 ring-pokemon-red",
  todo: "bg-gray-200 dark:bg-white/[0.10]",
};

const steps = computed<Step[]>(() => {
  const o = order.value;
  if (!o) return [];
  const paid: Step = {
    title: "Paid",
    detail: `${o.paidAt ? formatDate(o.paidAt) : "Just now"} · FPX`,
    state: "done",
  };
  if (o.status === "paid") {
    return [
      paid,
      {
        title: "Processing",
        detail: o.shipmentOrderNo
          ? `Courier booked — ${o.sellerName} is packing your order for pickup.`
          : `${o.sellerName} is preparing your order. A courier waybill is generated automatically.`,
        state: "current",
      },
      { title: "Shipped", detail: "Handed to the courier.", state: "todo" },
      {
        title: "Delivered",
        detail: "Tracking appears on your order page once the courier scans the parcel.",
        state: "todo",
      },
    ];
  }
  const processed: Step = {
    title: "Processing",
    detail: `Packed by ${o.sellerName}.`,
    state: "done",
  };
  const shipped: Step = {
    title: "Shipped",
    detail:
      [
        o.shippedAt ? formatDate(o.shippedAt) : "",
        [o.shippingCarrier, o.trackingNumber].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" · ") || "Handed to the courier.",
    state: o.status === "shipped" ? "current" : "done",
  };
  if (o.status === "shipped") {
    return [
      paid,
      processed,
      shipped,
      {
        title: "Delivered",
        detail: "Track the parcel from your order page and mark it received when it arrives.",
        state: "todo",
      },
    ];
  }
  return [
    paid,
    processed,
    shipped,
    {
      title: "Delivered",
      detail: o.deliveredAt ? formatDate(o.deliveredAt) : "Received.",
      state: "done",
    },
  ];
});

// Sandbox sends are captured by Mailtrap and never reach the buyer — say so
// rather than claim an email they will never find.
const receiptLine = computed(() => {
  const o = order.value;
  if (!o) return "";
  if (o.invoiceEmailedAt) {
    return o.invoiceEmailSandbox
      ? "Invoice captured in the email sandbox — not delivered to a real inbox."
      : `Invoice emailed to ${o.invoiceEmailedTo || o.buyerEmail || "you"}.`;
  }
  return "Your invoice is ready to view or print.";
});
</script>

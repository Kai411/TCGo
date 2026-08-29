// Live state for the payment-return pages, /payment/success and
// /payment/failed: the buyer's order (subscribed, so the webhook's status flip
// shows up without a refresh), the Billplz redirect outcome, and the one view
// the page should render — see shared/payment-result.ts for the rules and for
// why these pages only ever observe the order.

import type { CompiledOrder } from "~/composables/useCompiledOrders";
import {
  parseBillplzRedirect,
  paymentResultView,
  queryValue,
  type PaymentResultView,
} from "~/shared/payment-result";

export type PaymentResultPhase = "loading" | "signed-out" | "not-found" | "ready";

/** Icon in the badge that sits on the card fan. */
export type PaymentBadge = "check" | "spinner" | "cross" | "alert" | "clock" | "arrow";

export interface PaymentResultCta {
  label: string;
  /** Route to go to — or `action: "pay"` to (re)start the FPX payment. */
  to?: string;
  action?: "pay";
}

/** Everything the shell needs to render one outcome. */
export interface PaymentResultCopy {
  badge: PaymentBadge;
  /** Browser tab title. */
  title: string;
  eyebrow: string;
  headline: string;
  body: string;
  primary?: PaymentResultCta;
  secondary?: PaymentResultCta;
}

export const usePaymentResult = () => {
  const route = useRoute();
  const { user, authLoading } = useAuth();
  const { firestore } = useFirebase();
  const { authedFetch } = useAuthedFetch();

  const orderId = computed(() => queryValue(route.query.orderId));
  const redirect = computed(() =>
    parseBillplzRedirect(route.query as Record<string, unknown>),
  );

  const order = ref<CompiledOrder | null>(null);
  // Flips once the first snapshot — or a listener error — arrives, so the page
  // can tell "still loading" from "no such order".
  const resolved = ref(false);

  let unsub: (() => void) | null = null;
  let generation = 0;
  const stop = () => {
    unsub?.();
    unsub = null;
  };

  const subscribe = async () => {
    stop();
    const gen = ++generation;
    order.value = null;
    resolved.value = false;

    const id = orderId.value;
    if (!firestore || !id || !user.value) {
      resolved.value = true;
      return;
    }
    const { doc, onSnapshot } = await import("firebase/firestore");
    // The order id or the signed-in user changed while the import was in flight.
    if (gen !== generation) return;

    unsub = onSnapshot(
      doc(firestore, "compiledOrders", id),
      (snap) => {
        order.value = snap.exists()
          ? ({ ...snap.data(), id: snap.id } as CompiledOrder)
          : null;
        resolved.value = true;
      },
      (err) => {
        // Firestore rules deny reads of other people's orders. Surface that as
        // "not found" rather than a spinner that never ends.
        console.error("[payment result] order listener error:", err);
        order.value = null;
        resolved.value = true;
      },
    );
  };

  watch(
    [() => user.value?.uid ?? null, orderId, authLoading],
    ([, , loading]) => {
      if (!loading) void subscribe();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    generation++;
    stop();
  });

  const phase = computed<PaymentResultPhase>(() => {
    if (authLoading.value) return "loading";
    if (!user.value) return "signed-out";
    if (!orderId.value) return "not-found";
    if (!resolved.value) return "loading";
    return order.value ? "ready" : "not-found";
  });

  const view = computed<PaymentResultView | null>(() =>
    order.value ? paymentResultView(order.value, redirect.value.outcome) : null,
  );

  // These pages talk to the buyer. Anyone else who can read the order — the
  // seller, an admin — belongs on the order page itself.
  watch(order, (o) => {
    if (o && user.value && o.buyerUid !== user.value.uid) {
      void navigateTo(`/orders/${o.id}`, { replace: true });
    }
  });

  // (Re)start the FPX payment from here rather than sending the buyer back to
  // the order page to find the button. Anything create-bill refuses — no
  // delivery address, a stale quote — is fixable on the order page, so that is
  // where a refusal lands.
  const paying = ref(false);
  const payNow = async () => {
    const id = orderId.value;
    if (!id || paying.value) return;
    paying.value = true;
    try {
      const res = await authedFetch<{ url: string }>("/api/billplz/create-bill", {
        method: "POST",
        body: { orderId: id },
      });
      if (res.url) {
        // Keep the spinner up while the browser leaves for the bank.
        window.location.href = res.url;
        return;
      }
      paying.value = false;
      await navigateTo(`/orders/${id}`);
    } catch (e: any) {
      paying.value = false;
      alert(
        e?.data?.message ||
          "Couldn't start the payment. Please try again from the order page.",
      );
      await navigateTo(`/orders/${id}`);
    }
  };

  return { orderId, redirect, order, phase, view, paying, payNow };
};

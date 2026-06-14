// Seller funds — money collected on the seller's behalf via online (Billplz)
// payments, held by the platform until payout.
//
// Lifecycle per order:
//   paid/shipped            → LOCKED  ("awaiting delivery")
//   delivered, within hold  → LOCKED  (eligible date shown)
//   delivered + hold passed → AVAILABLE (seller can request payout)
//   payout requested        → QUEUED  (pending payout — admin executes)
//   payout executed         → PAID    (history)
//
// Manual/WhatsApp orders and POS sales never appear here — the seller already
// holds that money directly.

import { doc, updateDoc } from "firebase/firestore";
import { computed } from "vue";
import type { CompiledOrder } from "~/composables/useCompiledOrders";

// Hold window after delivery before funds unlock (dispute buffer).
export const PAYOUT_HOLD_DAYS = 3;
const HOLD_MS = PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000;

export type FundState = "locked" | "available" | "queued" | "paid";

export interface FundEntry {
  order: CompiledOrder;
  amount: number;
  state: FundState;
  // When a locked entry becomes available (null = not delivered yet).
  eligibleAt: number | null;
}

export const categorizeFunds = (orders: CompiledOrder[]): FundEntry[] => {
  const now = Date.now();
  const out: FundEntry[] = [];
  for (const o of orders) {
    if (o.paymentMethod !== "billplz") continue;
    if (!["paid", "shipped", "delivered"].includes(o.status)) continue;
    const amount = o.sellerPayout ?? o.total ?? 0;
    if (amount <= 0) continue;

    const ps = o.payoutStatus ?? "pending";
    if (ps === "paid") {
      out.push({ order: o, amount, state: "paid", eligibleAt: null });
    } else if (ps === "queued" || ps === "processing") {
      out.push({ order: o, amount, state: "queued", eligibleAt: null });
    } else if (o.status === "delivered" && o.deliveredAt) {
      const eligibleAt = o.deliveredAt + HOLD_MS;
      out.push({
        order: o,
        amount,
        state: now >= eligibleAt ? "available" : "locked",
        eligibleAt,
      });
    } else {
      out.push({ order: o, amount, state: "locked", eligibleAt: null });
    }
  }
  return out;
};

export const useSellerFunds = () => {
  const { firestore } = useFirebase();
  const { sellerCompiledOrders } = useCompiledOrders();

  const entries = computed(() => categorizeFunds(sellerCompiledOrders.value));

  const byState = (s: FundState) => entries.value.filter((e) => e.state === s);
  const sum = (list: FundEntry[]) =>
    Math.round(list.reduce((t, e) => t + e.amount, 0) * 100) / 100;

  const available = computed(() => byState("available"));
  const locked = computed(() => byState("locked"));
  const queued = computed(() => byState("queued"));
  const paidOut = computed(() =>
    byState("paid").sort(
      (a, b) => (b.order.payoutPaidAt ?? 0) - (a.order.payoutPaidAt ?? 0),
    ),
  );

  const availableTotal = computed(() => sum(available.value));
  const lockedTotal = computed(() => sum(locked.value));
  const queuedTotal = computed(() => sum(queued.value));
  // Funds the platform currently holds for the seller.
  const fundsTotal = computed(
    () => availableTotal.value + lockedTotal.value + queuedTotal.value,
  );

  // Seller requests payout of everything currently available.
  const requestPayout = async () => {
    if (!firestore) return 0;
    const targets = available.value;
    const now = Date.now();
    await Promise.all(
      targets.map((e) =>
        updateDoc(doc(firestore, "compiledOrders", e.order.id), {
          payoutStatus: "queued",
          payoutRequestedAt: now,
        }),
      ),
    );
    return targets.length;
  };

  return {
    entries,
    available,
    locked,
    queued,
    paidOut,
    availableTotal,
    lockedTotal,
    queuedTotal,
    fundsTotal,
    requestPayout,
  };
};

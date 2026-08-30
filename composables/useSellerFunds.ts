// Seller funds — money collected on the seller's behalf via online (Billplz)
// payments, held by the platform until payout.
//
// Lifecycle per order:
//   paid/shipped            → LOCKED  ("awaiting delivery")
//   delivered, within hold  → LOCKED  (eligible date shown)
//   delivered + hold passed → AVAILABLE (seller can request payout)
//   payout requested        → QUEUED  (admin executes the batch)
//   transfer in flight      → QUEUED  (Billplz processing)
//   Billplz confirmed       → PAID    (history)
//
// In-person (POS) sales never appear here — the seller already holds that
// money directly.
//
// The amounts shown here come from the same shared helpers the payout routes
// use, so what the seller is quoted is what the server will actually send.

import { computed } from "vue";
import { WITHDRAWAL_FEE } from "~/shared/pricing";
import type { CompiledOrder } from "~/composables/useCompiledOrders";
import {
  PAYOUT_HOLD_DAYS,
  recordedPayout,
  isPayoutTrackable,
  payoutEligibleAt,
} from "~/shared/payouts";

export { PAYOUT_HOLD_DAYS };

export type FundState = "locked" | "available" | "queued" | "paid";

export interface FundEntry {
  order: CompiledOrder;
  amount: number;
  state: FundState;
  // When a locked entry becomes available (null = not delivered yet).
  eligibleAt: number | null;
}

export const categorizeFunds = (
  orders: CompiledOrder[],
  now: number = Date.now(),
): FundEntry[] => {
  const out: FundEntry[] = [];
  for (const o of orders) {
    if (!isPayoutTrackable(o)) continue;
    // recordedPayout reads what settlement wrote, falling back to a fresh
    // calculation only for orders that predate those fields. See the note in
    // shared/payouts.ts for why this must never re-price.
    const ps = o.payoutStatus ?? "pending";
    const amount = recordedPayout(o);
    if (amount <= 0) continue;

    if (ps === "paid") {
      out.push({ order: o, amount, state: "paid", eligibleAt: null });
    } else if (ps === "queued" || ps === "processing") {
      out.push({ order: o, amount, state: "queued", eligibleAt: null });
    } else {
      const eligibleAt = payoutEligibleAt(o);
      out.push({
        order: o,
        amount,
        state: eligibleAt !== null && now >= eligibleAt ? "available" : "locked",
        eligibleAt,
      });
    }
  }
  return out;
};

export const useSellerFunds = () => {
  const { sellerCompiledOrders } = useCompiledOrders();
  const { authedFetch } = useAuthedFetch();

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

  // Most recent failure surfaced to the seller so a rejected transfer doesn't
  // silently look like it never happened.
  const lastFailureReason = computed(
    () =>
      entries.value
        .map((e) => e.order.payoutFailureReason)
        .find((r) => !!r) || "",
  );

  // Seller requests payout of everything currently available. The server
  // re-derives eligibility and amounts — this is a request, not an instruction.
  const requestPayout = async () => {
    return await authedFetch<{
      payoutId: string;
      orders: number;
      amount: number;
      grossAmount: number;
      withdrawalFee: number;
    }>("/api/payouts/request", { method: "POST" });
  };

  // What would actually land if they withdrew right now. The server recomputes
  // this and is the authority; showing it here means the button doesn't quote
  // one number and the bank another.
  const withdrawalFee = WITHDRAWAL_FEE;
  const payoutPreview = computed(() =>
    Math.round((availableTotal.value - WITHDRAWAL_FEE) * 100) / 100,
  );
  const canWithdraw = computed(() => payoutPreview.value > 0);

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
    lastFailureReason,
    withdrawalFee,
    payoutPreview,
    canWithdraw,
    requestPayout,
  };
};

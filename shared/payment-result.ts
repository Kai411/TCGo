// Where the buyer lands after paying — the state machine behind
// /payment/success and /payment/failed.
//
// Billplz sends the buyer back to a single redirect_url whatever happened at
// the bank, tagging the outcome as billplz[paid]=true|false. "true" is the
// bank's word, not ours: the order only becomes `paid` once the callback
// webhook has verified the signature and the amount. So the return pages
// OBSERVE the order document; they never settle anything themselves. Posting
// the redirect params to the webhook from the browser would race the real
// callback — its status check isn't transactional, and a double run books the
// courier twice.
//
// Dependency-free so it can be exercised with plain node.

export type RedirectOutcome = "paid" | "unpaid" | null;

export interface BillplzRedirect {
  billId: string;
  outcome: RedirectOutcome;
  paidAt: string | null;
}

/** First string value of a query param (vue-router hands back arrays for repeats). */
export const queryValue = (v: unknown): string => {
  const one = Array.isArray(v) ? v[0] : v;
  return typeof one === "string" ? one.trim() : "";
};

/** Reads the `billplz[...]` params Billplz appends to the redirect URL. */
export const parseBillplzRedirect = (
  query: Record<string, unknown>,
): BillplzRedirect => {
  const paid = queryValue(query["billplz[paid]"]).toLowerCase();
  return {
    billId: queryValue(query["billplz[id]"]),
    outcome: paid === "true" ? "paid" : paid === "false" ? "unpaid" : null,
    paidAt: queryValue(query["billplz[paid_at]"]) || null,
  };
};

export type PaymentResultView =
  | "success" // settled: paid, shipped or delivered
  | "confirming" // bank approved; waiting for the webhook to flip the order
  | "unpaid" // bank declined or the buyer backed out; order still open
  | "awaiting" // no outcome in the URL and the order simply isn't paid
  | "mismatch" // webhook refused to settle: collected ≠ billed
  | "merged" // absorbed into another order
  | "cancelled";

export interface PaymentResultOrder {
  status: string;
  paymentAmountMismatch?: unknown;
  mergedInto?: string;
}

const SETTLED = new Set(["paid", "shipped", "delivered"]);
const OPEN = new Set(["pending", "confirmed"]);

export const paymentResultView = (
  order: PaymentResultOrder,
  outcome: RedirectOutcome,
): PaymentResultView => {
  // Settled wins over whatever the URL says — the money is in.
  if (SETTLED.has(order.status)) return "success";
  if (order.status === "cancelled") return order.mergedInto ? "merged" : "cancelled";
  if (order.paymentAmountMismatch) return "mismatch";
  if (OPEN.has(order.status)) {
    if (outcome === "paid") return "confirming";
    if (outcome === "unpaid") return "unpaid";
  }
  return "awaiting";
};

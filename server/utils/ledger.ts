// Calls to the ledger Worker (workers/ledger) on Cloudflare.
//
// Stage 1 only shadows: Firestore still settles every order, and a ledger
// failure must never fail the Billplz callback. So every call here has a short
// timeout, never throws, and reports problems to the operations log.

import { noteError } from "~/server/utils/oplog";
import { buildShadowOrder, signLedgerRequest, type ShadowFees } from "~/server/utils/ledger-shadow";

const TIMEOUT_MS = 4000;

const ledgerConfig = () => {
  const config = useRuntimeConfig();
  const url = String(config.ledgerWorkerUrl || "").replace(/\/+$/, "");
  const secret = String(config.ledgerWorkerSecret || "");
  return url && secret ? { url, secret } : null;
};

export const ledgerEnabled = () => !!ledgerConfig();

/** POST a signed action. Throws on network errors and non-2xx answers. */
export const callLedger = async <T = any>(path: string, payload: unknown): Promise<T> => {
  const cfg = ledgerConfig();
  if (!cfg) throw new Error("ledger worker not configured");
  const body = JSON.stringify(payload);
  const ts = Date.now();
  const res = await fetch(`${cfg.url}${path}`, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-tcgo-timestamp": String(ts),
      "x-tcgo-signature": signLedgerRequest(cfg.secret, ts, body),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`ledger ${path} ${res.status}: ${data?.error ?? "no detail"}`);
  return data as T;
};

/**
 * Mirror a payment Firestore just settled. `callback` is Billplz's raw signed
 * body, forwarded so the Worker can check Billplz's signature itself.
 */
export const shadowPaymentToLedger = async (input: {
  orderId: string;
  order: any;
  fees: ShadowFees;
  paidSen: number;
  callback: Record<string, string>;
}): Promise<void> => {
  if (!ledgerEnabled()) return;
  try {
    const result = await callLedger<{ outcome: string; conflicts: { listingId: string; heldByOrder: string | null }[] }>(
      "/v1/shadow-payment",
      {
        callback: input.callback,
        paidSen: input.paidSen,
        order: buildShadowOrder(input.orderId, input.order, input.fees),
      },
    );
    if (result.conflicts?.length) {
      noteError({
        area: "payment",
        severity: "critical",
        code: "ledger.double_sell_detected",
        message: `Order ${input.orderId} was paid for ${result.conflicts.length} card(s) the ledger already shows as sold to another order.`,
        orderId: input.orderId,
        context: { conflicts: result.conflicts },
        hint: "Two buyers paid for the same card. Check both orders and refund one. Stage 2 of the ledger stops this from happening.",
      });
    }
    if (result.outcome === "recorded_duplicate_payment") {
      noteError({
        area: "payment",
        severity: "critical",
        code: "ledger.duplicate_payment",
        message: `Order ${input.orderId} was paid twice (second bill ${input.callback.id}).`,
        orderId: input.orderId,
        context: { billId: input.callback.id, paidSen: input.paidSen },
        hint: "The buyer paid two bills for one order. Refund the second one.",
      });
    }
  } catch (e: any) {
    noteError({
      area: "payment",
      severity: "warning",
      code: "ledger.shadow_failed",
      message: `The ledger didn't record order ${input.orderId}: ${String(e?.message ?? e).slice(0, 300)}`,
      orderId: input.orderId,
      context: { billId: input.callback?.id ?? null },
      hint: "Firestore settled the order normally. The ledger reconciliation will list it as missing.",
    });
  }
};

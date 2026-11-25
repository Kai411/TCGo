// The ledger database (Turso, libSQL) for Netlify functions.
//
// Stage 1 only shadows: Firestore still settles every order, and a ledger
// failure must never fail the Billplz callback. So shadowPaymentToLedger has a
// short timeout, never throws, and reports problems to the operations log.

import { createClient } from "@libsql/client/web";
import { noteError } from "~/server/utils/oplog";
import { buildShadowOrder, type ShadowFees } from "~/server/utils/ledger-shadow";
import { fromLibsql, type D1Like } from "~/server/ledger/db";
import { recordBillplzPayment } from "~/server/ledger/shadow";

const TIMEOUT_MS = 4000;

let cached: { key: string; db: D1Like } | null = null;

/** The ledger database, or null when NUXT_LEDGER_DATABASE_URL/TOKEN aren't set. */
export const ledgerDb = (): D1Like | null => {
  const config = useRuntimeConfig();
  const url = String(config.ledgerDatabaseUrl || "");
  const authToken = String(config.ledgerDatabaseToken || "");
  if (!url || !authToken) return null;
  const key = `${url}|${authToken}`;
  if (cached?.key !== key) cached = { key, db: fromLibsql(createClient({ url, authToken }) as any) };
  return cached.db;
};

export const ledgerEnabled = () => !!ledgerDb();

const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS)),
  ]);

/**
 * Mirror a payment Firestore just settled. `callback` is Billplz's body, whose
 * signature the webhook has already checked.
 */
export const shadowPaymentToLedger = async (input: {
  orderId: string;
  order: any;
  fees: ShadowFees;
  paidSen: number;
  callback: Record<string, string>;
}): Promise<void> => {
  const db = ledgerDb();
  if (!db) return;
  try {
    const result = await withTimeout(
      recordBillplzPayment(
        db,
        {
          callback: input.callback,
          paidSen: input.paidSen,
          order: buildShadowOrder(input.orderId, input.order, input.fees) as any,
        },
        Date.now(),
      ),
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

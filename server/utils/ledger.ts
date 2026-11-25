// The ledger database (Turso, libSQL) for Netlify functions.
//
// Stage 1 shadows payments: Firestore still settles every order, and a ledger
// failure must never fail the Billplz callback. So shadowPaymentToLedger has a
// short timeout, never throws, and reports problems to the operations log.
//
// Stage 2 holds the cards before a bill is made (holdForPayment). That one is
// on the checkout path on purpose: when the ledger is configured and can't be
// reached, no bill is made, because a bill without a hold is how one card
// gets sold twice. With the ledger not configured it does nothing.

import { createClient } from "@libsql/client/web";
import { noteError } from "~/server/utils/oplog";
import { buildShadowOrder, type ShadowFees } from "~/server/utils/ledger-shadow";
import { fromLibsql, type D1Like } from "~/server/ledger/db";
import { recordBillplzPayment } from "~/server/ledger/shadow";
import { attachBill, holdOrder, releaseHold, HoldError, type HoldResult } from "~/server/ledger/checkout";

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

// ── Stage 2: holds at checkout ───────────────────────────────────────

export { HoldError };

/**
 * Hold every card in a priced order for this buyer's payment. Null when the
 * ledger isn't configured. Throws HoldError when a card is taken or the order
 * has moved on, and a 503 when the ledger can't be reached.
 */
export const holdForPayment = async (orderId: string, order: any): Promise<HoldResult | null> => {
  const db = ledgerDb();
  if (!db) return null;
  const shadow = buildShadowOrder(orderId, order, { platformFee: 0, feeRate: 0, sstAmount: 0, sellerPayout: 0 });
  try {
    return await withTimeout(
      holdOrder(
        db,
        {
          firestoreId: shadow.firestoreId,
          source: shadow.source as "cart" | "auction",
          auctionId: shadow.auctionId,
          buyerUid: shadow.buyerUid,
          sellerUid: shadow.sellerUid,
          items: shadow.items,
          subtotalSen: shadow.subtotalSen,
          shippingSen: shadow.shippingSen,
          totalSen: shadow.totalSen,
          deliveryAddress: shadow.deliveryAddress,
        },
        Date.now(),
      ),
    );
  } catch (e: any) {
    if (e instanceof HoldError) throw e;
    noteError({
      area: "payment",
      severity: "critical",
      code: "ledger.hold_failed",
      message: `The ledger couldn't hold the cards for order ${orderId}: ${String(e?.message ?? e).slice(0, 300)}`,
      orderId,
      hint: "No bill was made and the buyer was asked to try again. Check that Turso is up and NUXT_LEDGER_DATABASE_URL/TOKEN are right.",
    });
    throw createError({
      statusCode: 503,
      message: "Payments are briefly unavailable. You haven't been charged. Try again in a minute.",
    });
  }
};

/** Record the new bill on the held order. Best-effort: the callback copes without it. */
export const attachBillToHold = async (hold: HoldResult, billId: string, amountSen: number): Promise<void> => {
  const db = ledgerDb();
  if (!db) return;
  try {
    await withTimeout(attachBill(db, { orderId: hold.orderId, billId, amountSen }, Date.now()));
  } catch (e: any) {
    noteError({
      area: "payment",
      severity: "warning",
      code: "ledger.attach_bill_failed",
      message: `The ledger didn't record bill ${billId}: ${String(e?.message ?? e).slice(0, 300)}`,
      context: { billId, ledgerOrderId: hold.orderId },
      hint: "The cards are still held. The payment callback records the payment anyway.",
    });
  }
};

/** Let the cards go when no bill was made. Best-effort: holds lapse on their own. */
export const releaseHoldFor = async (hold: HoldResult): Promise<void> => {
  const db = ledgerDb();
  if (!db) return;
  await withTimeout(releaseHold(db, hold.orderId)).catch(() => {});
};

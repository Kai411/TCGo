import type { CompiledOrder } from "~/utils/orders";
import { requireAdmin } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { ledgerCol, type LedgerEntry } from "~/server/utils/ledger";

// Per-order reconciliation of the Billplz holding account.
// Query: ?bankBalanceSen=<balance shown in the bank today> to compare.
//
// Reads the whole ledger and every Buyer Protection order; fine for the
// volumes of a young marketplace, move to per-day snapshots when it isn't.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = getAdminFirestore();
  const [ledgerSnap, orderSnap] = await Promise.all([
    ledgerCol(db).get(),
    db.collection("compiledOrders").where("paymentMethod", "==", "billplz").get(),
  ]);

  const entries = ledgerSnap.docs.map((d) => d.data() as LedgerEntry);
  const byKind: Record<string, number> = {};
  const byOrder = new Map<string, Partial<Record<LedgerEntry["kind"], number>>>();
  let holdingSen = 0;
  let unsweptFeesSen = 0;
  for (const e of entries) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + e.amountSen;
    if (e.cash) holdingSen += e.amountSen;
    if (e.kind === "platform_fee" && !e.sweepId) unsweptFeesSen += e.amountSen;
    if (e.orderId) {
      const o = byOrder.get(e.orderId) ?? {};
      o[e.kind] = (o[e.kind] ?? 0) + e.amountSen;
      byOrder.set(e.orderId, o);
    }
  }

  const issues: { orderId: string; problem: string }[] = [];
  let owedToSellersSen = 0;
  for (const d of orderSnap.docs) {
    const o = { ...(d.data() as CompiledOrder), id: d.id };
    const l = byOrder.get(o.id) ?? {};
    const paid = l.buyer_payment ?? 0;
    // What left (or is earmarked to leave) for this order, as positive sen.
    const out = -(l.seller_payout ?? 0) + (l.platform_fee ?? 0) - (l.refund ?? 0);
    if (o.paidAt && !paid) issues.push({ orderId: o.id, problem: "marked paid with no payment in the ledger" });
    if (paid && o.amountSen !== paid) issues.push({ orderId: o.id, problem: `paid ${paid} sen, order is ${o.amountSen}` });
    if (o.needsRefund) issues.push({ orderId: o.id, problem: "payment needs a refund" });
    if (o.payoutStatus === "processing") issues.push({ orderId: o.id, problem: "payout stuck in processing; check Billplz before retrying" });
    if (o.payoutStatus === "failed") issues.push({ orderId: o.id, problem: "payout failed" });
    if (o.status === "completed" && paid && out !== paid) {
      issues.push({ orderId: o.id, problem: `completed but payout + fee + refund (${out}) ≠ payment (${paid})` });
    }
    if (paid && !l.seller_payout && !l.refund) owedToSellersSen += paid;
  }

  const bankBalanceSen = Number(getQuery(event).bankBalanceSen);
  return {
    holdingSen,
    owedToSellersOrBuyersSen: owedToSellersSen,
    unsweptFeesSen,
    // Holding account should hold exactly what's owed out plus unswept fees.
    expectedHoldingSen: owedToSellersSen + unsweptFeesSen,
    bankBalanceSen: Number.isFinite(bankBalanceSen) ? bankBalanceSen : null,
    bankDifferenceSen: Number.isFinite(bankBalanceSen) ? bankBalanceSen - holdingSen : null,
    totalsByKind: byKind,
    issues,
  };
});

// Ledger stage 1 check: does the ledger database (Turso) agree with Firestore?
//
// Lists, for paid online orders in the last N days (default 7, at most 30):
// orders Firestore settled that the ledger is missing, ledger payments with no
// Firestore order, amounts that differ, and any card the ledger saw sold twice.
// Open it while signed in to Mint Condition: /api/mc/ledger/reconcile?days=7

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { ledgerDb } from "~/server/utils/ledger";
import { summary } from "~/server/ledger/shadow";
import { toSen } from "~/server/utils/ledger-shadow";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "finance.view");
  const db = ledgerDb();
  if (!db) {
    throw createError({ statusCode: 503, message: "The ledger database isn't configured on this site" });
  }

  const days = Math.min(30, Math.max(1, Math.floor(Number(getQuery(event).days) || 7)));
  const toMs = Date.now();
  const fromMs = toMs - days * 864e5;

  const ledger = await summary(db, fromMs, toMs);

  const snap = await getAdminFirestore()
    .collection("compiledOrders")
    .where("paidAt", ">=", fromMs)
    .get();
  const firestore = new Map<string, number>();
  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.paymentMethod !== "billplz" || !(Number(o.paidAt) <= toMs)) continue;
    firestore.set(d.id, Number(o.billplzAmountSen ?? toSen(o.total)));
  }

  const paid = ledger.orders.filter((r) => r.paymentStatus === "paid");
  const ledgerById = new Map(paid.map((r) => [r.firestoreId, r.paidSen]));

  const missingInLedger = [...firestore.keys()].filter((id) => !ledgerById.has(id));
  const missingInFirestore = [...ledgerById.keys()].filter((id) => !firestore.has(id));
  const amountMismatch = [...firestore.entries()]
    .filter(([id, sen]) => ledgerById.has(id) && ledgerById.get(id) !== sen)
    .map(([id, sen]) => ({ orderId: id, firestoreSen: sen, ledgerSen: ledgerById.get(id) }));
  const duplicatePayments = ledger.orders
    .filter((r) => r.paymentStatus === "duplicate")
    .map((r) => ({ orderId: r.firestoreId, billId: r.billId, paidSen: r.paidSen }));

  return {
    days,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    agrees:
      !missingInLedger.length && !missingInFirestore.length && !amountMismatch.length &&
      !duplicatePayments.length && !ledger.conflicts.length,
    firestorePaidOrders: firestore.size,
    ledgerPaidOrders: ledgerById.size,
    missingInLedger,
    missingInFirestore,
    amountMismatch,
    duplicatePayments,
    doubleSold: ledger.conflicts,
    balances: ledger.balances,
  };
});

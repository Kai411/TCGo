import type { CompiledOrder } from "~/utils/orders";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { getBill, verifyXSignature } from "~/server/utils/billplz";
import { ledgerCol, ledgerId, postEntry } from "~/server/utils/ledger";

// Billplz server-to-server callback (form-encoded). This is the only place a
// Buyer Protection order becomes "paid". Billplz retries until it gets a 200,
// so the handler is idempotent: the buyer_payment ledger entry is keyed by
// order id and created at most once.
export default defineEventHandler(async (event) => {
  const fields = (await readBody<Record<string, string>>(event)) ?? {};
  if (!verifyXSignature(fields)) {
    throw createError({ statusCode: 400, message: "Bad signature" });
  }
  if (fields.paid !== "true") return "OK";

  // Don't trust the callback body for amounts: ask Billplz for the bill.
  const bill = await getBill(fields.id);
  if (!bill.paid) return "OK";

  const db = getAdminFirestore();
  const match = await db
    .collection("compiledOrders")
    .where("billplzBillId", "==", bill.id)
    .limit(1)
    .get();
  if (match.empty) {
    console.error("[billplz] paid bill with no order", bill.id);
    throw createError({ statusCode: 404, message: "Unknown bill" });
  }
  const ref = match.docs[0].ref;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = { ...(snap.data() as CompiledOrder), id: snap.id };
    const already = await tx.get(ledgerCol(db).doc(ledgerId(order.id, "buyer_payment")));
    if (already.exists) return;

    postEntry(db, tx, {
      scope: order.id,
      kind: "buyer_payment",
      amountSen: bill.paid_amount,
      orderId: order.id,
      sellerUid: order.sellerUid,
      externalRef: bill.id,
      createdBy: "billplz-callback",
    });

    const amountOk = bill.paid_amount === order.amountSen;
    if (order.status === "confirmed" && amountOk) {
      tx.update(ref, { status: "paid", paidAt: Date.now() });
    } else {
      // Money arrived but the order can't take it (cancelled meanwhile, or
      // the amount is off). Keep the record and flag it for an admin refund.
      tx.update(ref, { needsRefund: true });
      console.error("[billplz] payment needs review", order.id, order.status, bill.paid_amount);
    }
  });
  return "OK";
});

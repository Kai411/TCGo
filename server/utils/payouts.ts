import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { canTransition, type CompiledOrder } from "~/utils/orders";
import { createPaymentOrder, type PayoutAccount } from "~/server/utils/billplz";
import { ledgerCol, platformFeeSen, postEntry } from "~/server/utils/ledger";

// Money out of the holding account. Pattern for every outgoing transfer:
//   1. transaction: check state, mark "processing" (a lock other callers see)
//   2. call Billplz outside the transaction (can't be rolled back)
//   3. transaction: post ledger entries and the final state, or mark "failed"
// A crash between 2 and 3 leaves the order "processing"; reconciliation lists
// those so an admin can check the Payment Order in Billplz before retrying.

const fail = (statusCode: number, message: string) => createError({ statusCode, message });

export const releasePayout = async (
  db: Firestore,
  orderId: string,
  by: string,
  opts: { force?: boolean } = {},
) => {
  const ref = db.collection("compiledOrders").doc(orderId);

  const { order, account } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw fail(404, "Order not found");
    const o = { ...(snap.data() as CompiledOrder), id: snap.id };
    if (o.paymentMethod !== "billplz" || !o.paidAt) throw fail(409, "Not a Buyer Protection order");
    if (o.needsRefund) throw fail(409, "Order is flagged for refund");
    if (!canTransition(o, "completed", "admin")) throw fail(409, `Order is ${o.status}`);
    if (o.payoutStatus !== "pending" && o.payoutStatus !== "failed") {
      throw fail(409, `Payout is already ${o.payoutStatus}`);
    }
    if (o.status === "delivered" && !opts.force && Date.now() < (o.payoutEligibleAt ?? Infinity)) {
      throw fail(409, "Buyer Protection window is still open");
    }
    const acc = await tx.get(db.collection("payoutAccounts").doc(o.sellerUid));
    if (!acc.exists) throw fail(409, "Seller hasn't added a payout account");
    tx.update(ref, { payoutStatus: "processing", payoutStartedAt: Date.now() });
    return { order: o, account: acc.data() as PayoutAccount };
  });

  const amountSen = order.amountSen ?? 0;
  const feeSen = platformFeeSen(amountSen);
  const payoutSen = amountSen - feeSen;

  let paymentOrderId: string;
  try {
    const po = await createPaymentOrder({
      account,
      totalSen: payoutSen,
      description: `TCGo order ${order.id.slice(0, 8)}`,
      referenceId: order.id,
    });
    paymentOrderId = po.id;
  } catch (e: any) {
    await ref.update({ payoutStatus: "failed", payoutError: String(e?.data?.error?.message || e?.message || e).slice(0, 500) });
    throw fail(502, "Billplz rejected the payout; see payoutError on the order");
  }

  await db.runTransaction(async (tx) => {
    postEntry(db, tx, {
      scope: order.id,
      kind: "seller_payout",
      amountSen: -payoutSen,
      orderId: order.id,
      sellerUid: order.sellerUid,
      externalRef: paymentOrderId,
      createdBy: by,
    });
    if (feeSen > 0) {
      postEntry(db, tx, {
        scope: order.id,
        kind: "platform_fee",
        amountSen: feeSen,
        orderId: order.id,
        sellerUid: order.sellerUid,
        sweepId: null,
        createdBy: by,
      });
    }
    tx.update(ref, {
      status: "completed",
      completedAt: Date.now(),
      payoutStatus: "queued",
      payoutOrderId: paymentOrderId,
      payoutSen,
      feeSen,
      payoutError: FieldValue.delete(),
    });
  });

  return { orderId: order.id, paymentOrderId, payoutSen, feeSen };
};

// Orders whose Buyer Protection window has closed and are ready to pay out.
export const duePayouts = async (db: Firestore, limit = 50) => {
  const snap = await db
    .collection("compiledOrders")
    .where("status", "==", "delivered")
    .where("payoutStatus", "==", "pending")
    .where("payoutEligibleAt", "<=", Date.now())
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.id);
};

// Move every earned-but-unswept platform fee to TCGo's own bank account in one
// Payment Order, and record it. Fees are only ever accrued on completed
// orders, so nothing here touches money still owed to a buyer or seller.
export const sweepFees = async (db: Firestore, by: string) => {
  const c = useRuntimeConfig();
  const account: PayoutAccount = {
    bankCode: c.tcgoBankCode as string,
    accountNumber: c.tcgoBankAccount as string,
    holderName: c.tcgoAccountName as string,
    identityNumber: c.tcgoIdentityNumber as string,
  };
  if (!account.bankCode || !account.accountNumber || !account.holderName || !account.identityNumber) {
    throw fail(500, "TCGo's own payout account isn't configured");
  }

  const sweepId = `sweep_${Date.now()}`;
  const sweepRef = db.collection("feeSweeps").doc(sweepId);
  const unswept = ledgerCol(db).where("kind", "==", "platform_fee").where("sweepId", "==", null);

  const { ids, totalSen } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(unswept);
    const ids = snap.docs.map((d) => d.id);
    const totalSen = snap.docs.reduce((s, d) => s + (d.get("amountSen") as number), 0);
    if (!ids.length || totalSen <= 0) throw fail(409, "No fees to sweep");
    for (const d of snap.docs) tx.update(d.ref, { sweepId });
    tx.create(sweepRef, { id: sweepId, status: "processing", totalSen, entryIds: ids, createdAt: Date.now(), createdBy: by });
    return { ids, totalSen };
  });

  let paymentOrderId: string;
  try {
    const po = await createPaymentOrder({
      account,
      totalSen,
      description: `TCGo platform fees ${sweepId}`,
      referenceId: sweepId,
    });
    paymentOrderId = po.id;
  } catch (e: any) {
    // Release the fees so the next sweep picks them up again.
    const batch = db.batch();
    for (const id of ids) batch.update(ledgerCol(db).doc(id), { sweepId: null });
    batch.update(sweepRef, { status: "failed", error: String(e?.message || e).slice(0, 500) });
    await batch.commit();
    throw fail(502, "Billplz rejected the fee sweep");
  }

  await db.runTransaction(async (tx) => {
    postEntry(db, tx, {
      scope: sweepId,
      kind: "fee_sweep",
      amountSen: -totalSen,
      externalRef: paymentOrderId,
      createdBy: by,
    });
    tx.update(sweepRef, { status: "queued", paymentOrderId });
  });
  return { sweepId, totalSen, entries: ids.length, paymentOrderId };
};

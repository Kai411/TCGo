import type { CompiledOrder } from "~/utils/orders";
import { canTransition } from "~/utils/orders";
import { requireAdmin } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { ledgerCol, ledgerId, postEntry } from "~/server/utils/ledger";

// Record that a Buyer Protection payment went back to the buyer. The transfer
// itself is made by hand (or a Payment Order to the buyer) first; this logs it.
// Body: { externalRef: bank/Payment Order reference, reason?: string }
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = getRouterParam(event, "id")!;
  const body = (await readBody<{ externalRef?: string; reason?: string }>(event)) ?? {};
  if (!body.externalRef) throw createError({ statusCode: 400, message: "externalRef required" });

  const db = getAdminFirestore();
  const ref = db.collection("compiledOrders").doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
    const o = { ...(snap.data() as CompiledOrder), id: snap.id };
    const paid = await tx.get(ledgerCol(db).doc(ledgerId(o.id, "buyer_payment")));
    if (!paid.exists) throw createError({ statusCode: 409, message: "No payment recorded for this order" });

    // Either a normal refund (paid/disputed → refunded) or money that arrived
    // after the order was cancelled (needsRefund).
    const viaTransition = canTransition(o, "refunded", "admin");
    if (!viaTransition && !o.needsRefund) {
      throw createError({ statusCode: 409, message: `Can't refund an order that is ${o.status}` });
    }

    postEntry(db, tx, {
      scope: o.id,
      kind: "refund",
      amountSen: -(paid.get("amountSen") as number),
      orderId: o.id,
      sellerUid: o.sellerUid,
      externalRef: body.externalRef!.slice(0, 120),
      createdBy: admin.uid,
    });
    const now = Date.now();
    const patch: Record<string, unknown> = { needsRefund: false, refundedAt: now };
    if (viaTransition) {
      patch.status = "refunded";
      patch.payoutStatus = null;
      patch.cancelReason = (body.reason || "Refunded").slice(0, 500);
      // Never shipped: put the cards back on sale.
      if (o.status === "paid") {
        for (const item of o.items) {
          tx.update(db.collection("cards").doc(item.cardId), { sold: false, soldAt: null });
        }
      }
    }
    tx.update(ref, patch);
  });
  return { ok: true };
});

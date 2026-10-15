// Staff sends a buyer's refund as a Billplz Payment Order.
//
// Same safety property as payouts: the refund is claimed (requested → processing)
// in a transaction BEFORE Billplz is called, so a double-click or two staff at
// once can't send the money twice. Any failure puts it back to `requested`
// with the reason, rather than leaving it stuck in `processing`.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { createMassPaymentCollection, createMassPaymentInstruction, mapInstructionStatus } from "~/server/utils/billplz";
import { noteAction, noteError } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "payouts.execute");
  const { refundId } = (await readBody(event)) as { refundId?: string };
  if (!refundId) throw createError({ statusCode: 400, message: "refundId required" });

  const db = getAdminFirestore();
  const ref = db.collection("refunds").doc(refundId);

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Refund not found" });
    const r = snap.data() as any;
    if (r.status !== "requested") {
      throw createError({ statusCode: 409, message: `Refund is already ${r.status}` });
    }
    tx.update(ref, { status: "processing", executedAt: Date.now(), executedByUid: actor.staffId, failureReason: null });
    return r;
  });

  const orderRef = db.collection("compiledOrders").doc(claimed.orderId);
  const release = async (reason: string) => {
    await ref.update({ status: "requested", executedAt: null, executedByUid: null, failureReason: reason });
  };

  // Nothing to send when the fee took the whole (tiny) order total.
  if (!(claimed.amount > 0)) {
    const now = Date.now();
    await ref.update({ status: "paid", paidAt: now, note: "Nothing to transfer after the processing fee." });
    await orderRef.update({ refundStatus: "refunded", refundedAt: now });
    return { ok: true, status: "paid", transferred: 0 };
  }

  if (claimed.autoPayoutSupported === false) {
    await release("Billplz can't send to this bank automatically. Transfer by hand.");
    throw createError({ statusCode: 400, message: "Automated refund isn't available for this bank." });
  }

  try {
    const config = useRuntimeConfig();
    const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;
    const shortId = String(claimed.orderId).slice(0, 8).toUpperCase();
    const collection = await createMassPaymentCollection(
      `TCGo refund ${shortId}`,
      `${siteUrl}/api/billplz/payout-callback`,
    );
    const instruction = await createMassPaymentInstruction({
      collectionId: collection.id,
      bankCode: claimed.recipient.bankCode,
      bankAccountNumber: claimed.recipient.bankAccountNumber,
      identityNumber: claimed.recipient.identityNumber,
      name: claimed.recipient.name,
      description: `TCGo refund - order ${shortId}`,
      amount: claimed.amount,
      email: claimed.buyerEmail || undefined,
    });

    const mapped = mapInstructionStatus(instruction.status);
    const now = Date.now();
    await ref.update({
      billplzCollectionId: collection.id,
      billplzInstructionId: instruction.id,
      billplzStatus: instruction.status ?? null,
      status: mapped === "paid" ? "paid" : mapped === "failed" ? "failed" : "processing",
      ...(mapped === "paid" ? { paidAt: now } : {}),
    });
    await orderRef.update({
      refundStatus: mapped === "paid" ? "refunded" : mapped === "failed" ? "failed" : "processing",
      ...(mapped === "paid" ? { refundedAt: now } : {}),
    });

    noteAction({
      area: "payout",
      action: "refund.executed",
      actor,
      subject: refundId,
      summary: `Sent refund of RM ${Number(claimed.amount).toFixed(2)} for order ${shortId} (${mapped}).`,
    });
    return { ok: true, status: mapped, instructionId: instruction.id };
  } catch (e: any) {
    const message = e?.data?.message || e?.message || "Billplz rejected the refund";
    await release(message);
    noteError({
      area: "payout",
      severity: "critical",
      code: "refund.billplz_rejected",
      message: `Billplz rejected refund ${refundId}: ${message}`,
      orderId: claimed.orderId,
      userUid: claimed.buyerUid,
      context: { amount: claimed.amount, bankCode: claimed.recipient?.bankCode },
      hint: "The refund is back in the queue. Check the Billplz float and the buyer's bank details before retrying.",
      error: e,
    });
    throw createError({ statusCode: 400, message });
  }
});

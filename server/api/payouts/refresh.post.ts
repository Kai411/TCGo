// Poll Billplz for the current state of an in-flight payout and settle it.
//
// Billplz Mass Payment doesn't give us a callback we control, so status is
// pulled rather than pushed — the admin console calls this, and it's safe to
// call repeatedly (settling is idempotent on the batch's status).

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireAdmin } from "~/server/utils/auth";
import { getMassPaymentInstruction, mapInstructionStatus } from "~/server/utils/billplz";
import { settlePayout } from "~/server/utils/payouts";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { payoutId } = (await readBody(event)) as { payoutId?: string };
  if (!payoutId) throw createError({ statusCode: 400, message: "payoutId required" });

  const db = getAdminFirestore();
  const ref = db.collection("payouts").doc(payoutId);
  const snap = await ref.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Payout not found" });
  const batch = snap.data() as PayoutBatch;

  if (batch.status === "paid" || batch.status === "failed") {
    return { ok: true, status: batch.status, unchanged: true };
  }
  if (!batch.billplzInstructionId) {
    return { ok: true, status: batch.status, unchanged: true, note: "not sent yet" };
  }

  const instruction = await getMassPaymentInstruction(batch.billplzInstructionId);
  const mapped = mapInstructionStatus(instruction.status);

  if (mapped === "processing") {
    await ref.update({ billplzStatus: instruction.status ?? null });
    return { ok: true, status: "processing", raw: instruction.status };
  }

  await settlePayout(db, ref, batch, mapped, {
    rawStatus: instruction.status,
    failureReason:
      mapped === "failed" ? `Billplz reported "${instruction.status}"` : undefined,
  });
  return { ok: true, status: mapped, raw: instruction.status };
});

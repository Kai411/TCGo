// Record a payout that was transferred by hand — the escape hatch for banks
// Billplz can't reach automatically, and for rescuing a batch that Billplz
// rejected but the admin settled another way. A bank reference is mandatory:
// a manual payout with no reference isn't an audit trail.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { settlePayout } from "~/server/utils/payouts";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "payouts.manual");
  const { payoutId, reference } = (await readBody(event)) as {
    payoutId?: string;
    reference?: string;
  };
  if (!payoutId) throw createError({ statusCode: 400, message: "payoutId required" });
  const ref_ = String(reference || "").trim();
  if (!ref_) {
    throw createError({ statusCode: 400, message: "Bank reference required" });
  }

  const db = getAdminFirestore();
  const ref = db.collection("payouts").doc(payoutId);
  const snap = await ref.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Payout not found" });
  const batch = snap.data() as PayoutBatch;
  if (batch.status === "paid") {
    return { ok: true, status: "paid", unchanged: true };
  }

  await ref.update({ executedByUid: actor.staffId,
    executedByName: actor.name, executedAt: batch.executedAt ?? Date.now() });
  await settlePayout(db, ref, batch, "paid", { manualReference: ref_ });

  noteAction({
    area: "payout",
    action: "payout.marked_manual",
    actor,
    subject: payoutId,
    summary: `Recorded RM${batch.amount?.toFixed?.(2) ?? batch.amount} paid by hand (ref ${ref_}).`,
    detail: { amount: batch.amount, reference: ref_, orderCount: batch.orderIds?.length },
    event,
  });

  return { ok: true, status: "paid" };
});

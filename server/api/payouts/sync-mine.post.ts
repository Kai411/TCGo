// Seller-triggered reconciliation of their own in-flight payouts.
//
// The callback is the primary path, but a webhook that never arrives (bad
// deploy, wrong siteUrl, Billplz retry exhausted) would otherwise strand a
// seller on "pending" forever with no way out that doesn't involve an admin.
// This lets the funds page heal itself.
//
// Scoped hard to the caller's own payouts, and reuses the same authoritative
// read + settlement as the admin refresh, so it can't invent an outcome.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { getMassPaymentInstruction, mapInstructionStatus } from "~/server/utils/billplz";
import { settlePayout } from "~/server/utils/payouts";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const db = getAdminFirestore();

  const snap = await db
    .collection("payouts")
    .where("sellerUid", "==", caller.uid)
    .where("status", "==", "processing")
    .limit(10)
    .get();

  let settled = 0;
  for (const doc of snap.docs) {
    const batch = { ...(doc.data() as PayoutBatch), id: doc.id };
    if (!batch.billplzInstructionId) continue;
    try {
      const instruction = await getMassPaymentInstruction(batch.billplzInstructionId);
      const mapped = mapInstructionStatus(instruction.status);
      if (mapped === "processing") {
        await doc.ref.update({ billplzStatus: instruction.status ?? null });
        continue;
      }
      await settlePayout(db, doc.ref, batch, mapped, {
        rawStatus: instruction.status,
        failureReason:
          mapped === "failed" ? `Billplz reported "${instruction.status}"` : undefined,
      });
      settled++;
    } catch (e) {
      // One unreadable payout must not block the rest.
      console.error("[payouts/sync-mine]", batch.id, e);
    }
  }
  return { ok: true, checked: snap.size, settled };
});

// Applying a terminal payout outcome to the ledger and the orders it covers.
//
// A failed payout releases its orders back to `pending` so the funds become
// available again and the seller can retry — money must never be stranded by a
// bank rejection.

import type { Firestore, DocumentReference } from "firebase-admin/firestore";
import type { PayoutBatch, PayoutBatchStatus } from "~/shared/payout-ledger";

export const settlePayout = async (
  db: Firestore,
  ref: DocumentReference,
  batch: PayoutBatch,
  status: PayoutBatchStatus,
  opts: { rawStatus?: string; failureReason?: string; manualReference?: string } = {},
) => {
  const now = Date.now();
  const ledgerPatch: Record<string, any> = { status };
  if (opts.rawStatus !== undefined) ledgerPatch.billplzStatus = opts.rawStatus;
  if (opts.manualReference) ledgerPatch.manualReference = opts.manualReference;
  if (status === "paid") ledgerPatch.paidAt = now;
  if (status === "failed") {
    ledgerPatch.failedAt = now;
    ledgerPatch.failureReason = opts.failureReason || "Transfer rejected by the bank";
  }

  const writes = db.batch();
  writes.update(ref, ledgerPatch);
  for (const id of batch.orderIds) {
    const orderRef = db.collection("compiledOrders").doc(id);
    if (status === "failed") {
      // Back to available so the seller can request again.
      writes.update(orderRef, {
        payoutStatus: "pending",
        payoutId: null,
        payoutRequestedAt: null,
        payoutFailureReason: opts.failureReason || "Transfer rejected by the bank",
      });
    } else {
      writes.update(orderRef, {
        payoutStatus: status,
        ...(status === "paid" ? { payoutPaidAt: now } : {}),
      });
    }
  }
  await writes.commit();
};

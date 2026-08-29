// Closing out a counter sale, from whichever side reports the outcome first.
//
// Two things race: the provider's webhook and the till's own polling. Both
// call this. It is idempotent on the sale's status — the first caller to move
// it out of `awaiting_payment` wins, and the loser is a no-op — so a webhook
// that arrives while the seller is staring at the QR can't double-settle.

import type { Firestore } from "firebase-admin/firestore";
import { settleItems, releaseItems } from "~/server/utils/pos-reservations";
import type { PosSaleStatus } from "~/shared/pos-sale";

export type PosOutcome = "paid" | "failed" | "cancelled";

export interface FinaliseResult {
  changed: boolean;
  status: PosSaleStatus;
}

export const finalisePosSale = async (
  db: Firestore,
  saleId: string,
  outcome: PosOutcome,
  reason?: string,
): Promise<FinaliseResult> => {
  const saleRef = db.collection("posSales").doc(saleId);

  // Claim the transition transactionally. Without this, a webhook and a poll
  // landing together could both read `awaiting_payment` and both go on to
  // settle — marking stock sold twice and, worse, releasing it after settling
  // if the two outcomes disagreed.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(saleRef);
    if (!snap.exists) return null;
    const sale = snap.data() as any;
    if (sale.status !== "awaiting_payment") {
      return { alreadyDone: true, status: sale.status as PosSaleStatus, sale };
    }
    tx.update(saleRef, {
      status: outcome,
      ...(outcome === "paid" ? { paidAt: Date.now() } : {}),
      ...(reason ? { failedReason: reason } : {}),
      // The QR is worthless once the sale is closed, and it's the one field
      // here that's sensitive to leave lying around.
      qrPayload: null,
      updatedAt: Date.now(),
    });
    return { alreadyDone: false, status: outcome, sale };
  });

  if (!claim) throw new Error(`No POS sale ${saleId}`);
  if (claim.alreadyDone) return { changed: false, status: claim.status };

  // Stock moves only after the status is safely claimed.
  if (outcome === "paid") {
    await settleItems(db, {
      saleId,
      lines: (claim.sale.lines ?? []).map((l: any) => ({
        itemId: l.itemId,
        soldPrice: l.soldPrice,
      })),
    });
  } else {
    await releaseItems(db, saleId);
  }

  return { changed: true, status: outcome };
};

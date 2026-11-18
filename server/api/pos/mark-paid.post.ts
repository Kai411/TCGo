// The seller saw the money arrive in their own bank or e-wallet app.
//
// This is the whole confirmation: the customer paid the shop's own static QR,
// so no gateway can tell TCGo it happened. The seller's word settles the sale
// and marks the stock sold.
//
// Normally the hold is still live and this is one call to finalisePosSale.
// The awkward case is a seller who confirms after the hold lapsed (a slow
// bank notification, a chatty customer). The customer has paid, so refusing
// would be wrong, but the card was back on sale in the meantime. So: if every
// card is still sellable, settle; if one sold online in the gap, say so and
// let the seller sort it out with the customer.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { finalisePosSale } from "~/server/utils/pos-settle";
import { checkStockAvailability } from "~/server/utils/pos-reservations";

const EXPIRED = "Payment window expired";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { saleId } = (await readBody(event)) as { saleId?: string };
  if (!saleId) throw createError({ statusCode: 400, message: "saleId required" });

  const db = getAdminFirestore();
  const saleRef = db.collection("posSales").doc(saleId);
  const snap = await saleRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Sale not found" });

  const sale = snap.data() as any;
  if (sale.sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your sale" });
  }
  if (sale.status === "paid") return { status: "paid", settled: false };

  const lapsed =
    (sale.status === "awaiting_payment" && (sale.reservedUntil ?? 0) < Date.now()) ||
    // Another till's sweep already closed it out as expired.
    (sale.status === "cancelled" && sale.failedReason === EXPIRED);

  if (sale.status !== "awaiting_payment" && !lapsed) {
    throw createError({ statusCode: 409, message: "This sale was already closed." });
  }

  if (lapsed) {
    const itemIds = (sale.lines ?? []).map((l: any) => l.itemId);
    const blocked = await checkStockAvailability(db, itemIds, caller.uid);
    if (blocked.length) {
      if (sale.status === "awaiting_payment") {
        await finalisePosSale(db, saleId, "cancelled", EXPIRED).catch(() => {});
      }
      throw createError({
        statusCode: 409,
        message:
          blocked.length === 1
            ? `The hold ran out and ${blocked[0]!.cardName} sold online meanwhile. Refund the customer for it or swap the card.`
            : `The hold ran out and ${blocked.length} cards sold online meanwhile. Refund the customer for them or swap the cards.`,
        data: { blocked },
      });
    }
    // Swept as expired by another till: reopen it so the one settle path
    // below claims it, rather than writing a second way to mark stock sold.
    if (sale.status === "cancelled") {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(saleRef);
        const s = fresh.data() as any;
        if (s?.status === "cancelled" && s?.failedReason === EXPIRED) {
          tx.update(saleRef, { status: "awaiting_payment", failedReason: null, updatedAt: Date.now() });
        }
      });
    }
  }

  const result = await finalisePosSale(db, saleId, "paid");
  return { status: result.status, settled: result.changed };
});

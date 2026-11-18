// Seller backs out of a counter QR payment — customer changed their mind,
// wrong card scanned, whatever. Releases the holds.
//
// There is no gateway to ask whether the customer paid: the money goes to the
// shop's own QR, and only the seller can see it arrive. So Cancel means
// exactly what the seller says. If they did get paid, they tap "Mark as paid"
// instead, which settles the sale.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { finalisePosSale } from "~/server/utils/pos-settle";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { saleId } = (await readBody(event)) as { saleId?: string };
  if (!saleId) throw createError({ statusCode: 400, message: "saleId required" });

  const db = getAdminFirestore();
  const snap = await db.collection("posSales").doc(saleId).get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Sale not found" });

  const sale = snap.data() as any;
  if (sale.sellerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your sale" });
  }
  if (sale.status !== "awaiting_payment") {
    return { status: sale.status, cancelled: false };
  }

  const result = await finalisePosSale(db, saleId, "cancelled", "Cancelled by seller");
  return { status: result.status, cancelled: result.changed };
});

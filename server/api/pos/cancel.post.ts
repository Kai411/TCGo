// Seller backs out of a counter payment — customer changed their mind, wrong
// card scanned, whatever. Releases the holds and voids the charge.
//
// Deliberately re-checks with the provider first. A customer can pay in the
// second between the seller reaching for Cancel and the tap landing, and
// cancelling a paid sale would hand back stock that has been sold.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { posPaymentProvider } from "~/server/utils/pos-payment";
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

  const sellerSnap = await db.collection("users").doc(caller.uid).get();
  const merchantKey = (sellerSnap.data() as any)?.hitpayMerchantKey || undefined;

  if (sale.chargeId) {
    try {
      const { status: providerStatus } = await posPaymentProvider().chargeStatus(
        sale.chargeId,
        merchantKey,
      );
      if (providerStatus === "paid") {
        // Too late — the customer paid. Settle instead of cancelling.
        const result = await finalisePosSale(db, saleId, "paid");
        return { status: result.status, cancelled: false, paidInstead: true };
      }
    } catch {
      // Can't reach the provider. Cancelling is still the right call: an
      // unpaid QR left live is worse than a hold released early, and the
      // webhook will settle it if the customer does pay.
    }
    await posPaymentProvider().cancelCharge(sale.chargeId, merchantKey).catch(() => {});
  }

  const result = await finalisePosSale(db, saleId, "cancelled", "Cancelled by seller");
  return { status: result.status, cancelled: result.changed };
});

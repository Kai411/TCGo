// What happened to the QR the till is showing?
//
// The webhook is authoritative, but it can be slow, and in local development
// it can't reach localhost at all. So the till polls, and a poll that finds a
// completed charge settles the sale itself — finalisePosSale is idempotent,
// so whichever of the two gets there first is fine.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { posPaymentProvider } from "~/server/utils/pos-payment";
import { sellerMerchant } from "~/server/utils/pos-merchant";
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

  // Already resolved — the webhook beat us to it.
  if (sale.status !== "awaiting_payment") {
    return { status: sale.status, settled: sale.status === "paid" };
  }

  // The hold has lapsed and nobody paid. Close it out so the seller isn't
  // left watching a QR that can no longer complete.
  if (sale.reservedUntil && sale.reservedUntil < Date.now()) {
    const result = await finalisePosSale(
      db,
      saleId,
      "cancelled",
      "Payment window expired",
    );
    return { status: result.status, settled: false, expired: true };
  }

  if (!sale.chargeId) return { status: "awaiting_payment", settled: false };

  const merchant = await sellerMerchant(db, caller.uid);

  let state: { status: string; lastAttemptFailed: boolean };
  try {
    state = await posPaymentProvider().chargeStatus(sale.chargeId, merchant);
  } catch {
    // A provider hiccup is not a failed payment. Keep the sale open and let
    // the till ask again — releasing stock here could strand a customer who
    // has already paid.
    return { status: "awaiting_payment", settled: false, unreachable: true };
  }

  if (state.status === "paid") {
    const result = await finalisePosSale(db, saleId, "paid");
    return { status: result.status, settled: true };
  }
  if (state.status === "failed" || state.status === "expired") {
    const result = await finalisePosSale(
      db,
      saleId,
      "failed",
      state.status === "expired" ? "Payment window expired" : "Payment declined",
    );
    return { status: result.status, settled: false };
  }

  // Declined, but the QR is still live and the customer can try again. The
  // sale deliberately stays open and the cards stay held — releasing them
  // here would pull the stock while the customer reaches for another card.
  return {
    status: "awaiting_payment",
    settled: false,
    lastAttemptFailed: state.lastAttemptFailed,
  };
});

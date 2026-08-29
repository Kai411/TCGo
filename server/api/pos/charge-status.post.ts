// What happened to the QR the till is showing?
//
// The webhook is authoritative, but it can be slow, and in local development
// it can't reach localhost at all. So the till polls, and a poll that finds a
// completed charge settles the sale itself — finalisePosSale is idempotent,
// so whichever of the two gets there first is fine.

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

  const sellerSnap = await db.collection("users").doc(caller.uid).get();
  const merchantKey = (sellerSnap.data() as any)?.hitpayMerchantKey || undefined;

  let providerStatus: string;
  try {
    providerStatus = await posPaymentProvider().chargeStatus(sale.chargeId, merchantKey);
  } catch {
    // A provider hiccup is not a failed payment. Keep the sale open and let
    // the till ask again — releasing stock here could strand a customer who
    // has already paid.
    return { status: "awaiting_payment", settled: false, unreachable: true };
  }

  if (providerStatus === "paid") {
    const result = await finalisePosSale(db, saleId, "paid");
    return { status: result.status, settled: true };
  }
  if (providerStatus === "failed" || providerStatus === "expired") {
    const result = await finalisePosSale(
      db,
      saleId,
      "failed",
      providerStatus === "expired" ? "Payment window expired" : "Payment declined",
    );
    return { status: result.status, settled: false };
  }

  return { status: "awaiting_payment", settled: false };
});

// HitPay payment callback for counter sales.
//
// Authoritative for marking stock sold: the redirect can be triggered by
// anyone, and the till's polling is a convenience. An unverified callback
// never settles anything — verifyPosWebhook returns false when no salt is
// configured, which fails closed by design.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { verifyPosWebhook } from "~/server/utils/pos-payment";
import { finalisePosSale } from "~/server/utils/pos-settle";
import { noteError } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  // The signature covers the bytes as sent — parsing and re-serialising can
  // reorder keys and break the digest.
  const raw = (await readRawBody(event)) || "";
  const signature =
    getHeader(event, "hitpay-signature") || getHeader(event, "x-hitpay-signature") || "";

  if (!verifyPosWebhook(String(raw), signature)) {
    console.error("[pos webhook] bad signature");
    throw createError({ statusCode: 403, message: "Invalid signature" });
  }

  let body: any;
  try {
    body = JSON.parse(String(raw));
  } catch {
    throw createError({ statusCode: 400, message: "Malformed body" });
  }

  // reference_number is the posSales doc id — set when the charge was created.
  const saleId = body?.reference_number || body?.payment_request?.reference_number;
  const status = String(body?.status ?? body?.payment_request?.status ?? "");
  const eventType = getHeader(event, "hitpay-event-type") || "";

  if (!saleId) {
    noteError({
      area: "payment",
      severity: "error",
      code: "pos.orphan_callback",
      message: "HitPay reported a counter payment with no sale reference.",
      context: { status, eventType },
      hint: "Money may have been collected against a sale TCGo can't identify. Reconcile in the HitPay dashboard.",
    });
    return { ok: true, ignored: "no reference" };
  }

  const db = getAdminFirestore();
  const paid = status === "completed" || status === "succeeded" || eventType === "completed";

  // Anything that isn't a completion is left alone rather than treated as a
  // failure: HitPay emits intermediate events, and releasing stock on one of
  // those would pull the card back mid-payment.
  if (!paid) {
    if (status === "failed" || status === "expired") {
      await finalisePosSale(db, saleId, "failed", `Payment ${status}`).catch(() => {});
      return { ok: true, outcome: "failed" };
    }
    return { ok: true, ignored: `status ${status || eventType || "unknown"}` };
  }

  try {
    const result = await finalisePosSale(db, saleId, "paid");
    return { ok: true, settled: result.changed, status: result.status };
  } catch (e: any) {
    // 500 here asks HitPay to retry, which is what we want: the customer has
    // paid and the stock must not stay reserved.
    noteError({
      area: "payment",
      severity: "critical",
      code: "pos.settle_failed",
      message: `Counter payment received but the sale wouldn't settle: ${e?.message || e}`,
      error: e,
      context: { saleId },
      hint: "The customer has paid. Stock is still held. Settle the sale by hand if the retry doesn't clear it.",
    });
    throw createError({ statusCode: 500, message: "Settlement failed" });
  }
});

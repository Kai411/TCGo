// Billplz payment callback. Verifies the X-Signature, then promotes the
// matching compiled order to `paid`:
//   - status: paid + paidAt
//   - platformFee / sellerPayout / payoutStatus fields (payout rail)
//   - every card in the order marked sold (+ linked inventory items synced)
//
// Uses the Admin SDK (bypasses Firestore rules) — the same pattern as the
// Stripe webhook.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { verifyBillplzSignature } from "~/server/utils/billplz";
import {
  computeSellerPayout,
  platformFeeFor,
  recordedFee,
  shippingReimbursement,
} from "~/shared/payouts";
import { effectiveRate } from "~/shared/pricing";
import { bookShipmentForOrder } from "~/server/utils/book-shipment";
import { sendInvoiceForOrder } from "~/server/utils/send-invoice";
import { noteError } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, string>;
  // Callbacks arrive with plain keys (`id`, `paid`); the browser redirect uses
  // `billplz[id]`. Accept either so this handler works for both.
  const get = (k: string) => body[k] ?? body[`billplz[${k}]`] ?? "";

  const config = useRuntimeConfig();
  const xSignatureKey = config.billplzXSignatureKey as string;
  if (xSignatureKey) {
    if (!verifyBillplzSignature(body, xSignatureKey)) {
      console.error("[billplz webhook] bad signature");
      throw createError({ statusCode: 403, message: "Invalid signature" });
    }
  } else {
    console.warn("[billplz webhook] NUXT_BILLPLZ_X_SIGNATURE_KEY not set — skipping verification");
  }

  const billId = get("id");
  const paid = get("paid") === "true";
  if (!billId) throw createError({ statusCode: 400, message: "Missing bill id" });
  if (!paid) return { ok: true, ignored: "not paid" };

  const db = getAdminFirestore();
  const orders = await db
    .collection("compiledOrders")
    .where("billplzBillId", "==", billId)
    .limit(1)
    .get();
  if (orders.empty) {
    console.error("[billplz webhook] no order for bill", billId);
    noteError({
      area: "payment",
      severity: "error",
      code: "billplz.orphan_callback",
      message: `Billplz reported a payment for bill ${billId} with no matching order.`,
      context: { billId },
      hint: "Money may have been collected against a deleted or re-created order. Reconcile against the Billplz dashboard.",
    });
    return { ok: true, ignored: "order not found" };
  }
  const orderRef = orders.docs[0].ref;
  const order = orders.docs[0].data() as any;

  // Idempotent — callbacks can retry. `pending` and `confirmed` are both
  // pre-payment states (the seller may have confirmed a manual order before
  // the buyer paid online); anything further along is already settled.
  if (order.status !== "pending" && order.status !== "confirmed") {
    return { ok: true, ignored: `status ${order.status}` };
  }

  // Billplz reports what it actually collected. If that doesn't match the
  // amount we priced the bill at, do NOT settle the order — flag it instead
  // and let an admin look. Underpayment must never mark cards sold.
  const expectedSen = Number(order.billplzAmountSen ?? 0);
  const paidSen = Number(get("amount") || 0);
  if (expectedSen > 0 && paidSen !== expectedSen) {
    console.error(
      "[billplz webhook] amount mismatch",
      { billId, expectedSen, paidSen },
    );
    noteError({
      area: "payment",
      severity: "critical",
      code: "billplz.amount_mismatch",
      message: `Billplz collected ${paidSen} sen for an order priced at ${expectedSen} sen.`,
      orderId: orderRef.id,
      context: { billId, expectedSen, paidSen },
      hint: "The order was NOT settled and no cards were marked sold. Refund or collect the difference, then settle by hand.",
    });
    await orderRef.update({
      paymentAmountMismatch: { expectedSen, paidSen, at: Date.now() },
    });
    return { ok: true, ignored: "amount mismatch" };
  }

  const now = Date.now();
  // Provisional payout: shippingReimbursement depends on whether we end up
  // booking the label, and booking happens further down this handler. The
  // figure is corrected immediately after — see the refresh below. Do not
  // rely on this value; it is written early only so the order is never
  // without one.
  const platformFee = platformFeeFor(order);
  const sellerPayout = computeSellerPayout(order);

  const batch = db.batch();
  batch.update(orderRef, {
    status: "paid",
    paidAt: now,
    platformFee,
    // Stored, not derived later: the sen-rounded fee can't be divided back
    // into the rate it came from on small orders.
    platformFeeRate: effectiveRate((order as any).sellerPlan),
    sellerPayout,
    payoutStatus: "pending",
    billplzPaidAt: get("paid_at") || null,
  });

  if (order.auctionId) {
    // Auction order: the "item" is the auction itself, not a card listing.
    batch.update(db.collection("auctions").doc(order.auctionId), {
      status: "sold",
      soldAt: now,
    });
  } else {
    // Marketplace order — lock the sold cards. `update` on a missing doc fails
    // the whole batch, so only touch listings that actually exist.
    const cardIds = (order.items ?? [])
      .map((i: any) => i?.cardId)
      .filter((id: unknown): id is string => typeof id === "string" && !!id);
    const cardSnaps = await Promise.all(
      cardIds.map((id: string) => db.collection("cards").doc(id).get()),
    );
    for (const cardSnap of cardSnaps) {
      if (!cardSnap.exists) continue;
      batch.update(cardSnap.ref, { sold: true, soldAt: now, status: "sold" });
    }
  }
  await batch.commit();

  // Sync linked inventory items (listingId → sold, online channel).
  for (const item of order.items ?? []) {
    if (!item?.cardId) continue;
    const inv = await db
      .collection("inventory")
      .where("listingId", "==", item.cardId)
      .get();
    await Promise.all(
      inv.docs.map((d) =>
        d.ref.update({
          status: "sold",
          soldAt: now,
          saleChannel: "online",
          updatedAt: now,
        }),
      ),
    );
  }

  // Book the courier now that the money is in, so the seller has a waybill
  // waiting rather than a button to press.
  //
  // Deliberately after everything else and deliberately non-fatal: this spends
  // from the Delyva wallet and calls a third party, and neither may break
  // payment settlement. Billplz retries non-2xx callbacks, so throwing here
  // would re-run the whole settlement. A failure leaves the order `paid` with
  // `shipmentError` set, and the seller can retry from the order page.
  let shipment: { booked: boolean; reason?: string } = {
    booked: false,
    reason: "not attempted",
  };
  try {
    shipment = await bookShipmentForOrder(db, orderRef.id);
    if (!shipment.booked) {
      console.warn("[billplz webhook] shipment not booked:", shipment.reason);
    }
  } catch (e: any) {
    console.error("[billplz webhook] shipment booking failed:", e?.message || e);
    noteError({
      area: "shipping",
      severity: "error",
      code: "shipping.autobook_failed",
      message: `Couldn't book the courier automatically after payment: ${e?.message || e}`,
      orderId: orderRef.id,
      error: e,
      hint: "The buyer has paid but there's no waybill. The seller can retry from the order page, or book it by hand.",
    });
    shipment = { booked: false, reason: e?.message || "Booking failed" };
  }

  // Settle the payout now the booking outcome is known.
  //
  // The figure above was computed before the label existed, so it included a
  // shipping reimbursement the seller is not owed once the platform buys the
  // label — paying it would mean covering the same postage twice, to the
  // courier and again to the seller. This was previously masked by the payout
  // route recomputing at request time; that recompute has been removed
  // (it re-priced commission at whatever rate was current), so the stored
  // figure has to be right.
  //
  // Commission is carried through untouched: it was struck on the subtotal
  // when payment landed, and who buys the label has nothing to do with it.
  try {
    const settledSnap = await orderRef.get();
    const settled = settledSnap.data() as any;
    const fee = recordedFee(settled);
    const finalPayout =
      Math.round(
        ((settled.subtotal || 0) - fee + shippingReimbursement(settled)) * 100,
      ) / 100;
    if (finalPayout !== settled.sellerPayout) {
      await orderRef.update({ sellerPayout: finalPayout });
    }
  } catch (e: any) {
    console.error("[billplz webhook] payout refresh failed:", e?.message || e);
    noteError({
      area: "payment",
      severity: "error",
      code: "payout.refresh_failed",
      message: `Couldn't settle the payout figure after booking: ${e?.message || e}`,
      orderId: orderRef.id,
      error: e,
      hint: "The order may still carry the pre-booking payout, which includes postage the platform already paid the courier. Check sellerPayout before releasing funds.",
    });
  }

  // Email the invoice. Non-fatal for the same reason as booking: Billplz
  // retries non-2xx callbacks, and a mail provider hiccup must not re-run
  // settlement. The buyer can resend it from the order page.
  let invoiceEmailed = false;
  try {
    const mail = await sendInvoiceForOrder(db, orderRef.id);
    invoiceEmailed = mail.sent;
    if (!mail.sent) console.warn("[billplz webhook] invoice not emailed:", mail.reason);
  } catch (e: any) {
    console.error("[billplz webhook] invoice email failed:", e?.message || e);
    noteError({
      area: "email",
      severity: "warning",
      code: "email.invoice_failed",
      message: `Invoice email failed to send: ${e?.message || e}`,
      orderId: orderRef.id,
      error: e,
      hint: "The payment itself went through. Resend the invoice from the order once mail is working.",
    });
  }

  return { ok: true, shipmentBooked: shipment.booked, invoiceEmailed };
});

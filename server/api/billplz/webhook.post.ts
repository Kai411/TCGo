// Billplz payment callback. Verifies the X-Signature, confirms the bill with
// Billplz, then promotes the
// matching compiled order to `paid`:
//   - status: paid + paidAt
//   - platformFee / sellerPayout / payoutStatus fields (payout rail)
//   - every card in the order marked sold (+ linked inventory items synced)
//
// Uses the Admin SDK (bypasses Firestore rules) — the same pattern as the
// Stripe webhook.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { billplzGetBill, isBillplzSandbox } from "~/server/utils/billplz";
import {
  amountMatches,
  checkBillForOrder,
  verifyBillplzCallback,
} from "~/server/utils/billplz-callback";
import {
  computeSellerPayout,
  platformFeeFor,
  recordedFee,
  shippingReimbursement,
  sstForOrder,
} from "~/shared/payouts";
import { effectiveRate, sstOn } from "~/shared/pricing";
import { joinPaidOrderToParcel } from "~/server/utils/join-parcel";
import { noteError } from "~/server/utils/oplog";
import { notify } from "~/server/utils/notify";
import { sendBuyerOrderEmail, sendSellerOrderEmail } from "~/server/utils/order-emails";
import { orderCreated, orderPlaced } from "~/shared/notifications";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const config = useRuntimeConfig();
  const xSignatureKey = config.billplzXSignatureKey as string;
  // Fail closed: without the key anyone could post "paid" for any bill.
  if (!xSignatureKey) {
    console.error("[billplz webhook] NUXT_BILLPLZ_X_SIGNATURE_KEY not set — refusing callback");
    throw createError({ statusCode: 500, message: "Payment callback not configured" });
  }
  // Only Billplz's server-to-server callback (plain keys) is accepted, and
  // every field below is read from the verified set. The browser redirect's
  // billplz[...] params never come here (pages/payment/success reads them),
  // and accepting both shapes is what let a signed redirect smuggle in
  // unsigned plain `paid=true` (security review C1).
  const verified = verifyBillplzCallback(body, xSignatureKey);
  if (!verified.ok) {
    console.error("[billplz webhook] rejected:", verified.reason);
    throw createError({ statusCode: 403, message: "Invalid signature" });
  }
  const get = (k: string) => verified.params[k] ?? "";

  const billId = get("id");
  const paid = get("paid") === "true";
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

  // Ask Billplz. The callback is only a nudge: what settles the order is the
  // bill Billplz itself says is paid, for the amount it says it collected.
  // Skipped on the sandbox only, where no real money moves and
  // scripts/test-auction-flow.mjs simulates callbacks for unpaid bills.
  let paidSen: number;
  if (isBillplzSandbox()) {
    paidSen = Number(get("paid_amount") || get("amount") || 0);
  } else {
    let bill;
    try {
      bill = await billplzGetBill(billId);
    } catch (e: any) {
      console.error("[billplz webhook] bill lookup failed:", e?.message || e);
      // Non-2xx so Billplz retries the callback once the API answers again.
      throw createError({ statusCode: 502, message: "Couldn't confirm the bill with Billplz" });
    }
    const check = checkBillForOrder(bill, {
      billId,
      orderId: orderRef.id,
      collectionId: (config.billplzCollectionId as string) || undefined,
    });
    if (!check.ok) {
      console.error("[billplz webhook] bill check failed:", check.reason, { billId });
      noteError({
        area: "payment",
        severity: "critical",
        code: `billplz.callback_${check.code}`,
        message: `A signed Billplz callback said bill ${billId} was paid, but Billplz says otherwise: ${check.reason}.`,
        orderId: orderRef.id,
        context: { billId, billState: bill?.state ?? null },
        hint: "The order was NOT settled. If this repeats, the X-Signature key may have leaked: rotate it in Billplz and Netlify.",
      });
      return { ok: true, ignored: check.code };
    }
    paidSen = check.paidSen;
  }

  // Idempotent — callbacks can retry. `pending` and `confirmed` are both
  // pre-payment states (the seller may have confirmed a manual order before
  // the buyer paid online); anything further along is already settled.
  if (order.status !== "pending" && order.status !== "confirmed") {
    // Money against a cancelled order is the one case that must not be
    // dropped on the floor: the buyer paid and has nothing to show for it.
    // Settlement voids the bill before cancelling an auction order, so this
    // should be rare — but "should be" is not a refund. Stamp the order and
    // raise it so staff can refund by hand.
    if (order.status === "cancelled" && !order.stalePayment) {
      await orderRef.update({
        stalePayment: { billId, paidSen, paidAt: get("paid_at") || null, at: Date.now() },
      });
      noteError({
        area: "payment",
        severity: "critical",
        code: "billplz.paid_after_cancel",
        message: `Billplz collected ${paidSen} sen for order ${orderRef.id} after it was cancelled (${order.cancelReason || "no reason recorded"}).`,
        orderId: orderRef.id,
        userUid: order.buyerUid,
        context: { billId, paidSen, auctionId: order.auctionId ?? null },
        hint: "The buyer has paid for nothing. Refund the bill from the Billplz dashboard and tell them.",
      });
    }
    return { ok: true, ignored: `status ${order.status}` };
  }

  // Billplz reports what it actually collected. If that doesn't match the
  // amount we priced the bill at, do NOT settle the order — flag it instead
  // and let an admin look. Underpayment must never mark cards sold.
  // An order with no recorded bill amount is a mismatch too, not a pass.
  const expectedSen = Number(order.billplzAmountSen ?? 0);
  if (!amountMatches(expectedSen, paidSen)) {
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
  const feeRate = effectiveRate((order as any).sellerPlan);

  const batch = db.batch();
  batch.update(orderRef, {
    status: "paid",
    paidAt: now,
    platformFee,
    // Stored, not derived later: the sen-rounded fee can't be divided back
    // into the rate it came from on small orders.
    platformFeeRate: feeRate,
    // Zero until TCGo is SST-registered, but recorded either way so an order
    // settled before registration is never retro-taxed by the flag flipping.
    sstAmount: sstForOrder(order),
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
    // The price the buyer actually paid, so an online sale carries a realised
    // price the way a counter sale does and the row's profit can be worked
    // out later. Left off when the order item has none, which falls back to
    // the asking price downstream. The fee goes with it, at the rate frozen
    // on the order above (plus SST on the fee once TCGo is registered), so
    // the row's profit never re-derives history from today's constants.
    const paid = Number(item.price);
    const hasPaid = Number.isFinite(paid) && paid >= 0;
    const fee = hasPaid
      ? Math.round((paid * feeRate + sstOn(paid * feeRate)) * 100) / 100
      : 0;
    const soldPrice = hasPaid ? { soldPrice: paid, soldFee: fee } : {};
    await Promise.all(
      inv.docs.map((d) =>
        d.ref.update({
          status: "sold",
          soldAt: now,
          saleChannel: "online",
          ...soldPrice,
          updatedAt: now,
        }),
      ),
    );
  }

  // The courier is NOT booked here any more.
  //
  // Auto-booking at payment closed the door on combining orders the instant
  // money landed: a buyer who ordered twice from the same seller an hour
  // apart got two labels, two parcels, and paid postage twice. The seller now
  // books when they are actually ready to pack, which leaves a window where a
  // second order can join the first and ship on one label — see
  // shared/order-joining.ts.
  //
  // Nothing is lost by waiting: the label was never used at this point
  // anyway, since the parcel sits on the seller's desk until they pack it.

  // Fold this into the parcel it was quoted against, if it was quoted against
  // one. The buyer paid a join fee instead of postage on the strength of
  // that, so this is the half of the bargain we owe them.
  //
  // Non-fatal on purpose: Billplz retries a non-2xx callback, and re-running
  // settlement to fix a combining problem would be a far worse outcome than
  // two parcels. A failure is recorded on the order and logged.
  try {
    const join = await joinPaidOrderToParcel(db, orderRef.id);
    if (join.joined) {
      console.info(`[billplz webhook] order ${orderRef.id} joined ${join.into}`);
    }
  } catch (e: any) {
    console.error("[billplz webhook] parcel join failed:", e?.message || e);
    noteError({
      area: "shipping",
      severity: "error",
      code: "parcel.join_failed",
      message: `Couldn't combine this order into the parcel it was quoted against: ${e?.message || e}`,
      orderId: orderRef.id,
      error: e,
      hint: "The buyer paid a join fee, not postage. It will ship on its own label at mostly platform cost unless combined by hand.",
    });
  }

  // No booking has happened yet, so the payout recorded above already has
  // the shipping reimbursement in it and is correct as written. It is
  // refreshed again by book-shipment when the seller buys the label, which is
  // the point the postage stops being theirs.

  // The buyer's order confirmation. Not the invoice: that is issued only once
  // the order is completed, since until delivery it can still be cancelled
  // and refunded. Non-fatal — Billplz retries non-2xx callbacks.
  let buyerEmailed = false;
  try {
    const mail = await sendBuyerOrderEmail(db, { ...order, id: orderRef.id });
    buyerEmailed = mail.sent;
    if (!mail.sent) console.warn("[billplz webhook] buyer confirmation not emailed:", mail.reason);
  } catch (e: any) {
    console.error("[billplz webhook] buyer confirmation email failed:", e?.message || e);
    noteError({
      area: "email",
      severity: "warning",
      code: "email.buyer_order_failed",
      message: `Order confirmation email to the buyer failed: ${e?.message || e}`,
      orderId: orderRef.id,
      error: e,
      hint: "The payment went through and the buyer still has the notification.",
    });
  }

  // Tell both sides. notify() swallows its own failures, so a lost bell can
  // never make Billplz retry a settled payment.
  const itemCount = (order.items ?? []).length || 1;
  await Promise.all([
    notify(
      db,
      order.sellerUid,
      orderCreated({
        orderId: orderRef.id,
        buyerName: order.buyerName,
        total: order.subtotal,
        itemCount,
      }),
    ),
    notify(
      db,
      order.buyerUid,
      orderPlaced({
        orderId: orderRef.id,
        sellerName: order.sellerName,
        total: order.total,
        itemCount,
      }),
    ),
  ]);

  // The seller's email. The buyer's is the invoice above.
  let sellerEmailed = false;
  try {
    const mail = await sendSellerOrderEmail(
      db,
      { ...order, id: orderRef.id },
      { payout: sellerPayout },
    );
    sellerEmailed = mail.sent;
    if (!mail.sent) console.warn("[billplz webhook] seller order email not sent:", mail.reason);
  } catch (e: any) {
    console.error("[billplz webhook] seller order email failed:", e?.message || e);
    noteError({
      area: "email",
      severity: "warning",
      code: "email.seller_order_failed",
      message: `New-order email to the seller failed: ${e?.message || e}`,
      orderId: orderRef.id,
      error: e,
      hint: "The payment went through and the seller still has the notification.",
    });
  }

  return { ok: true, buyerEmailed, sellerEmailed };
});

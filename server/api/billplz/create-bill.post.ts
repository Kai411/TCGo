// Create a Billplz bill for a pending compiled order. The client only supplies
// the id: the amount is worked out on the server from the listings and a
// server shipping quote (server/utils/order-pricing.ts), and the cards are
// held in the ledger for this order before the bill exists (ledger stage 2,
// server/ledger/checkout.ts), so two buyers can't both be sent to pay for one
// card.
//
// Flow: buyer taps "Pay online (FPX)" → this creates the bill, links it to
// the order, and returns the hosted payment URL. The webhook flips the order
// to paid; the redirect lands the buyer on /payment/success, which watches
// the order live and hands a declined payment (billplz[paid]=false) on to
// /payment/failed. Billplz appends its billplz[...] params to redirect_url.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import {
  billplzBaseUrl,
  billplzAuthHeader,
  billplzDeleteBill,
} from "~/server/utils/billplz";
import { requireUser } from "~/server/utils/auth";
import { isAvailable, unavailableReason } from "~/shared/card-availability";
import { isHiddenByStaff, isSellingSuspended } from "~/shared/moderation";
import { priceOrderForPayment } from "~/server/utils/order-pricing";
import { noteError } from "~/server/utils/oplog";
import { attachBillToHold, holdForPayment, HoldError, releaseHoldFor } from "~/server/utils/ledger";

// An order is payable while the seller hasn't shipped it. `pending` and
// `confirmed` both mean "money not collected yet" — the seller confirming a
// manual order must not strand a buyer who chose to pay online.
const PAYABLE_STATUSES = ["pending", "confirmed"];

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { orderId } = (await readBody(event)) as { orderId?: string };
  if (!orderId) throw createError({ statusCode: 400, message: "orderId required" });

  const config = useRuntimeConfig();
  const collectionId = config.billplzCollectionId as string;
  if (!collectionId) {
    throw createError({ statusCode: 500, message: "Billplz collection not configured" });
  }

  const db = getAdminFirestore();
  const orderRef = db.collection("compiledOrders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Order not found" });
  const order = snap.data() as any;
  // Only the buyer pays, and only for their own order.
  if (order.buyerUid !== caller.uid) {
    throw createError({ statusCode: 403, message: "Not your order" });
  }
  if (!PAYABLE_STATUSES.includes(order.status)) {
    throw createError({ statusCode: 400, message: "Order is not awaiting payment" });
  }
  if (!order.deliveryAddress?.postcode) {
    throw createError({ statusCode: 400, message: "Delivery address required before payment" });
  }

  // A seller TCGo has suspended can't be paid, and neither can a listing TCGo
  // took down: the order may have been made before staff acted, and taking
  // the money would put it in the hands of the seller under review.
  // 403 rather than 409: waiting won't make it payable.
  if (order.sellerUid) {
    const sellerSnap = await db.collection("users").doc(order.sellerUid).get();
    if (isSellingSuspended(sellerSnap.data() as any)) {
      throw createError({
        statusCode: 403,
        message: "This seller can't take payments right now, so the order can't be paid. You haven't been charged.",
      });
    }
  }
  if (order.auctionId) {
    const auctionSnap = await db.collection("auctions").doc(order.auctionId).get();
    if (isHiddenByStaff(auctionSnap.data() as any)) {
      throw createError({
        statusCode: 403,
        message: "TCGo took this auction down, so it can't be paid. You haven't been charged.",
      });
    }
  }

  // Every card must still be for sale AT THE MOMENT OF PAYMENT. Orders are
  // written client-side and can sit in `pending` indefinitely, so the listing
  // may have sold — or been reserved by the seller's own POS for a customer
  // standing at their counter — since the buyer added it to the cart. Hiding
  // sold cards from the grid is cosmetic; this is the check that actually
  // stops the same card being sold twice.
  //
  // Auction orders are exempt: their item is the auction doc, not a listing.
  if (!order.auctionId) {
    const cardIds: string[] = (order.items ?? [])
      .map((i: any) => i?.cardId)
      .filter((id: unknown): id is string => typeof id === "string" && !!id);
    const snaps = await Promise.all(
      cardIds.map((id) => db.collection("cards").doc(id).get()),
    );
    const blocked = snaps
      .filter((cardSnap) => cardSnap.exists && !isAvailable(cardSnap.data() as any))
      .map((cardSnap) => {
        const data = cardSnap.data() as any;
        return {
          cardId: cardSnap.id,
          cardName: data?.cardName ?? "This card",
          reason: unavailableReason(data),
        };
      });
    if (blocked.length) {
      // 409, not 400: the request was valid when the buyer made it, and
      // retrying after the hold lapses may well succeed.
      throw createError({
        statusCode: 409,
        message:
          blocked.length === 1
            ? blocked[0]!.reason === "reserved"
              ? `${blocked[0]!.cardName} is being paid for in store right now. Try again in a few minutes.`
              : blocked[0]!.reason === "removed"
                ? `${blocked[0]!.cardName} was taken down by TCGo, so it can't be bought.`
                : `${blocked[0]!.cardName} has just been sold.`
            : `${blocked.length} cards in this order are no longer available.`,
        data: { unavailable: blocked },
      });
    }
  }

  const requestUrl = getRequestURL(event);
  const siteUrl = (config.public.siteUrl as string) || requestUrl.origin;

  // Same pricing the buyer was shown on the order page before tapping Pay.
  const { total } = await priceOrderForPayment(db, orderRef, order);
  const amount = Math.round(total * 100); // MYR sen

  // Hold the cards for this order. Null when the ledger isn't configured.
  let hold: Awaited<ReturnType<typeof holdForPayment>> = null;
  try {
    hold = await holdForPayment(orderId, order);
  } catch (e) {
    if (e instanceof HoldError) {
      throw createError({
        statusCode: 409,
        message:
          e.code === "listing_unavailable"
            ? e.listings.length > 1
              ? "Someone else is paying for a card in this order right now. Try again in a few minutes."
              : "Someone else is paying for this card right now. Try again in a few minutes."
            : "This order has already been paid.",
        data: { unavailable: e.listings },
      });
    }
    throw e;
  }
  // Holds that lapsed and were taken over: their buyers mustn't be able to pay.
  for (const billId of hold?.displacedBillIds ?? []) {
    await billplzDeleteBill(billId).catch((e: any) =>
      noteError({
        area: "payment",
        severity: "warning",
        code: "ledger.displaced_bill_not_deleted",
        message: `Couldn't delete bill ${billId} after its hold lapsed and order ${orderId} took the card.`,
        orderId,
        context: { billId, error: String(e?.message ?? e).slice(0, 200) },
        hint: "If that bill gets paid, the ledger logs a double sell and one buyer needs a refund.",
      }),
    );
  }

  // A re-created bill supersedes the previous one. Void the old bill so a
  // stale payment tab can't collect an out-of-date amount for this order —
  // Billplz refuses to delete a paid bill, and anything else that slips
  // through is caught by the webhook's amount check.
  if (order.billplzBillId) {
    await billplzDeleteBill(order.billplzBillId).catch(() => {});
  }

  const form = new URLSearchParams({
    collection_id: collectionId,
    email: order.buyerEmail || "buyer@tcgo.shop",
    name: order.buyerName || "TCGo Buyer",
    amount: String(amount),
    callback_url: `${siteUrl}/api/billplz/webhook`,
    redirect_url: `${siteUrl}/payment/success?orderId=${encodeURIComponent(orderId)}`,
    description: `TCGo order #${orderId.slice(0, 8)} (${order.items?.length ?? 0} items)`,
    reference_1_label: "orderId",
    reference_1: orderId,
  });

  const res = await fetch(`${billplzBaseUrl()}/v3/bills`, {
    method: "POST",
    headers: {
      Authorization: billplzAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    if (hold) await releaseHoldFor(hold);
    const text = await res.text();
    console.error("[billplz] bill creation failed:", res.status, text);
    noteError({
      area: "payment",
      severity: "critical",
      code: "billplz.bill_create_failed",
      message: `Billplz refused to create a bill (HTTP ${res.status}).`,
      orderId,
      userUid: caller.uid,
      context: { httpStatus: res.status, response: text.slice(0, 400), amountSen: amount },
      hint: "The buyer saw a payment error and could not check out. Check the Billplz collection id and API key.",
    });
    throw createError({ statusCode: 502, message: "Payment provider error" });
  }
  const bill = (await res.json()) as { id: string; url: string };
  if (hold) await attachBillToHold(hold, bill.id, amount);

  await orderRef.update({
    billplzBillId: bill.id,
    // Recorded in sen so the webhook can verify Billplz reports the same
    // amount it collected — without this, a bill created against a since-
    // changed order would settle at the wrong price.
    billplzAmountSen: amount,
    paymentMethod: "billplz",
  });

  return { url: bill.url };
});

// Settle an auction whose clock has run out.
//
// There's no scheduler in this stack, so settlement is lazy: the auction page
// and the seller's auction dashboard call this whenever they render an ended
// auction. It's idempotent and derives everything from stored state, so
// calling it repeatedly (or concurrently) converges on one outcome.
//
// Three outcomes:
//   winner found          → compiled order created, auction → pending_payment
//   payment window lapsed → order cancelled, auction → expired
//   no bids               → auction → expired
//
// The winning price and bidder live in RTDB (auction_summaries), written by
// the bidding client; the product data lives in Firestore.

import { getAdminFirestore, getAdminRtdb } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { isAdminUid } from "~/shared/admins";
import {
  AUCTION_PAYMENT_WINDOW_MS,
  AUCTION_SETTLED_STATUSES,
  auctionHasEnded,
  type AuctionStatus,
} from "~/shared/auctions";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { auctionId } = (await readBody(event)) as { auctionId?: string };
  if (!auctionId) throw createError({ statusCode: 400, message: "auctionId required" });

  const db = getAdminFirestore();
  const auctionRef = db.collection("auctions").doc(auctionId);
  const snap = await auctionRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Auction not found" });
  const auction = snap.data() as any;

  // Live price/end time come from RTDB — anti-snipe extends endsAt there, so
  // the Firestore copy can be stale and must not be trusted for "has it ended".
  const summarySnap = await getAdminRtdb()
    .ref(`auction_summaries/${auctionId}`)
    .get();
  const summary = (summarySnap.val() || {}) as {
    currentPrice?: number;
    endsAt?: number;
    topBidderUid?: string;
    topBidder?: string;
  };
  const endsAt = summary.endsAt ?? auction.endsAt;
  const status: AuctionStatus = auction.status ?? "active";

  // Anyone involved can trigger settlement; strangers can't poke other
  // people's auctions.
  const involved =
    caller.uid === auction.sellerUid ||
    caller.uid === summary.topBidderUid ||
    isAdminUid(caller.uid);
  if (!involved) throw createError({ statusCode: 403, message: "Not your auction" });

  if (AUCTION_SETTLED_STATUSES.includes(status)) {
    return { status, orderId: auction.orderId ?? null, unchanged: true };
  }
  if (!auctionHasEnded(endsAt)) {
    return { status, orderId: null, unchanged: true, note: "still running" };
  }

  // ── Already awaiting payment: enforce the window ────────────────────────
  if (status === "pending_payment") {
    const dueAt = auction.paymentDueAt ?? 0;
    if (Date.now() < dueAt) {
      return { status, orderId: auction.orderId ?? null, unchanged: true };
    }
    const orderId = auction.orderId as string | undefined;
    if (orderId) {
      const orderRef = db.collection("compiledOrders").doc(orderId);
      const orderSnap = await orderRef.get();
      const order = orderSnap.data() as any;
      // Paid in the meantime — settle as sold rather than voiding a real sale.
      if (order && order.status !== "pending") {
        await auctionRef.update({ status: "sold", soldAt: Date.now() });
        return { status: "sold", orderId };
      }
      if (order) {
        await orderRef.update({
          status: "cancelled",
          cancelledAt: Date.now(),
          cancelReason: "Auction payment window lapsed",
        });
      }
    }
    await auctionRef.update({ status: "expired", expiredAt: Date.now() });
    return { status: "expired", orderId: orderId ?? null, note: "payment window lapsed" };
  }

  // ── First settlement ────────────────────────────────────────────────────
  const winnerUid = summary.topBidderUid;
  const price = Number(summary.currentPrice ?? 0);
  if (!winnerUid || price <= 0) {
    await auctionRef.update({ status: "expired", expiredAt: Date.now() });
    return { status: "expired", orderId: null, note: "no bids" };
  }

  const winnerSnap = await db.collection("users").doc(winnerUid).get();
  const winner = winnerSnap.data() as any;

  const now = Date.now();
  const orderRef = db.collection("compiledOrders").doc();
  const shippingWM = Number(auction.shippingWM ?? 0);
  const shippingEM = Number(auction.shippingEM ?? 0);

  const order = {
    id: orderRef.id,
    buyerUid: winnerUid,
    buyerName: summary.topBidder || winner?.customName || winner?.displayName || "Buyer",
    buyerEmail: winner?.email || "",
    sellerUid: auction.sellerUid,
    sellerName: auction.seller || "Seller",
    items: [
      {
        cardId: auctionId,
        cardName: auction.cardName || auction.title || "Auction item",
        cardSet: auction.cardSet || "",
        condition: auction.condition || "",
        imageUrl: auction.imageUrl || "",
        price,
        shippingWM,
        shippingEM,
      },
    ],
    subtotal: price,
    shippingWM,
    shippingEM,
    // Provisional — create-bill recomputes both from the delivery address the
    // winner enters, so an East Malaysia address can't be billed at WM rates.
    region: "WM" as const,
    shipping: shippingWM,
    total: Math.round((price + shippingWM) * 100) / 100,
    status: "pending" as const,
    paymentMethod: "billplz" as const,
    createdAt: now,
    // Provenance — lets the order page show "won at auction" and the auction
    // page link straight to the order.
    auctionId,
    // Mirrored from the auction so the order page can show the deadline
    // without a second read.
    paymentDueAt: now + AUCTION_PAYMENT_WINDOW_MS,
  };

  // One batch: an auction that says pending_payment must always have an order.
  const writes = db.batch();
  writes.set(orderRef, order);
  writes.update(auctionRef, {
    status: "pending_payment",
    orderId: orderRef.id,
    winnerUid,
    winnerName: order.buyerName,
    winningBid: price,
    endedAt: now,
    paymentDueAt: now + AUCTION_PAYMENT_WINDOW_MS,
  });
  await writes.commit();

  return { status: "pending_payment", orderId: orderRef.id, amount: price };
});

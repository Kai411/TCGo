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

import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminRtdb } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { billplzBillState, billplzDeleteBill } from "~/server/utils/billplz";
import { noteError } from "~/server/utils/oplog";
import { isAdminUid } from "~/shared/admins";
import {
  AUCTION_PAYMENT_WINDOW_MS,
  AUCTION_SETTLED_STATUSES,
  auctionHasEnded,
  outcomeForOrderStatus,
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

  if (status === "pending_payment") {
    return await followTheOrder(db, auctionRef, auction);
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

  // A transaction, not a batch. The seller and the winner both open an ended
  // auction — often within the same second, since both were watching the
  // clock — and a read-then-write here created two orders for one auction,
  // with the auction pointing at whichever landed last. The other was an
  // orphan the winner could still pay. Re-reading inside the transaction
  // means the second caller sees the first one's order and returns it.
  return await db.runTransaction(async (tx) => {
    const fresh = (await tx.get(auctionRef)).data() as any;
    const freshStatus: AuctionStatus = fresh?.status ?? "active";
    if (freshStatus === "pending_payment" && fresh.orderId) {
      return {
        status: freshStatus,
        orderId: fresh.orderId as string,
        amount: fresh.winningBid ?? price,
        unchanged: true,
      };
    }
    if (AUCTION_SETTLED_STATUSES.includes(freshStatus)) {
      return { status: freshStatus, orderId: fresh.orderId ?? null, unchanged: true };
    }

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

    // One transaction: an auction that says pending_payment must always have
    // an order, and only ever one.
    tx.set(orderRef, order);
    tx.update(auctionRef, {
      status: "pending_payment",
      orderId: orderRef.id,
      winnerUid,
      winnerName: order.buyerName,
      winningBid: price,
      endedAt: now,
      paymentDueAt: now + AUCTION_PAYMENT_WINDOW_MS,
    });

    return { status: "pending_payment", orderId: orderRef.id, amount: price };
  });
});

// ── Awaiting payment: let the order decide ────────────────────────────────
//
// Paid (by the webhook) → sold. Cancelled (by staff — the client can't) →
// expired, immediately; there's nothing left to wait for. Still open → hold
// until the deadline, then void it.
const followTheOrder = async (
  db: Firestore,
  auctionRef: DocumentReference,
  auction: any,
) => {
  const orderId = auction.orderId as string | undefined;
  const orderRef = orderId ? db.collection("compiledOrders").doc(orderId) : null;
  const order = orderRef ? ((await orderRef.get()).data() as any) : null;
  const outcome = outcomeForOrderStatus(order?.status);

  if (outcome === "sold") {
    await auctionRef.update({ status: "sold", soldAt: Date.now() });
    return { status: "sold", orderId };
  }

  if (outcome === "open") {
    const dueAt = auction.paymentDueAt ?? 0;
    if (Date.now() < dueAt) {
      return { status: "pending_payment", orderId: orderId ?? null, unchanged: true };
    }

    // The deadline has passed with the bill unpaid. Void the bill BEFORE the
    // order, so a bank page the winner opened at 47:59 can't collect at
    // 48:01 against an order we've just cancelled. Billplz refuses to delete
    // a paid bill — that refusal is how we learn the money is already on its
    // way and the webhook is about to settle it, in which case we stand
    // aside rather than void a real sale.
    if (order?.billplzBillId) {
      try {
        await billplzDeleteBill(order.billplzBillId);
      } catch (e: any) {
        const state = await billplzBillState(order.billplzBillId).catch(() => "unknown");
        if (state === "paid") {
          return {
            status: "pending_payment",
            orderId,
            unchanged: true,
            note: "payment in flight",
          };
        }
        if (state !== "deleted") {
          // Couldn't void it and can't tell why. Carry on — the webhook
          // records a payment against a cancelled order rather than
          // dropping it — but leave a trail.
          noteError({
            area: "payment",
            severity: "warning",
            code: "billplz.bill_void_failed",
            message: `Couldn't void bill ${order.billplzBillId} for a lapsed auction order (state: ${state}).`,
            orderId,
            error: e,
            hint: "If the buyer pays this bill anyway, the webhook flags the order as stalePayment for a manual refund.",
          });
        }
      }
    }

    if (orderRef && order) {
      await orderRef.update({
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelReason: "Auction payment window lapsed",
      });
    }
  }

  await auctionRef.update({ status: "expired", expiredAt: Date.now() });
  return {
    status: "expired",
    orderId: orderId ?? null,
    note: outcome === "expired" ? "order was cancelled" : "payment window lapsed",
  };
};

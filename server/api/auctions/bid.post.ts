// Place a bid or set an auto bid. The only way a bid lands.
//
// Bids used to be written to the Realtime Database by the bidder's browser,
// which also ran everyone's auto bids by reading their secret maximums. Now
// the browser sends only { auctionId, kind, amount }; the server checks who is
// asking, decides the bid (shared/auction-bidding.ts) inside one RTDB
// transaction on auction_private/{id}, then copies the public result to
// auction_summaries, the bid list and the bidder index. database.rules.json
// makes all of those read-only to browsers.

import { getAdminFirestore, getAdminRtdb } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { getUserProfile } from "~/server/utils/user-profile";
import { tellOutbidders } from "~/server/utils/auction-outbid";
import { noteError } from "~/server/utils/oplog";
import {
  publicSummary,
  resolveBid,
  seedLiveState,
  type AuctionLiveState,
  type BidOutcome,
} from "~/shared/auction-bidding";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = ((await readBody(event)) || {}) as { auctionId?: string; kind?: string; amount?: unknown };
  const id = String(body.auctionId || "");
  if (!id || /[.#$\[\]\/]/.test(id)) throw createError({ statusCode: 400, message: "auctionId required" });
  const kind = body.kind === "auto" ? "auto" : "bid";
  const amount = Number(body.amount);

  const db = getAdminFirestore();
  const auctionRef = db.collection("auctions").doc(id);
  const snap = await auctionRef.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Auction not found" });
  const auction = snap.data() as any;

  if ((auction.status ?? "active") !== "active") {
    throw createError({ statusCode: 409, message: "This auction has closed." });
  }
  if (auction.hidden === true) {
    throw createError({ statusCode: 409, message: "This auction isn't available." });
  }
  if (auction.sellerUid === caller.uid) {
    throw createError({ statusCode: 403, message: "You can't bid on your own auction." });
  }

  const [profile, sellerSnap] = await Promise.all([
    getUserProfile(db, caller.uid),
    db.collection("users").doc(String(auction.sellerUid || "-")).get(),
  ]);
  if (sellerSnap.data()?.sellingSuspended === true) {
    throw createError({ statusCode: 409, message: "This auction isn't available." });
  }
  // The delivery phone counts: it is the number new members give.
  if (!profile?.phone && !profile?.whatsappNumber && !profile?.deliveryPhone) {
    throw createError({ statusCode: 400, message: "Please add your contact number in your Profile before bidding." });
  }
  if ((profile?.trustScore ?? 100) < 60) {
    throw createError({
      statusCode: 403,
      message: "Your trust score is too low to bid. Contact support if you believe this is an error.",
    });
  }
  const name = String(profile?.customName || profile?.displayName || caller.name || "Anonymous").slice(0, 60);
  const minIncrement = Number(auction.minIncrement) > 0 ? Number(auction.minIncrement) : 1;

  const rtdb = getAdminRtdb();
  // Where an auction starts if the server hasn't bid on it yet: auctions
  // already running under browser bidding keep their price and auto bids.
  const [summarySnap, legacyAutoSnap] = await Promise.all([
    rtdb.ref(`auction_summaries/${id}`).get(),
    rtdb.ref(`auction_bids/${id}/autoBids`).get(),
  ]);
  const seed = seedLiveState(auction, summarySnap.val(), legacyAutoSnap.val());

  let outcome: BidOutcome = { ok: false, error: "Couldn't place the bid. Try again." };
  const result = await rtdb.ref(`auction_private/${id}`).transaction((current: AuctionLiveState | null) => {
    outcome = resolveBid(current ?? seed, { uid: caller.uid, name, kind, amount, now: Date.now() }, minIncrement);
    return outcome.ok ? outcome.state : undefined; // undefined aborts
  });
  if (!result.committed || !outcome.ok) {
    throw createError({ statusCode: 400, message: outcome.ok ? "Couldn't place the bid. Try again." : outcome.error });
  }
  const { state, log, leading } = outcome;

  if (log.length) {
    const summary = publicSummary(state);
    const indexUpdates: Record<string, { highestBid: number }> = {};
    for (const b of log) {
      const prev = indexUpdates[`${b.bidderUid}/${id}`]?.highestBid ?? 0;
      indexUpdates[`${b.bidderUid}/${id}`] = { highestBid: Math.max(prev, b.amount) };
    }
    const bidsRef = rtdb.ref(`auction_bids/${id}/bids`);
    await Promise.all([
      // Never let a slower copy of an older bid overwrite a newer one.
      rtdb.ref(`auction_summaries/${id}`).transaction((cur: { seq?: number } | null) =>
        cur && Number(cur.seq ?? 0) >= Number(summary.seq) ? undefined : summary,
      ),
      ...log.map((b) => bidsRef.push(b)),
      rtdb.ref("user_bid_index").update(indexUpdates),
      // The rules read this to lock the listing once anyone has bid.
      auctionRef.update({ bidCount: state.bidCount }),
    ]);
  }
  // The old browser-written maximums now live in auction_private.
  if (legacyAutoSnap.exists()) await rtdb.ref(`auction_bids/${id}/autoBids`).remove().catch(() => {});

  await tellOutbidders(id).catch((e) =>
    noteError({ area: "system", severity: "warning", code: "auction.outbid_notify_failed", message: `Outbid notices failed for ${id}.`, error: e }),
  );

  const myMax = state.maxBids?.[caller.uid]?.maxAmount ?? null;
  return { ok: true, leading, currentPrice: state.currentPrice, endsAt: state.endsAt, myMax };
});

// Tell bidders they've been outbid. Trusts nothing but the auction id: who is
// on top and who was beaten are read from RTDB, and who has already been told
// is kept in `auctionOutbid/{auctionId}` (server-only), so calling it again,
// or twice at once, tells nobody twice.

import { getAdminFirestore, getAdminRtdb } from "~/server/utils/firebase-admin";
import { notify } from "~/server/utils/notify";
import { auctionHasEnded } from "~/shared/auctions";
import { auctionOutbid } from "~/shared/notifications";
import { outbidTargets, type BidLike } from "~/shared/push";

export const tellOutbidders = async (id: string): Promise<number> => {
  const rtdb = getAdminRtdb();
  const [summarySnap, bidsSnap] = await Promise.all([
    rtdb.ref(`auction_summaries/${id}`).get(),
    rtdb.ref(`auction_bids/${id}/bids`).get(),
  ]);
  const summary = (summarySnap.val() || {}) as { currentPrice?: number; endsAt?: number; topBidderUid?: string };
  // After the end it's "won" or "lost", which settlement tells them.
  if (!summary.topBidderUid || auctionHasEnded(summary.endsAt)) return 0;
  const bids = Object.values((bidsSnap.val() || {}) as Record<string, BidLike>);
  const price = Number(summary.currentPrice ?? 0);

  const db = getAdminFirestore();
  const ledger = db.collection("auctionOutbid").doc(id);
  const targets = await db.runTransaction(async (tx) => {
    const told = ((await tx.get(ledger)).data()?.told ?? {}) as Record<string, number>;
    const due = outbidTargets(bids, summary.topBidderUid, price, told);
    if (due.length) {
      const next = { ...told };
      for (const t of due) next[t.uid] = t.myBest;
      tx.set(ledger, { told: next, updatedAt: Date.now() }, { merge: true });
    }
    return due;
  });
  if (!targets.length) return 0;

  const auction = (await db.collection("auctions").doc(id).get()).data() as any;
  const cardName = auction?.cardName || auction?.title || "";
  await Promise.all(
    targets.map((t) => notify(db, t.uid, auctionOutbid({ auctionId: id, cardName, currentPrice: price }))),
  );
  return targets.length;
};

// How a bid is decided. Runs on the server only (/api/auctions/bid), inside
// one Realtime Database transaction, so two bids landing together can't both
// win and nobody's browser ever sees a rival's maximum.
//
// Rules, in plain words:
//   - A bid must be at least the current price plus the auction's increment.
//   - The leader can't bid against themselves; they can raise their maximum.
//   - An auto bid stores a secret maximum. The server bids for that member, one
//     increment at a time, only as far as needed to stay on top.
//   - Two maximums: the higher one wins at one increment over the lower one
//     (never above its own maximum). Equal maximums: the earlier one wins.
//   - A bid in the last minute moves the end a minute later (anti-snipe).
//
// Money is worked in sen (whole numbers) so 0.1 + 0.2 never matters.

export const ANTI_SNIPE_WINDOW_MS = 60_000;
export const ANTI_SNIPE_EXTENSION_MS = 60_000;
// A typo guard, not a business limit.
export const MAX_BID_RM = 1_000_000;

export interface MaxBid {
  maxAmount: number;
  bidder: string;
  createdAt: number;
}

// auction_private/{auctionId}: the server's copy of the live auction.
// Browsers can't read it (database.rules.json); the public parts are copied to
// auction_summaries/{auctionId} after each bid.
export interface AuctionLiveState {
  currentPrice: number;
  endsAt: number;
  bidCount: number;
  topBidderUid?: string;
  topBidder?: string;
  antiSnipeTriggered?: boolean;
  maxBids?: Record<string, MaxBid>;
  // Bumped on every change, so an older summary copy never overwrites a newer one.
  seq?: number;
}

export interface BidRequest {
  uid: string;
  name: string;
  kind: "bid" | "auto";
  amount: number; // the bid, or the maximum for an auto bid
  now: number;
}

export interface BidLogEntry {
  bidder: string;
  bidderUid: string;
  amount: number;
  timestamp: number;
  isAutoBid: boolean;
  triggeredAntiSnipe: boolean;
}

export type BidOutcome =
  | { ok: true; state: AuctionLiveState; log: BidLogEntry[]; leading: boolean }
  | { ok: false; error: string };

const sen = (rm: number) => Math.round(rm * 100);
const rm = (s: number) => s / 100;

export const formatBidRM = (n: number) => `RM ${n.toFixed(2)}`;

export const minNextBid = (currentPrice: number, minIncrement: number) =>
  rm(sen(currentPrice) + sen(minIncrement > 0 ? minIncrement : 1));

// The state to start from for an auction the server hasn't bid on yet: the
// Firestore listing, plus any summary and auto bids the old browser bidding
// left behind, so auctions already running carry on where they were.
export const seedLiveState = (
  auction: { startingPrice?: number; endsAt?: number },
  summary: Partial<AuctionLiveState> | null | undefined,
  legacyAutoBids: Record<string, { bidderUid?: string; bidder?: string; maxAmount?: number; createdAt?: number }> | null | undefined,
): AuctionLiveState => {
  const maxBids: Record<string, MaxBid> = {};
  for (const ab of Object.values(legacyAutoBids || {})) {
    const uid = ab?.bidderUid;
    const max = Number(ab?.maxAmount);
    if (!uid || !Number.isFinite(max)) continue;
    if (!maxBids[uid] || max > maxBids[uid].maxAmount) {
      maxBids[uid] = { maxAmount: max, bidder: ab.bidder || "Bidder", createdAt: Number(ab.createdAt) || 0 };
    }
  }
  const state: AuctionLiveState = {
    currentPrice: Number(summary?.currentPrice ?? auction.startingPrice ?? 0),
    endsAt: Number(summary?.endsAt ?? auction.endsAt ?? 0),
    bidCount: Number(summary?.bidCount ?? 0),
    seq: 0,
  };
  if (summary?.topBidderUid) {
    state.topBidderUid = summary.topBidderUid;
    state.topBidder = summary.topBidder || "Bidder";
  }
  if (summary?.antiSnipeTriggered) state.antiSnipeTriggered = true;
  if (Object.keys(maxBids).length) state.maxBids = maxBids;
  return state;
};

export const resolveBid = (
  state: AuctionLiveState,
  req: BidRequest,
  minIncrement: number,
): BidOutcome => {
  const { uid, name, kind, now } = req;
  if (!(now < state.endsAt)) return { ok: false, error: "This auction has ended." };

  const amount = Number(req.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a bid amount." };
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return { ok: false, error: "Bids can't go below one sen." };
  }
  if (amount > MAX_BID_RM) return { ok: false, error: `Bids can't be more than ${formatBidRM(MAX_BID_RM)}.` };

  const inc = sen(minIncrement > 0 ? minIncrement : 1);
  const price = sen(state.currentPrice);
  const minBid = price + inc;
  const want = sen(amount);
  const leading = state.topBidderUid === uid;
  const maxBids: Record<string, MaxBid> = { ...(state.maxBids || {}) };
  const mine = maxBids[uid];

  if (kind === "bid") {
    if (leading) return { ok: false, error: "You're already the highest bidder." };
    if (want < minBid) {
      return { ok: false, error: `Bid must be at least ${formatBidRM(rm(minBid))} (current + ${formatBidRM(rm(inc))} increment).` };
    }
  } else {
    if (want < minBid) return { ok: false, error: `Max bid must be at least ${formatBidRM(rm(minBid))}.` };
    if (leading && mine && want <= sen(mine.maxAmount)) {
      return { ok: false, error: `Your auto bid is already up to ${formatBidRM(mine.maxAmount)}. Enter a higher maximum.` };
    }
    maxBids[uid] = { maxAmount: rm(want), bidder: name, createdAt: now };
  }

  const next: AuctionLiveState = { ...state, maxBids, seq: (state.seq ?? 0) + 1 };
  if (!Object.keys(maxBids).length) delete next.maxBids;

  // Leader raising their own maximum: nothing to bid against, the price stays.
  if (kind === "auto" && leading) return { ok: true, state: next, log: [], leading: true };

  // What the caller puts down now, and how far they'd go.
  const placed = kind === "bid" ? want : minBid;
  const callerMax = want;

  // The strongest rival maximum that reaches this bid. Earlier wins a tie.
  let rival: { uid: string; max: number; bid: MaxBid } | null = null;
  for (const [otherUid, mb] of Object.entries(maxBids)) {
    if (otherUid === uid) continue;
    const max = sen(Number(mb.maxAmount));
    if (!Number.isFinite(max) || max < placed) continue;
    if (!rival || max > rival.max || (max === rival.max && mb.createdAt < rival.bid.createdAt)) {
      rival = { uid: otherUid, max, bid: mb };
    }
  }

  const antiSnipe = state.endsAt - now <= ANTI_SNIPE_WINDOW_MS;
  const entry = (bidderUid: string, bidder: string, s: number, isAutoBid: boolean): BidLogEntry => ({
    bidder,
    bidderUid,
    amount: rm(s),
    timestamp: now,
    isAutoBid,
    triggeredAntiSnipe: antiSnipe,
  });

  let log: BidLogEntry[];
  let finalPrice: number;
  let top: { uid: string; name: string };

  if (!rival) {
    finalPrice = placed;
    top = { uid, name };
    log = [entry(uid, name, placed, kind === "auto")];
  } else if (rival.max >= callerMax) {
    // The rival's maximum holds (a tie goes to them: theirs was set first).
    finalPrice = Math.min(callerMax + inc, rival.max);
    top = { uid: rival.uid, name: rival.bid.bidder };
    log = [entry(uid, name, callerMax, kind === "auto"), entry(rival.uid, rival.bid.bidder, finalPrice, true)];
  } else {
    finalPrice = Math.max(placed, Math.min(rival.max + inc, callerMax));
    top = { uid, name };
    log = [entry(rival.uid, rival.bid.bidder, rival.max, true), entry(uid, name, finalPrice, kind === "auto")];
  }

  next.currentPrice = rm(finalPrice);
  next.topBidderUid = top.uid;
  next.topBidder = top.name;
  next.bidCount = (state.bidCount || 0) + log.length;
  if (antiSnipe) {
    next.endsAt = state.endsAt + ANTI_SNIPE_EXTENSION_MS;
    next.antiSnipeTriggered = true;
  }
  return { ok: true, state: next, log, leading: top.uid === uid };
};

// The part of the live state anyone may see.
export const publicSummary = (s: AuctionLiveState) => {
  const out: Record<string, unknown> = {
    currentPrice: s.currentPrice,
    endsAt: s.endsAt,
    bidCount: s.bidCount,
    seq: s.seq ?? 0,
  };
  if (s.topBidderUid) {
    out.topBidderUid = s.topBidderUid;
    out.topBidder = s.topBidder || "Bidder";
  }
  if (s.antiSnipeTriggered) out.antiSnipeTriggered = true;
  return out;
};

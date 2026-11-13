// How the server decides a bid (shared/auction-bidding.ts).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ANTI_SNIPE_EXTENSION_MS,
  publicSummary,
  resolveBid,
  seedLiveState,
  type AuctionLiveState,
  type BidOutcome,
} from "~/shared/auction-bidding";

const NOW = 1_000_000;
const HOUR = 3_600_000;

const fresh = (over: Partial<AuctionLiveState> = {}): AuctionLiveState => ({
  currentPrice: 10,
  endsAt: NOW + HOUR,
  bidCount: 0,
  seq: 0,
  ...over,
});

const ok = (o: BidOutcome) => {
  if (!o.ok) assert.fail(`expected ok, got: ${o.error}`);
  return o;
};
const err = (o: BidOutcome) => {
  if (o.ok) assert.fail("expected a refusal");
  return o.error;
};

const bid = (s: AuctionLiveState, uid: string, amount: number, now = NOW) =>
  resolveBid(s, { uid, name: uid, kind: "bid", amount, now }, 1);
const auto = (s: AuctionLiveState, uid: string, amount: number, now = NOW) =>
  resolveBid(s, { uid, name: uid, kind: "auto", amount, now }, 1);

describe("plain bids", () => {
  it("must be at least current price plus the increment", () => {
    assert.match(err(bid(fresh(), "a", 10.5)), /at least RM 11\.00/);
    const r = ok(bid(fresh(), "a", 11));
    assert.equal(r.state.currentPrice, 11);
    assert.equal(r.state.topBidderUid, "a");
    assert.equal(r.state.bidCount, 1);
    assert.equal(r.leading, true);
    assert.equal(r.log.length, 1);
  });

  it("the leader can't bid against themselves", () => {
    const s = ok(bid(fresh(), "a", 11)).state;
    assert.match(err(bid(s, "a", 12)), /already the highest bidder/);
  });

  it("refuses after the end, nonsense amounts and sub-sen amounts", () => {
    assert.match(err(bid(fresh({ endsAt: NOW }), "a", 11)), /ended/);
    assert.ok(err(bid(fresh(), "a", Number.NaN)));
    assert.ok(err(bid(fresh(), "a", -5)));
    assert.match(err(bid(fresh(), "a", 11.005)), /sen/);
    assert.ok(err(bid(fresh(), "a", 2_000_000)));
  });

  it("works in sen, so 0.1 increments don't drift", () => {
    let s = fresh({ currentPrice: 0.1 });
    s = ok(resolveBid(s, { uid: "a", name: "a", kind: "bid", amount: 0.2, now: NOW }, 0.1)).state;
    s = ok(resolveBid(s, { uid: "b", name: "b", kind: "bid", amount: 0.3, now: NOW }, 0.1)).state;
    assert.equal(s.currentPrice, 0.3);
  });
});

describe("auto bids", () => {
  it("opens at the minimum and keeps the maximum secret from the summary", () => {
    const r = ok(auto(fresh(), "a", 50));
    assert.equal(r.state.currentPrice, 11);
    assert.equal(r.state.maxBids?.a.maxAmount, 50);
    assert.equal("maxBids" in publicSummary(r.state), false);
  });

  it("answers a plain bid one increment higher", () => {
    const s = ok(auto(fresh(), "a", 50)).state;
    const r = ok(bid(s, "b", 20));
    assert.equal(r.leading, false);
    assert.equal(r.state.topBidderUid, "a");
    assert.equal(r.state.currentPrice, 21);
    assert.equal(r.state.bidCount, 3);
  });

  it("never goes past its maximum", () => {
    const s = ok(auto(fresh(), "a", 20.5)).state;
    const r = ok(bid(s, "b", 20));
    assert.equal(r.state.topBidderUid, "a");
    assert.equal(r.state.currentPrice, 20.5);
  });

  it("is beaten by a plain bid above its maximum", () => {
    const s = ok(auto(fresh(), "a", 20)).state;
    const r = ok(bid(s, "b", 25));
    assert.equal(r.leading, true);
    assert.equal(r.state.currentPrice, 25);
    assert.equal(r.state.topBidderUid, "b");
  });

  it("two maximums: the higher wins at one increment over the lower", () => {
    const s = ok(auto(fresh(), "a", 30)).state;
    const r = ok(auto(s, "b", 50));
    assert.equal(r.state.topBidderUid, "b");
    assert.equal(r.state.currentPrice, 31);
    const r2 = ok(auto(s, "c", 25));
    assert.equal(r2.state.topBidderUid, "a");
    assert.equal(r2.state.currentPrice, 26);
  });

  it("equal maximums: the earlier one wins, at that maximum", () => {
    const s = ok(auto(fresh(), "a", 30, NOW)).state;
    const r = ok(auto(s, "b", 30, NOW + 5));
    assert.equal(r.state.topBidderUid, "a");
    assert.equal(r.state.currentPrice, 30);
    assert.equal(r.leading, false);
  });

  it("a plain bid equal to a maximum loses to it", () => {
    const s = ok(auto(fresh(), "a", 30)).state;
    const r = ok(bid(s, "b", 30));
    assert.equal(r.state.topBidderUid, "a");
    assert.equal(r.state.currentPrice, 30);
  });

  it("the leader can raise their maximum without moving the price", () => {
    const s = ok(auto(fresh(), "a", 30)).state;
    const r = ok(auto(s, "a", 60));
    assert.equal(r.state.currentPrice, 11);
    assert.equal(r.log.length, 0);
    assert.equal(r.state.maxBids?.a.maxAmount, 60);
    assert.match(err(auto(r.state, "a", 40)), /already up to RM 60\.00/);
  });
});

describe("anti-snipe", () => {
  it("a bid in the last minute adds a minute", () => {
    const s = fresh({ endsAt: NOW + 30_000 });
    const r = ok(bid(s, "a", 11));
    assert.equal(r.state.endsAt, NOW + 30_000 + ANTI_SNIPE_EXTENSION_MS);
    assert.equal(r.state.antiSnipeTriggered, true);
    assert.equal(r.log[0].triggeredAntiSnipe, true);
  });

  it("an earlier bid doesn't", () => {
    const r = ok(bid(fresh(), "a", 11));
    assert.equal(r.state.endsAt, NOW + HOUR);
  });
});

describe("seeding from browser-era data", () => {
  it("keeps the running price, leader and each member's highest maximum", () => {
    const s = seedLiveState(
      { startingPrice: 5, endsAt: NOW + HOUR },
      { currentPrice: 12, endsAt: NOW + 2 * HOUR, bidCount: 4, topBidderUid: "a", topBidder: "Ann" },
      {
        k1: { bidderUid: "a", bidder: "Ann", maxAmount: 20, createdAt: 1 },
        k2: { bidderUid: "a", bidder: "Ann", maxAmount: 40, createdAt: 2 },
        k3: { bidderUid: "b", bidder: "Bo", maxAmount: 15, createdAt: 3 },
      },
    );
    assert.equal(s.currentPrice, 12);
    assert.equal(s.endsAt, NOW + 2 * HOUR);
    assert.equal(s.topBidderUid, "a");
    assert.equal(s.maxBids?.a.maxAmount, 40);
    assert.equal(s.maxBids?.b.maxAmount, 15);
  });

  it("starts a never-bid auction from the listing", () => {
    const s = seedLiveState({ startingPrice: 5, endsAt: NOW + HOUR }, null, null);
    assert.equal(s.currentPrice, 5);
    assert.equal(s.bidCount, 0);
    assert.equal(s.topBidderUid, undefined);
  });

  it("bumps seq on every change so stale summary copies are dropped", () => {
    const a = ok(bid(fresh(), "a", 11)).state;
    const b = ok(bid(a, "b", 12)).state;
    assert.ok((b.seq ?? 0) > (a.seq ?? 0));
    assert.equal(publicSummary(b).seq, b.seq);
  });
});

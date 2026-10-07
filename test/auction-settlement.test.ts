// How an auction reads its winner's order once the clock has run out.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AUCTION_PAYMENT_WINDOW_HOURS,
  AUCTION_PAYMENT_WINDOW_MS,
  AUCTION_SETTLED_STATUSES,
  auctionHasEnded,
  outcomeForOrderStatus,
} from "~/shared/auctions";

describe("auction outcome from the order", () => {
  it("only money in the bank makes a sale", () => {
    for (const s of ["paid", "shipped", "delivered"]) {
      assert.equal(outcomeForOrderStatus(s), "sold", s);
    }
  });

  it("a cancelled order voids the result rather than selling it", () => {
    assert.equal(outcomeForOrderStatus("cancelled"), "expired");
  });

  it("an unpaid order is still open, whatever the seller has done to it", () => {
    for (const s of ["pending", "confirmed", undefined, null, ""]) {
      assert.equal(outcomeForOrderStatus(s), "open", String(s));
    }
  });
});

describe("the clock", () => {
  it("ends at endsAt, not a moment before", () => {
    assert.equal(auctionHasEnded(1000, 999), false);
    assert.equal(auctionHasEnded(1000, 1000), true);
    assert.equal(auctionHasEnded(undefined, 1000), false);
  });

  it("gives the winner 48 hours", () => {
    assert.equal(AUCTION_PAYMENT_WINDOW_HOURS, 48);
    assert.equal(AUCTION_PAYMENT_WINDOW_MS, 48 * 60 * 60 * 1000);
  });

  it("never re-settles a finished auction", () => {
    assert.deepEqual(AUCTION_SETTLED_STATUSES, ["sold", "cancelled", "expired"]);
    assert.ok(!AUCTION_SETTLED_STATUSES.includes("pending_payment"));
  });
});

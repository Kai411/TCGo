// A price on a marketplace is acted on: a seller prices against it, a buyer
// judges an offer by it. The confidence beside it is a claim about how much
// that number is worth trusting, so it has to be wrong in the safe direction —
// under-claiming on a solid price costs a little credibility, over-claiming on
// a stale one costs someone money.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { priceConfidence, type ConfidenceInput } from "~/shared/price-confidence";

/** A well-evidenced price: fresh, long history, steady, listings agree. */
const solid: ConfidenceInput = {
  market: 100,
  ageDays: 1,
  snapshotCount: 40,
  min: 96,
  max: 104,
  listingPrices: [98, 102, 105],
  sourceCount: 1,
};

describe("no price at all", () => {
  it("says so rather than scoring it", () => {
    for (const market of [null, 0, -5, Number.NaN]) {
      const c = priceConfidence({ market });
      assert.equal(c.level, "none", String(market));
      assert.equal(c.score, 0);
      assert.match(c.reasons[0]!, /No market price/i);
    }
  });

  it("explains why, because the card is not broken", () => {
    // 34 of 61 Gold Stars have no price. The reason is that they barely
    // trade, and a reader who is told that stops wondering.
    assert.match(priceConfidence({ market: null }).reasons[0]!, /trades too rarely/i);
  });
});

describe("what raises confidence", () => {
  it("rates a fresh, steady, corroborated price highly", () => {
    const c = priceConfidence(solid);
    assert.equal(c.level, "high");
    assert.ok(c.score >= 70, `score ${c.score}`);
  });

  // Compared from a middling baseline: `solid` already scores 100, and a
  // clamped score cannot show an increase.
  const middling: ConfidenceInput = {
    market: 100,
    ageDays: 20,
    snapshotCount: 5,
    min: 80,
    max: 120,
    listingPrices: [],
    sourceCount: 1,
  };

  it("counts agreement from real listings", () => {
    const without = priceConfidence(middling);
    const with_ = priceConfidence({ ...middling, listingPrices: [98, 102] });
    assert.ok(with_.score > without.score, "listings agreeing should help");
  });

  it("counts a second source", () => {
    const one = priceConfidence(middling);
    const two = priceConfidence({ ...middling, sourceCount: 2 });
    assert.ok(two.score > one.score, `${two.score} should beat ${one.score}`);
    assert.ok(
      one.reasons.some((r) => /single price source/i.test(r)),
      "a lone source should be stated",
    );
  });
});

describe("what lowers it", () => {
  it("marks a stale price down and says how old", () => {
    const c = priceConfidence({ ...solid, ageDays: 45 });
    assert.ok(c.score < priceConfidence(solid).score);
    assert.ok(c.reasons.some((r) => /45 days ago/.test(r)), c.reasons.join(" | "));
  });

  it("marks down a card we have barely tracked", () => {
    const c = priceConfidence({ ...solid, snapshotCount: 1, min: null, max: null });
    assert.ok(c.reasons.some((r) => /just started tracking/i.test(r)));
  });

  it("marks down a price that has been swinging", () => {
    const c = priceConfidence({ ...solid, min: 50, max: 150 });
    assert.ok(c.score < priceConfidence(solid).score);
    assert.ok(c.reasons.some((r) => /moved a lot/i.test(r)));
  });

  it("flags listings that disagree with the figure", () => {
    // The market says 100, everyone is asking 300. Worth saying out loud.
    const c = priceConfidence({ ...solid, listingPrices: [300, 320] });
    assert.ok(c.reasons.some((r) => /differ noticeably/i.test(r)));
    assert.ok(c.score < priceConfidence(solid).score);
  });

  it("lands a stale, uncorroborated, barely-tracked price on low", () => {
    const c = priceConfidence({
      market: 100,
      ageDays: 90,
      snapshotCount: 1,
      listingPrices: [],
      sourceCount: 1,
    });
    assert.equal(c.level, "low");
  });
});

describe("the shape of the answer", () => {
  it("always gives a reason", () => {
    for (const input of [solid, { market: 5 }, { ...solid, ageDays: 200 }]) {
      const c = priceConfidence(input as ConfidenceInput);
      assert.ok(c.reasons.length > 0, "every verdict needs a reason");
      for (const r of c.reasons) assert.ok(r.trim().length > 0);
    }
  });

  it("keeps the score inside 0–100", () => {
    const best = priceConfidence({ ...solid, sourceCount: 9 });
    const worst = priceConfidence({
      market: 100,
      ageDays: 900,
      snapshotCount: 0,
      min: 1,
      max: 1000,
      listingPrices: [9999],
      sourceCount: 1,
    });
    for (const c of [best, worst]) {
      assert.ok(c.score >= 0 && c.score <= 100, `score ${c.score}`);
    }
  });

  it("ignores nonsense listing prices rather than being skewed by them", () => {
    const c = priceConfidence({ ...solid, listingPrices: [0, -1, Number.NaN, 100] });
    assert.equal(c.level, "high");
  });

  it("survives an input with nothing but a price", () => {
    assert.doesNotThrow(() => priceConfidence({ market: 42 }));
    assert.notEqual(priceConfidence({ market: 42 }).level, "none");
  });
});

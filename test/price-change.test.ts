// The tile arrow is read as "this card moved this much this week", so it must
// only appear when two real snapshots a week apart exist, and never stretch
// across a gap in the nightly history.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { priceChange, PRICE_CHANGE_DAYS } from "~/shared/price-change";

const day = (offset: number) =>
  new Date(Date.UTC(2026, 9, 18) + offset * 86_400_000).toISOString().slice(0, 10);

describe("priceChange", () => {
  it("defaults to a 7 day window", () => {
    assert.equal(PRICE_CHANGE_DAYS, 7);
  });

  it("compares the newest snapshot with the one a week before", () => {
    const change = priceChange([
      { date: day(-8), market: 50 },
      { date: day(-7), market: 100 },
      { date: day(-3), market: 90 },
      { date: day(0), market: 104.2 },
    ]);
    assert.deepEqual(change, { direction: "up", pct: 4.2, label: "4.2%", since: day(-7) });
  });

  it("uses the nearest earlier snapshot when the exact day is missing", () => {
    const change = priceChange([
      { date: day(-10), market: 200 },
      { date: day(-5), market: 1 },
      { date: day(0), market: 150 },
    ]);
    assert.equal(change?.direction, "down");
    assert.equal(change?.label, "25%");
    assert.equal(change?.since, day(-10));
  });

  it("shows nothing across a gap longer than two windows", () => {
    assert.equal(
      priceChange([
        { date: day(-20), market: 100 },
        { date: day(-3), market: 120 },
        { date: day(0), market: 130 },
      ]),
      null,
    );
  });

  it("shows nothing with too little history", () => {
    assert.equal(priceChange([]), null);
    assert.equal(priceChange([{ date: day(0), market: 10 }]), null);
    assert.equal(
      priceChange([
        { date: day(-3), market: 10 },
        { date: day(0), market: 12 },
      ]),
      null,
    );
  });

  it("shows nothing when the change rounds to zero or the base is unusable", () => {
    assert.equal(
      priceChange([
        { date: day(-7), market: 100 },
        { date: day(0), market: 100.04 },
      ]),
      null,
    );
    assert.equal(
      priceChange([
        { date: day(-7), market: 0 },
        { date: day(0), market: 5 },
      ]),
      null,
    );
  });

  it("drops the decimal from 10% up so the label stays short", () => {
    assert.equal(
      priceChange([
        { date: day(-7), market: 10 },
        { date: day(0), market: 23.04 },
      ])?.label,
      "130%",
    );
    assert.equal(
      priceChange([
        { date: day(-7), market: 100 },
        { date: day(0), market: 109.96 },
      ])?.label,
      "10%",
    );
    assert.equal(
      priceChange([
        { date: day(-7), market: 100 },
        { date: day(0), market: 109.94 },
      ])?.label,
      "9.9%",
    );
  });

  it("does not care about input order", () => {
    const change = priceChange([
      { date: day(0), market: 90 },
      { date: day(-7), market: 100 },
    ]);
    assert.equal(change?.direction, "down");
    assert.equal(change?.label, "10%");
  });
});

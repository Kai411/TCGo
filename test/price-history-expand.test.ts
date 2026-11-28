// card_prices.history stores only the days a price changed. Every chart, the
// tile arrow and the collection total read it through expandHistory, so a
// gap there would show as a missing or wrong price everywhere.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { expandHistory } from "~/shared/price-history";

describe("expandHistory", () => {
  it("carries each price forward to the next change, up to today", () => {
    const points = expandHistory(
      [
        { date: "2026-11-26", market: 12 },
        { date: "2026-11-23", market: 10 },
      ],
      "2026-11-28",
    );
    assert.deepEqual(points, [
      { date: "2026-11-23", market: 10 },
      { date: "2026-11-24", market: 10 },
      { date: "2026-11-25", market: 10 },
      { date: "2026-11-26", market: 12 },
      { date: "2026-11-27", market: 12 },
      { date: "2026-11-28", market: 12 },
    ]);
  });

  it("reads old one-a-day rows as the same series", () => {
    const points = expandHistory(
      [
        { date: "2026-11-28", market: 12 },
        { date: "2026-11-27", market: 12 },
        { date: "2026-11-26", market: 10 },
      ],
      "2026-11-28",
    );
    assert.deepEqual(points.map((p) => p.market), [10, 12, 12]);
  });

  it("shows nothing after the day a price disappeared", () => {
    const points = expandHistory(
      [
        { date: "2026-11-27", market: null },
        { date: "2026-11-25", market: 5 },
      ],
      "2026-11-28",
    );
    assert.deepEqual(points.map((p) => p.date), ["2026-11-25", "2026-11-26"]);
  });

  it("starts the year from an anchor point older than the window", () => {
    const points = expandHistory([{ date: "2024-01-01", market: 4 }], "2026-11-28");
    assert.equal(points.length, 365);
    assert.equal(points[0]!.date, "2025-11-29");
    assert.equal(points[364]!.date, "2026-11-28");
    assert.ok(points.every((p) => p.market === 4));
  });

  it("ignores junk and returns nothing for an empty history", () => {
    assert.deepEqual(expandHistory([], "2026-11-28"), []);
    assert.deepEqual(expandHistory(null, "2026-11-28"), []);
    assert.deepEqual(
      expandHistory([{ date: "bad", market: 1 }, { date: "2026-11-28", market: "x" }], "2026-11-28"),
      [],
    );
  });
});

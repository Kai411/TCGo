// The backfill and the nightly snapshot must agree on which days a card's
// history keeps, or each night would undo part of the backfill.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ARCHIVE_START,
  isKeptDate,
  isMonday,
  marketByProduct,
  planDates,
  pointsFor,
  priceRowsFrom,
  retryDelayMs,
} from "../scripts/lib/price-history.mjs";

describe("which days are kept", () => {
  const today = "2026-11-18";

  it("keeps every day inside the last 365 days", () => {
    assert.equal(isKeptDate("2026-11-17", today), true);
    assert.equal(isKeptDate("2025-11-19", today), true); // 364 days back
  });

  it("keeps only Mondays before that", () => {
    assert.equal(isMonday("2025-11-17"), true);
    assert.equal(isKeptDate("2025-11-17", today), true);
    assert.equal(isKeptDate("2025-11-18", today), false); // a Tuesday, 365 days back
    assert.equal(isKeptDate("2024-02-13", today), false);
  });

  it("plans daily for the last year and weekly before, from the archive start", () => {
    const dates = planDates({ to: "2026-11-16", today });
    assert.equal(dates[0], "2024-02-12"); // first Monday on or after 2024-02-08
    assert.ok(dates[0] >= ARCHIVE_START);
    assert.equal(dates[dates.length - 1], "2026-11-16");
    const old = dates.filter((d) => d < "2025-11-19");
    assert.ok(old.every(isMonday));
    const recent = dates.filter((d) => d >= "2025-11-19");
    assert.equal(recent.length, 363); // 2025-11-19 … 2026-11-16
    assert.equal(new Set(dates).size, dates.length);
  });

  it("never plans before the archive starts", () => {
    assert.equal(planDates({ from: "2023-01-01", to: "2024-02-12", today })[0], "2024-02-12");
  });
});

describe("one archive day to a market price per card", () => {
  it("prefers Holofoil, then Normal, then Reverse Holofoil, like the nightly snapshot", () => {
    const m = marketByProduct([
      { productId: 1, subTypeName: "Normal", marketPrice: 2 },
      { productId: 1, subTypeName: "Holofoil", marketPrice: 9 },
      { productId: 2, subTypeName: "Reverse Holofoil", marketPrice: 4 },
      { productId: 2, subTypeName: "Normal", marketPrice: 3 },
      { productId: 3, subTypeName: "Reverse Holofoil", marketPrice: 5 },
    ]);
    assert.deepEqual([...m], [[1, 9], [2, 3], [3, 5]]);
  });

  it("skips cards with no market price and sub-types the snapshot ignores", () => {
    const m = marketByProduct([
      { productId: 1, subTypeName: "Holofoil", marketPrice: null },
      { productId: 1, subTypeName: "Normal", marketPrice: 1.25 },
      { productId: 2, subTypeName: "1st Edition", marketPrice: 50 },
      { productId: 3, subTypeName: "Normal", marketPrice: null },
    ]);
    assert.deepEqual([...m], [[1, 1.25]]);
  });

  it("reads both TCGCSV payload shapes", () => {
    assert.equal(priceRowsFrom({ success: true, results: [{ a: 1 }] }).length, 1);
    assert.equal(priceRowsFrom([{ a: 1 }, { a: 2 }]).length, 2);
    assert.deepEqual(priceRowsFrom(null), []);
  });

  it("turns a card's day column into newest-first points rounded to cents", () => {
    const points = pointsFor(
      ["2024-02-12", "2024-02-19", "2024-02-26"],
      [1.005, Number.NaN, 2.344],
    );
    assert.deepEqual(points, [
      { date: "2024-02-26", market: 2.34 },
      { date: "2024-02-12", market: 1 },
    ]);
  });
});

describe("Supabase SQL", () => {
  const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

  it("the nightly snapshot thins old points to Mondays instead of cutting at 365", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION snapshot_prices_range"));
    const body = fn.slice(0, fn.indexOf("$$ LANGUAGE"));
    assert.doesNotMatch(body, /LIMIT 364/);
    assert.match(body, /- 365/);
    assert.match(body, /ISODOW FROM \(elem->>'date'\)::date\) = 1/);
  });

  it("the backfill merge only adds dates a card doesn't have", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION merge_price_history"));
    const body = fn.slice(0, fn.indexOf("$$ LANGUAGE"));
    assert.match(body, /WHERE NOT EXISTS/);
    assert.match(body, /e->>'date' = n->>'date'/);
    assert.match(sql, /REVOKE EXECUTE ON FUNCTION merge_price_history\(JSONB\) FROM PUBLIC, anon, authenticated/);
  });
});

describe("waiting out TCGCSV's rate limit", () => {
  const now = Date.parse("2026-11-18T05:00:00Z");

  it("uses the 10-minute throttle when there is no Retry-After", () => {
    assert.equal(retryDelayMs(null, now), 600_000);
    assert.equal(retryDelayMs("", now), 600_000);
    assert.equal(retryDelayMs("soon", now), 600_000);
  });

  it("honours Retry-After in seconds, at least a minute and at most 30", () => {
    assert.equal(retryDelayMs("120", now), 120_000);
    assert.equal(retryDelayMs("5", now), 60_000);
    assert.equal(retryDelayMs("99999", now), 1_800_000);
  });

  it("honours Retry-After as a date", () => {
    assert.equal(retryDelayMs("Wed, 18 Nov 2026 05:05:00 GMT", now), 300_000);
  });
});

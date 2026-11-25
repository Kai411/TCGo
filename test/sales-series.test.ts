// The Sales page chart: paid takings bucketed per day and per month, on the
// same day boundary as the period figures above it.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { dailySeries, monthlySeries, startOfDayMs } from "~/shared/sales-summary";

const now = new Date(2026, 10, 25, 15, 0).getTime();
const sale = (ts: number, total: number, status = "paid") =>
  ({ id: String(ts), status, total, subtotal: total, lines: [], createdAt: ts, paidAt: ts }) as any;

describe("dailySeries", () => {
  it("returns one bar per day, oldest first, ending today", () => {
    const pts = dailySeries([], 7, now);
    assert.equal(pts.length, 7);
    assert.equal(pts[6]!.start, startOfDayMs(0, now));
    assert.equal(pts[0]!.start, startOfDayMs(6, now));
  });

  it("puts each paid sale on its day and skips unpaid or older ones", () => {
    const pts = dailySeries(
      [
        sale(now - 1000, 10),
        sale(now - 2000, 5.5),
        sale(startOfDayMs(1, now) + 60_000, 20),
        sale(now - 3000, 99, "awaiting_payment"),
        sale(startOfDayMs(40, now), 77),
      ],
      7,
      now,
    );
    assert.deepEqual(pts[6], { start: startOfDayMs(0, now), total: 15.5, count: 2 });
    assert.equal(pts[5]!.total, 20);
    assert.equal(pts.reduce((n, p) => n + p.count, 0), 3);
  });
});

describe("monthlySeries", () => {
  it("buckets by calendar month, ending this month", () => {
    const pts = monthlySeries(
      [sale(new Date(2026, 10, 2).getTime(), 30), sale(new Date(2026, 9, 31, 23).getTime(), 12)],
      12,
      now,
    );
    assert.equal(pts.length, 12);
    assert.equal(pts[11]!.start, new Date(2026, 10, 1).getTime());
    assert.equal(pts[11]!.total, 30);
    assert.equal(pts[10]!.total, 12);
    assert.equal(pts[0]!.start, new Date(2025, 11, 1).getTime());
  });
});

// The server-side scan allowance behind /api/identify-card.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BONUS_SCANS,
  FREE_SCAN_LIMIT,
  nextMonthStart,
  refundScan,
  spendScan,
  startingUsage,
} from "~/shared/scan-quota";

// 2026-10-20 12:00 Malaysia time.
const NOW = Date.UTC(2026, 9, 20, 4);
const NOV_1_MYT = Date.UTC(2026, 9, 31, 16);

describe("nextMonthStart", () => {
  it("is midnight on the 1st in Malaysia", () => {
    assert.equal(nextMonthStart(NOW), NOV_1_MYT);
    // Half an hour either side of midnight on 1 November, Malaysia time.
    assert.equal(nextMonthStart(NOV_1_MYT - 30 * 60_000), NOV_1_MYT);
    assert.equal(nextMonthStart(NOV_1_MYT + 30 * 60_000), Date.UTC(2026, 10, 30, 16));
  });
});

describe("spendScan", () => {
  it("counts a free member's scans up to the limit, then refuses", () => {
    let stored = undefined as any;
    for (let i = 0; i < FREE_SCAN_LIMIT; i++) {
      const d = spendScan(stored, {}, NOW);
      assert.equal(d.allowed, true);
      stored = d.usage;
    }
    const over = spendScan(stored, {}, NOW);
    assert.equal(over.allowed, false);
    assert.equal(over.spent, null);
    assert.equal(over.usage.used, FREE_SCAN_LIMIT);
  });

  it("resets at the start of the month", () => {
    const stored = { used: FREE_SCAN_LIMIT, resetAt: NOV_1_MYT, bonusUsed: 0 };
    const d = spendScan(stored, {}, NOV_1_MYT + 1);
    assert.equal(d.allowed, true);
    assert.equal(d.usage.used, 1);
    assert.ok(d.usage.resetAt > NOV_1_MYT);
  });

  it("spends the claimed bonus first", () => {
    const d = spendScan(undefined, { bonusScansClaimedAt: 1 }, NOW);
    assert.equal(d.spent, "bonus");
    assert.equal(d.usage.used, 0);
    assert.equal(d.mirror.bonusScansRemaining, BONUS_SCANS - 1);
  });

  it("ignores a bonus count the member wrote themselves", () => {
    const stored = { used: FREE_SCAN_LIMIT, resetAt: NOV_1_MYT, bonusUsed: BONUS_SCANS };
    const d = spendScan(stored, { bonusScansClaimedAt: 1, bonusScansRemaining: 999 }, NOW);
    assert.equal(d.allowed, false);
  });

  it("ignores a scansUsed the member reset themselves", () => {
    const stored = { used: FREE_SCAN_LIMIT, resetAt: NOV_1_MYT, bonusUsed: 0 };
    assert.equal(spendScan(stored, { scansUsed: 0 }, NOW).allowed, false);
  });

  it("lets Pro scan without counting", () => {
    const stored = { used: FREE_SCAN_LIMIT, resetAt: NOV_1_MYT, bonusUsed: 0 };
    const d = spendScan(stored, { tier: "premium" }, NOW);
    assert.equal(d.allowed, true);
    assert.equal(d.spent, "pro");
    assert.equal(d.usage.used, FREE_SCAN_LIMIT);
  });

  it("starts a new record from the old profile counters", () => {
    const u = startingUsage(undefined, { scansUsed: 7, scansResetAt: NOV_1_MYT }, NOW);
    assert.deepEqual(u, { used: 7, resetAt: NOV_1_MYT, bonusUsed: 0 });
    const b = startingUsage(undefined, { bonusScansClaimedAt: 1, bonusScansRemaining: 2 }, NOW);
    assert.equal(b.bonusUsed, BONUS_SCANS - 2);
  });
});

describe("refundScan", () => {
  it("gives back what was spent and nothing else", () => {
    const d = spendScan(undefined, {}, NOW);
    assert.equal(refundScan(d.usage, d.spent, {}).usage.used, 0);
    const b = spendScan(undefined, { bonusScansClaimedAt: 1 }, NOW);
    assert.equal(refundScan(b.usage, b.spent, { bonusScansClaimedAt: 1 }).usage.bonusUsed, 0);
    assert.equal(refundScan({ used: 0, resetAt: NOV_1_MYT, bonusUsed: 0 }, "monthly", {}).usage.used, 0);
  });
});

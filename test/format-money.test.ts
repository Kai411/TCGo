// One ringgit format everywhere: "RM 1,521.21", never "RM 1521.21".
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatMoney, formatRM } from "../shared/format-money.ts";

describe("formatRM", () => {
  it("adds thousands separators and two decimals", () => {
    assert.equal(formatRM(1521.21), "RM 1,521.21");
    assert.equal(formatRM(7754.9), "RM 7,754.90");
    assert.equal(formatRM(1234567), "RM 1,234,567.00");
    assert.equal(formatRM(7), "RM 7.00");
  });

  it("rounds to the sen", () => {
    assert.equal(formatMoney(3006.249), "3,006.25");
    assert.equal(formatMoney(0.1 + 0.2), "0.30");
  });

  it("reads missing or bad values as zero instead of NaN", () => {
    assert.equal(formatRM(undefined), "RM 0.00");
    assert.equal(formatRM(null), "RM 0.00");
    assert.equal(formatRM("12.5"), "RM 12.50");
    assert.equal(formatRM(Number.NaN), "RM 0.00");
  });
});

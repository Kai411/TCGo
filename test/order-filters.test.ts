// The account page links into the Orders page with ?filter=, and both count
// orders with the same grouping. These pin the grouping and the link parsing.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { inOrderGroup, parseOrderFilter } from "~/shared/order-filters";

describe("order filters", () => {
  it("groups statuses the way buyers think about them", () => {
    assert.ok(inOrderGroup("pending", "topay"));
    assert.ok(inOrderGroup("confirmed", "topay"));
    assert.ok(inOrderGroup("paid", "intransit"));
    assert.ok(inOrderGroup("shipped", "intransit"));
    assert.ok(inOrderGroup("delivered", "completed"));
    assert.ok(inOrderGroup("cancelled", "cancelled"));
    assert.ok(!inOrderGroup("paid", "topay"));
    assert.ok(inOrderGroup("anything", "all"));
  });

  it("reads ?filter= and falls back to all", () => {
    assert.equal(parseOrderFilter("intransit"), "intransit");
    assert.equal(parseOrderFilter("cancelled"), "cancelled");
    assert.equal(parseOrderFilter("bogus"), "all");
    assert.equal(parseOrderFilter(undefined), "all");
    assert.equal(parseOrderFilter(["topay"]), "all");
  });
});

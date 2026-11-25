// Server-side order pricing (ledger stage 2): totals come from the listings.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineItemsFromListings, roundRM } from "~/shared/order-price";

const listing = (over: Record<string, unknown> = {}) => ({
  price: 12.5, sellerUid: "s1", cardName: "Pikachu", cardSet: "Base", condition: "NM",
  imageUrls: ["a.jpg"], shippingWM: 0, shippingEM: 0, ...over,
});

describe("lineItemsFromListings", () => {
  it("prices from the listing, not from what the order says", () => {
    const r = lineItemsFromListings(
      [{ cardId: "c1", price: 0.01 } as any, { cardId: "c2" }],
      new Map([["c1", listing()], ["c2", listing({ price: 0.1 + 0.2 })]]),
      "s1",
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.items.map((i) => i.price), [12.5, 0.3]);
    assert.equal(r.subtotal, 12.8);
    assert.equal(r.items[0]!.imageUrl, "a.jpg");
  });

  it("counts a card once", () => {
    const r = lineItemsFromListings([{ cardId: "c1" }, { cardId: "c1" }], new Map([["c1", listing()]]), "s1");
    assert.equal(r.ok && r.items.length, 1);
  });

  it("refuses missing, unpriced and other sellers' cards", () => {
    const m = new Map([["c1", listing()], ["free", listing({ price: 0 })], ["other", listing({ sellerUid: "s2" })]]);
    assert.deepEqual(lineItemsFromListings([{ cardId: "nope" }], m, "s1"), { ok: false, reason: "missing", cardId: "nope" });
    assert.deepEqual(lineItemsFromListings([{ cardId: "free" }], m, "s1"), { ok: false, reason: "bad_price", cardId: "free" });
    assert.deepEqual(lineItemsFromListings([{ cardId: "other" }], m, "s1"), { ok: false, reason: "other_seller", cardId: "other" });
    assert.deepEqual(lineItemsFromListings([], m, "s1"), { ok: false, reason: "empty" });
  });

  it("rounds ringgit to sen", () => {
    assert.equal(roundRM(74.445000001), 74.45);
  });
});

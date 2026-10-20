// The owned grid on /collection follows the page's Sort control. Newest
// (set release date) is the default, so a card with no date must never jump
// ahead of real ones.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { countBy, filterOwned, sortOwned } from "~/shared/collection-sort";

// Most recently added first, as the page builds them.
const cards = [
  { productId: 1, name: "Pikachu", price: { market: 10 } },
  { productId: 2, name: "Charizard", price: null },
  { productId: 3, name: "Bulbasaur", price: { market: 50 } },
  { productId: 4, name: "Eevee", price: { market: 5 } },
];
const released = new Map([
  [1, "2023-03-31"],
  [3, "2025-11-14"],
  [4, "2023-03-31"],
]);
const ids = (xs: Array<{ productId: number }>) => xs.map((c) => c.productId);

describe("sortOwned", () => {
  it("puts the newest release first and undated cards last", () => {
    assert.deepEqual(ids(sortOwned(cards, "newest", released)), [3, 1, 4, 2]);
  });

  it("keeps the added order between cards from the same set", () => {
    const flipped = [cards[3]!, cards[0]!];
    assert.deepEqual(ids(sortOwned(flipped, "newest", released)), [4, 1]);
  });

  it("keeps the added order for best", () => {
    assert.deepEqual(ids(sortOwned(cards, "best", released)), [1, 2, 3, 4]);
  });

  it("sorts by name", () => {
    assert.deepEqual(ids(sortOwned(cards, "name", released)), [3, 2, 4, 1]);
  });

  it("sorts by price both ways with unpriced cards last", () => {
    assert.deepEqual(ids(sortOwned(cards, "price_desc", released)), [3, 1, 4, 2]);
    assert.deepEqual(ids(sortOwned(cards, "price_asc", released)), [4, 1, 3, 2]);
  });

  it("does not reorder the input", () => {
    sortOwned(cards, "name", released);
    assert.deepEqual(ids(cards), [1, 2, 3, 4]);
  });
});

describe("filterOwned", () => {
  const owned = [
    { productId: 1, setName: "151", rarity: "Rare", language: "EN" },
    { productId: 2, setName: "151", rarity: "Common", language: "JP" },
    { productId: 3, setName: "Surging Sparks", rarity: "Rare", language: "EN" },
  ];

  it("keeps everything with no filter", () => {
    assert.equal(filterOwned(owned, { set: "", rarity: "", language: "ALL" }).length, 3);
  });

  it("combines set, rarity and language", () => {
    assert.deepEqual(ids(filterOwned(owned, { set: "151", rarity: "", language: "ALL" })), [1, 2]);
    assert.deepEqual(ids(filterOwned(owned, { set: "151", rarity: "Rare", language: "ALL" })), [1]);
    assert.deepEqual(ids(filterOwned(owned, { set: "", rarity: "", language: "JP" })), [2]);
  });

  it("matches the set name exactly", () => {
    assert.deepEqual(ids(filterOwned(owned, { set: "Sparks", rarity: "", language: "ALL" })), []);
  });

  it("counts the sets on hand", () => {
    assert.deepEqual(countBy(owned, (c) => c.setName), [
      { name: "151", count: 2 },
      { name: "Surging Sparks", count: 1 },
    ]);
  });
});

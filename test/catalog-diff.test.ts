// The nightly catalog seed writes only new or changed cards, and the Newest
// sort depends on which groups count as dated.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error plain .mjs helper without types
import { releaseDate, rowChanged } from "../scripts/lib/catalog-diff.mjs";

const stored = {
  name: "Pikachu",
  clean_name: "Pikachu",
  image_url: "https://img/1.jpg",
  category_id: 3,
  group_id: 100,
  group_name: "Base Set",
  url: "https://tcg/1",
  rarity: "Common",
  number: "58/102",
  card_type: null,
  stage: "Basic",
  hp: "40",
  language: "EN",
  released_on: "1999-01-09",
};

describe("rowChanged", () => {
  it("skips a card that matches what is stored", () => {
    assert.equal(rowChanged({ ...stored, card_type: "", modified_on: "2026-01-01T00:00:00" }, stored), false);
  });

  it("writes a new card or one with any compared column changed", () => {
    assert.equal(rowChanged(stored, undefined), true);
    assert.equal(rowChanged({ ...stored, rarity: "Rare" }, stored), true);
    assert.equal(rowChanged({ ...stored, released_on: null }, stored), true);
  });

  it("puts back a hand edit, as the full sync always did", () => {
    assert.equal(rowChanged(stored, { ...stored, name: "Edited by hand" }), true);
  });

  it("ignores released_on when the column is not there yet", () => {
    const { released_on, ...row } = stored;
    assert.equal(rowChanged(row, { ...stored, released_on: null }), false);
  });
});

describe("releaseDate", () => {
  it("keeps a real midnight release date", () => {
    assert.equal(releaseDate({ name: "ME06: Delta Reign", publishedOn: "2026-11-06T00:00:00" }), "2026-11-06");
  });

  it("treats TCGCSV build stamps as undated", () => {
    assert.equal(releaseDate({ name: "POP Series 1", publishedOn: "2026-11-25T20:00:07.3733511Z" }), null);
  });

  it("never dates Miscellaneous Cards & Products", () => {
    assert.equal(
      releaseDate({ name: "Miscellaneous Cards & Products", publishedOn: "2026-11-24T00:00:00" }),
      null,
    );
  });
});

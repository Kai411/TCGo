// Turning what someone typed into what the catalogue can answer.
//
// The search RPC matches `q` against the card NAME only —
// `c.name ILIKE '%q%'` — with the set and rarity passed as separate
// arguments. So anything the parser leaves in the name that isn't part of a
// card's name makes the query match nothing at all.
//
// That is exactly how "pikachu IR" and "pikachu surging sparks" returned
// empty on the seller's add-card search: the whole phrase went in as a name.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseSmartQuery, splitKnownSet } from "~/composables/useCardCatalog";

// A realistic slice, including the overlap that makes longest-match matter.
const SETS = [
  "Surging Sparks",
  "Prismatic Evolutions",
  "Evolutions",
  "Scarlet & Violet",
  "151",
  "Paldean Fates",
];

describe("pulling a set name off the query", () => {
  it("finds a two-word set at the end", () => {
    const r = splitKnownSet("pikachu surging sparks", SETS);
    assert.equal(r.name, "pikachu");
    assert.equal(r.setHint, "Surging Sparks");
  });

  it("prefers the longest match, not the first", () => {
    // "Evolutions" also matches the tail; picking it would search the wrong set.
    const r = splitKnownSet("eevee prismatic evolutions", SETS);
    assert.equal(r.setHint, "Prismatic Evolutions");
    assert.equal(r.name, "eevee");
  });

  it("returns the set's real casing, not what was typed", () => {
    assert.equal(splitKnownSet("PIKACHU SURGING SPARKS", SETS).setHint, "Surging Sparks");
  });

  it("handles a set name on its own", () => {
    const r = splitKnownSet("surging sparks", SETS);
    assert.equal(r.name, "");
    assert.equal(r.setHint, "Surging Sparks");
  });

  it("only matches at the end, where English puts it", () => {
    // "surging sparks pikachu" is not how anyone searches, and matching mid
    // string would strip words out of real card names.
    assert.equal(splitKnownSet("surging sparks pikachu", SETS).setHint, null);
  });

  it("respects word boundaries", () => {
    // Nothing here ends with a whole set name; "151" must not match inside
    // a longer token.
    assert.equal(splitKnownSet("charizard ex1151", SETS).setHint, null);
  });

  it("leaves an ordinary card name alone", () => {
    const r = splitKnownSet("charizard ex", SETS);
    assert.equal(r.name, "charizard ex");
    assert.equal(r.setHint, null);
  });

  it("is safe with no set list and with junk", () => {
    assert.deepEqual(splitKnownSet("pikachu", []), { name: "pikachu", setHint: null });
    assert.deepEqual(splitKnownSet("", SETS), { name: "", setHint: null });
    assert.equal(splitKnownSet("pikachu", ["", "  "]).setHint, null);
  });
});

describe("parseSmartQuery — rarity and numeric sets", () => {
  it("pulls a rarity abbreviation out of the name", () => {
    const p = parseSmartQuery("pikachu IR");
    assert.equal(p.name, "pikachu");
    assert.equal(p.rarityHint, "Illustration Rare");
  });

  it("pulls a numeric set hint out", () => {
    const p = parseSmartQuery("charizard ex 151");
    assert.equal(p.name, "charizard ex");
    assert.equal(p.setHint, "151");
  });

  it("keeps multi-word card names intact", () => {
    // "ex" is part of the name here, not a filter.
    assert.equal(parseSmartQuery("charizard ex").name, "charizard ex");
    assert.equal(parseSmartQuery("rayquaza vmax").name, "rayquaza vmax");
  });

  it("does not invent hints for a plain name", () => {
    const p = parseSmartQuery("pikachu");
    assert.equal(p.name, "pikachu");
    assert.equal(p.setHint, null);
    assert.equal(p.rarityHint, null);
  });
});

describe("the two queries that returned nothing", () => {
  // What the picker now does: set off the end first, then the rest parsed.
  const asPickerDoes = (raw: string) => {
    const { name, setHint } = splitKnownSet(raw, SETS);
    const p = parseSmartQuery(name || raw);
    return { q: p.name, set: setHint ?? p.setHint, rarity: p.rarityHint };
  };

  it("pikachu IR → name 'pikachu', rarity Illustration Rare", () => {
    assert.deepEqual(asPickerDoes("pikachu IR"), {
      q: "pikachu",
      set: null,
      rarity: "Illustration Rare",
    });
  });

  it("pikachu surging sparks → name 'pikachu', set Surging Sparks", () => {
    assert.deepEqual(asPickerDoes("pikachu surging sparks"), {
      q: "pikachu",
      set: "Surging Sparks",
      rarity: null,
    });
  });

  it("never leaves a filter word stranded in the name", () => {
    // The failure mode being guarded: any of these going to the RPC whole
    // means `c.name ILIKE '%pikachu surging sparks%'`, which matches nothing.
    for (const raw of ["pikachu IR", "pikachu surging sparks", "charizard ex 151"]) {
      assert.equal(asPickerDoes(raw).q.split(/\s+/).length <= 2, true, raw);
    }
  });
});

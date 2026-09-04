// Reading a typed search box.
//
// Every query in here was reported as returning nothing, and every set name in
// SETS is a real `group_name` from the catalogue — abbreviations are derived
// from those names rather than hand-listed, so a new set gets its short form
// for free and this stays honest about what the data actually looks like.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  looksLikeCardNumber,
  numberCandidates,
  splitCardNumber,
} from "~/shared/card-number";
import { parseSearchQuery, setAliases, splitKnownSet } from "~/shared/search-query";

const SETS = [
  "SV08: Surging Sparks",
  "SWSH: Crown Zenith: Galarian Gallery",
  "Legendary Treasures: Radiant Collection",
  "Generations: Radiant Collection",
  "SWSH09: Brilliant Stars Trainer Gallery",
  "SWSH11: Lost Origin Trainer Gallery",
  "SV3: Obsidian Flames",
  "Nintendo Promos",
];

describe("the queries that came back empty", () => {
  const parse = (q: string) => parseSearchQuery(q, SETS);

  it("pikachu 012 — a name and a number", () => {
    const r = parse("pikachu 012");
    assert.equal(r.name, "pikachu");
    assert.equal(r.numberMatch, "012");
  });

  it("pikachu ssp — a name and a set abbreviation", () => {
    const r = parse("pikachu ssp");
    assert.equal(r.name, "pikachu");
    assert.equal(r.setHint, "SV08: Surging Sparks");
  });

  it("pikachu gg — Galarian Gallery, not a number", () => {
    const r = parse("pikachu gg");
    assert.equal(r.name, "pikachu");
    assert.equal(r.setHint, "SWSH: Crown Zenith: Galarian Gallery");
    assert.equal(r.numberMatch, null, "gg alone is a set, not a number");
  });

  it("gg44 — a number on its own, no name", () => {
    const r = parse("gg44");
    assert.equal(r.numberMatch, "gg44");
    assert.equal(r.name, "");
  });

  it("tg05 — Trainer Gallery numbering", () => {
    assert.equal(parse("tg05").numberMatch, "tg05");
  });

  it("reshiram rc and shaymin rc — Radiant Collection", () => {
    for (const name of ["reshiram", "shaymin"]) {
      const r = parse(`${name} rc`);
      assert.equal(r.name, name);
      assert.match(r.setHint ?? "", /Radiant Collection$/);
    }
  });
});

describe("what counts as a number", () => {
  it("takes digits and known prefixes", () => {
    for (const t of ["012", "12", "202", "gg44", "TG05", "swsh020", "065/202"]) {
      assert.equal(looksLikeCardNumber(t), true, t);
    }
  });

  it("leaves words alone", () => {
    // "ex" and "holo" are part of a card's name or its finish. Reading them as
    // numbers would strip them out of the search that needs them.
    for (const t of ["pikachu", "ex", "holo", "vmax", "gg", "rc", ""]) {
      assert.equal(looksLikeCardNumber(t), false, t);
    }
  });

  it("offers the padded and unpadded forms", () => {
    assert.deepEqual(numberCandidates("12").sort(), ["012", "12"]);
    assert.deepEqual(numberCandidates("012").sort(), ["012", "12"]);
  });

  it("takes the number off the end, never the front", () => {
    assert.deepEqual(splitCardNumber("pikachu 012"), { name: "pikachu", number: "012" });
    assert.deepEqual(splitCardNumber("charizard ex"), { name: "charizard ex", number: null });
    // A number-first query is a name search; no card is called "012 pikachu".
    assert.equal(splitCardNumber("012 pikachu").number, null);
  });
});

describe("set abbreviations, derived from the set's own name", () => {
  it("gives the series code, the name and the printed code", () => {
    const a = setAliases("SV08: Surging Sparks");
    for (const want of ["sv08", "surging sparks", "ssp"]) assert.ok(a.includes(want), want);
  });

  it("does not also claim the initials when a printed code exists", () => {
    // Rebel Clash is RCL. Letting it answer to "rc" as well takes the alias
    // away from Radiant Collection, which has no code of its own.
    assert.equal(setAliases("SWSH02: Rebel Clash").includes("rc"), false);
    assert.ok(setAliases("SWSH02: Rebel Clash").includes("rcl"));
    assert.ok(setAliases("Legendary Treasures: Radiant Collection").includes("rc"));
  });

  it("abbreviates a subset by its last two words", () => {
    // Nobody types "bstg" for Brilliant Stars Trainer Gallery — they type "tg".
    assert.ok(setAliases("SWSH09: Brilliant Stars Trainer Gallery").includes("tg"));
    assert.ok(setAliases("Legendary Treasures: Radiant Collection").includes("rc"));
    assert.ok(setAliases("SWSH: Crown Zenith: Galarian Gallery").includes("gg"));
  });

  it("never produces a one-letter alias", () => {
    // A single letter would match a large slice of the catalogue.
    for (const s of SETS) {
      for (const a of setAliases(s)) assert.ok(a.length >= 2, `${s} → ${a}`);
    }
  });

  it("matches only at the end, on a word boundary", () => {
    // "Charizard ex" must not lose its "ex" to a set whose name ends the same.
    assert.equal(splitKnownSet("charizard ex", SETS).setHint, null);
    assert.equal(splitKnownSet("surging sparks pikachu", SETS).setHint, null);
  });

  it("prefers the longest alias when several match", () => {
    const r = splitKnownSet("pikachu surging sparks", SETS);
    assert.equal(r.setHint, "SV08: Surging Sparks");
    assert.equal(r.name, "pikachu");
  });

  it("returns the catalogue's own casing, for the substring match", () => {
    assert.equal(splitKnownSet("pikachu ssp", SETS).setHint, "SV08: Surging Sparks");
  });
});

describe("set, number and rarity together", () => {
  it("reads all three out of one query", () => {
    const r = parseSearchQuery("charizard obsidian flames sir", SETS);
    assert.equal(r.name, "charizard");
    assert.equal(r.setHint, "SV3: Obsidian Flames");
    assert.equal(r.rarityHint, "Special Illustration Rare");
  });

  it("takes the set off before the number, since a set can be several words", () => {
    const r = parseSearchQuery("pikachu surging sparks 012", SETS);
    assert.equal(r.setHint, "SV08: Surging Sparks");
    assert.equal(r.numberMatch, "012");
    assert.equal(r.name, "pikachu");
  });

  it("survives an empty box", () => {
    const r = parseSearchQuery("", SETS);
    assert.deepEqual(r, { name: "", setHint: null, rarityHint: null, numberMatch: null });
  });

  it("works with no set list at all", () => {
    // The picker parses before listSets() has resolved.
    const r = parseSearchQuery("pikachu 012", []);
    assert.equal(r.numberMatch, "012");
    assert.equal(r.name, "pikachu");
  });
});

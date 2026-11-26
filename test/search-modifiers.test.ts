// Words that describe the copy rather than the card — its grade and finish —
// and full printed numbers typed anywhere in the query. Each case here came
// back empty or wrong before.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { numberCandidates } from "~/shared/card-number";
import { extractModifiers, normalizeQuery, parseSearchQuery } from "~/shared/search-query";

const SETS = [
  "SV08: Surging Sparks",
  "SV03: Obsidian Flames",
  "SV: Scarlet & Violet 151",
  "Pokemon TCG Classic: Charizard",
];
const RARITIES = ["Common", "Rare", "Holo Rare", "Hyper Rare", "Special Illustration Rare", "ACE SPEC Rare"];
const parse = (q: string) => parseSearchQuery(q, SETS, RARITIES);

describe("grades in a catalogue search", () => {
  it("psa 10 is a grade, not card number 10", () => {
    const r = parse("charizard psa 10");
    assert.equal(r.name, "charizard");
    assert.equal(r.numberMatch, null);
    assert.deepEqual(r.grade, { company: "PSA", grade: "10", raw: false });
  });

  it("reads glued and half grades", () => {
    assert.deepEqual(parse("umbreon psa10").grade, { company: "PSA", grade: "10", raw: false });
    assert.deepEqual(parse("lugia bgs 9.5").grade, { company: "BGS", grade: "9.5", raw: false });
    assert.equal(parse("lugia beckett 9.5").grade?.company, "BGS");
  });

  it("takes graded and raw on their own", () => {
    assert.deepEqual(parse("pikachu graded").grade, { company: null, grade: null, raw: false });
    assert.equal(parse("pikachu raw").grade?.raw, true);
    assert.equal(parse("pikachu raw").name, "pikachu");
  });

  it("leaves TAG TEAM and ACE SPEC alone without a number", () => {
    assert.equal(parse("pikachu & zekrom tag team").name, "pikachu & zekrom tag team");
    assert.equal(extractModifiers("pikachu & zekrom tag team").grade, null);
    assert.equal(extractModifiers("master ball ace").grade, null);
  });

  it("never empties the query", () => {
    assert.equal(extractModifiers("raw").rest, "raw");
    assert.equal(extractModifiers("unlimited").rest, "unlimited");
  });
});

describe("finishes", () => {
  it("reverse holo is a finish, not the Holo Rare rarity", () => {
    const r = parse("charizard reverse holo");
    assert.equal(r.name, "charizard");
    assert.deepEqual(r.rarityMatches, []);
    assert.equal(r.variant, "reverse-holo");
  });

  it("reads the other finishes", () => {
    assert.equal(parse("charizard rh").variant, "reverse-holo");
    assert.equal(parse("charizard 1st edition").variant, "1st-edition");
    assert.equal(parse("charizard 1st edition").name, "charizard");
    assert.equal(parse("blastoise unlimited").variant, "unlimited");
    assert.equal(parse("pikachu non holo").variant, "non-holo");
  });

  it("keeps bare holo as the vintage rarity", () => {
    const r = parse("charizard holo");
    assert.equal(r.variant, null);
    assert.deepEqual(r.rarityMatches, ["Holo Rare"]);
  });
});

describe("full printed numbers", () => {
  it("199/165 first or last", () => {
    for (const q of ["charizard 199/165", "199/165 charizard"]) {
      const r = parse(q);
      assert.equal(r.name, "charizard", q);
      assert.equal(r.numberMatch, "199/165", q);
      assert.equal(r.setHint, null, `${q}: not the Charizard set`);
    }
  });

  it("tolerates spaces round the slash", () => {
    assert.equal(parse("charizard 199 / 165").numberMatch, "199/165");
  });

  it("tries the padded forms of both sides", () => {
    const forms = numberCandidates("4/102");
    for (const f of ["4/102", "04/102", "004/102"]) assert.ok(forms.includes(f), f);
    assert.ok(numberCandidates("GG44/GG70").includes("GG44/GG70"));
  });
});

describe("set code first, Pokémon set last", () => {
  it("obf charizard 125 is card 125 in Obsidian Flames", () => {
    const r = parse("obf charizard 125");
    assert.equal(r.name, "charizard");
    assert.match(r.setHint ?? "", /Obsidian Flames/);
    assert.equal(r.numberMatch, "125");
  });
});

describe("tidying", () => {
  it("rewrites alt art to how TCGPlayer names it", () => {
    assert.equal(parse("umbreon vmax alt art").name, "umbreon vmax alternate");
    assert.equal(parse("umbreon vmax alt").name, "umbreon vmax alternate");
  });

  it("straightens phone apostrophes", () => {
    assert.equal(normalizeQuery("lillie’s clefairy"), "lillie's clefairy");
  });

  it("keeps the language reading", () => {
    const r = parse("charizard psa 10 jp");
    assert.equal(r.languageHint, "JP");
    assert.equal(r.name, "charizard");
  });
});

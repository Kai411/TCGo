// The search box, read the way collectors type it.
//
// Each case here came back wrong before this file existed: a rarity typed out
// in words kept half of itself in the card name, grading numbers were read as
// card numbers, "jp" was searched for as part of a name, and a set code in
// front of the number was not recognised at all.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractQualifiers,
  parseSearchQuery,
  splitLeadingSetCode,
  stripRarityPhrase,
} from "~/shared/search-query";

const SETS = [
  "SV08: Surging Sparks",
  "SV: Scarlet & Violet 151",
  "SWSH07: Evolving Skies",
  "ME01: Mega Evolution",
  "ME02: Phantasmal Flames",
  "XY12: Evolutions",
  "SV: Prismatic Evolutions",
  "Jungle",
];

const RARITIES = [
  "Common", "Rare", "Holo Rare", "Double Rare", "Ultra Rare", "Hyper Rare",
  "Secret Rare", "Illustration Rare", "Special Illustration Rare",
  "ACE SPEC Rare", "Promo", "Special Art Rare", "Gold Star",
];

const parse = (q: string) => parseSearchQuery(q, SETS, RARITIES);

describe("a rarity typed out in words", () => {
  it("hyper rare is Hyper Rare, not Rare with hyper left in the name", () => {
    const r = parse("charizard hyper rare");
    assert.equal(r.name, "charizard");
    assert.deepEqual(r.rarityMatches, ["Hyper Rare"]);
  });

  it("takes the longest name: special illustration rare beats illustration rare", () => {
    const r = parse("umbreon special illustration rare");
    assert.equal(r.name, "umbreon");
    assert.deepEqual(r.rarityMatches, ["Special Illustration Rare"]);
  });

  it("reads collector phrases that are not the rarity's own name", () => {
    assert.deepEqual(parse("pikachu ace spec").rarityMatches, ["ACE SPEC Rare"]);
    assert.equal(parse("pikachu ace spec").name, "pikachu");
    assert.deepEqual(parse("charizard secret").rarityMatches, ["Secret Rare"]);
  });

  it("on its own, browses that rarity", () => {
    const r = parse("hyper rare");
    assert.equal(r.name, "");
    assert.equal(r.rarityHint, "Hyper Rare");
  });

  it("works before the rarity list has loaded", () => {
    const r = stripRarityPhrase("charizard special illustration rare");
    assert.equal(r.rest, "charizard");
    assert.deepEqual(r.rarityMatches, ["Special Illustration Rare"]);
  });

  it("never takes a one-word phrase from the front", () => {
    assert.deepEqual(stripRarityPhrase("secret box", RARITIES).rarityMatches, []);
  });

  it("still pairs with a set", () => {
    const r = parse("pikachu surging sparks special illustration rare");
    assert.equal(r.name, "pikachu");
    assert.equal(r.setHint, "SV08: Surging Sparks");
    assert.deepEqual(r.rarityMatches, ["Special Illustration Rare"]);
  });
});

describe("grading", () => {
  it("psa 10 is a grade, not card number 10", () => {
    const r = parse("charizard psa 10");
    assert.equal(r.name, "charizard");
    assert.equal(r.numberMatch, null);
    assert.deepEqual(r.grade, { company: "PSA", grade: "10" });
  });

  it("reads half grades and glued forms", () => {
    assert.deepEqual(extractQualifiers("umbreon bgs 9.5").grade, { company: "BGS", grade: "9.5" });
    assert.deepEqual(extractQualifiers("umbreon psa10").grade, { company: "PSA", grade: "10" });
  });

  it("keeps the card number when both are there", () => {
    const r = parse("charizard 4/102 psa 9");
    assert.equal(r.numberMatch, "4/102");
    assert.deepEqual(r.grade, { company: "PSA", grade: "9" });
  });

  it("leaves tag team and ace spec alone", () => {
    assert.equal(extractQualifiers("pikachu zekrom tag team").grade, null);
    assert.deepEqual(parse("pikachu ace spec").grade, null);
    assert.deepEqual(extractQualifiers("pikachu tag 10").grade, { company: "TAG", grade: "10" });
  });
});

describe("language", () => {
  it("jp and japanese pick Japanese", () => {
    assert.equal(parse("charizard jp").language, "JP");
    assert.equal(parse("charizard japanese").name, "charizard");
  });

  it("english picks English", () => {
    assert.equal(parse("english pikachu").language, "EN");
    assert.equal(parse("english pikachu").name, "pikachu");
  });

  it("is not taken when it is the whole query", () => {
    const r = parse("english");
    assert.equal(r.language, null);
    assert.equal(r.name, "english");
  });
});

describe("finish", () => {
  it("reverse holo is a finish, not a rarity with reverse in the name", () => {
    const r = parse("pikachu reverse holo");
    assert.equal(r.name, "pikachu");
    assert.equal(r.variant, "Reverse Holofoil");
    assert.deepEqual(r.rarityMatches, []);
  });

  it("1st edition comes off with the rest still read", () => {
    const r = parse("charizard 1st edition 4/102");
    assert.equal(r.name, "charizard");
    assert.equal(r.variant, "1st Edition");
    assert.equal(r.numberMatch, "4/102");
  });

  it("holo on its own is still Holo Rare", () => {
    assert.deepEqual(parse("charizard holo").rarityMatches, ["Holo Rare"]);
  });
});

describe("a set code in front", () => {
  it("ssp 238", () => {
    const r = parse("ssp 238");
    assert.equal(r.name, "");
    assert.match(r.setHint ?? "", /Surging Sparks/);
    assert.equal(r.numberMatch, "238");
  });

  it("sv08 pikachu", () => {
    const r = parse("sv08 pikachu");
    assert.equal(r.name, "pikachu");
    assert.match(r.setHint ?? "", /^SV08/);
  });

  it("pfl mega charizard x ex", () => {
    const r = parse("pfl mega charizard x ex");
    assert.equal(r.name, "mega charizard x ex");
    assert.match(r.setHint ?? "", /Phantasmal Flames/);
  });

  it("never takes a word that is a name", () => {
    // Jungle is a set, and a word; Charizard is both too in the real data.
    assert.equal(splitLeadingSetCode("jungle pikachu", SETS).setHint, null);
  });

  it("the Mega Evolution sets answer to their printed codes", () => {
    assert.match(parse("charizard pfl").setHint ?? "", /Phantasmal Flames/);
    assert.match(parse("lucario meg").setHint ?? "", /Mega Evolution/);
  });
});

describe("combined", () => {
  it("charizard 199/165", () => {
    const r = parse("charizard 199/165");
    assert.equal(r.name, "charizard");
    assert.equal(r.numberMatch, "199/165");
  });

  it("everything at once", () => {
    const r = parse("umbreon vmax evs 215 jp psa 10");
    assert.equal(r.name, "umbreon vmax");
    assert.equal(r.setHint, "SWSH07: Evolving Skies");
    assert.equal(r.numberMatch, "215");
    assert.equal(r.language, "JP");
    assert.deepEqual(r.grade, { company: "PSA", grade: "10" });
  });
});

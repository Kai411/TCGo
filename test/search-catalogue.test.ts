// The catalogue search, read the way collectors type.
//
// The brief: a search should find a card by its name, the Pokémon's name, the
// set's name, the set's code, the card number and the rarity — in any of the
// shapes people actually type them. These cover the shapes that used to come
// back empty: punctuation left out ("mr mime"), a set typed first ("ssp
// pikachu"), a rarity written out ("illustration rare"), a language ("jp"), a
// "#" on the number, and a misspelt name ("charzard").

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  nameSearchPattern,
  suggestNameCorrection,
  editDistance,
} from "~/shared/search-name";
import {
  parseSearchQuery,
  splitLeadingSet,
  stripLanguage,
  stripRarityPhrase,
} from "~/shared/search-query";

const SETS = [
  "SV08: Surging Sparks",
  "SV3: Obsidian Flames",
  "SV: Scarlet & Violet 151",
  "SV2a: Pokemon Card 151",
  "SWSH: Crown Zenith: Galarian Gallery",
  "SM - Burning Shadows",
  "Base Set",
  "Jungle",
  "Team Rocket",
  "ME02: Phantasmal Flames",
];

const RARITIES = [
  "Common", "Uncommon", "Rare", "Holo Rare", "Double Rare", "Ultra Rare",
  "Hyper Rare", "Secret Rare", "Illustration Rare", "Special Illustration Rare",
  "Shiny Rare", "Mega Ultra Rare", "ACE SPEC Rare", "Promo", "Art Rare",
  "Special Art Rare", "Super Rare", "Character Rare", "Gold Star",
];

/** The set filter finds this set — it is a substring match on the name. */
const assertSet = (hint: string | null, set: string) =>
  assert.ok(
    hint && SETS.some((n) => n.includes(set) && n.toLowerCase().includes(hint.toLowerCase())),
    `expected a set filter for ${set}, got ${hint}`,
  );

/** Would `name ILIKE '%' || pattern || '%'` match this card name? */
const ilike = (cardName: string, pattern: string): boolean => {
  const re = new RegExp(
    pattern
      .split("")
      .map((c) =>
        c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join(""),
    "i",
  );
  return re.test(cardName);
};

describe("the name, typed without its punctuation", () => {
  const cases: Array<[string, string]> = [
    ["mr mime", "Mr. Mime"],
    ["mrmime", "Mr. Mime"],
    ["farfetchd", "Farfetch'd"],
    ["sirfetchd v", "Galarian Sirfetch'd V"],
    ["ho oh", "Ho-Oh ex"],
    ["hooh", "Ho-Oh"],
    ["flabebe", "Flabébé"],
    ["type null", "Type: Null"],
    ["porygon z", "Porygon-Z"],
    ["chi yu ex", "Chi-Yu ex"],
    ["mime jr", "Mime Jr."],
    ["nidoran", "Nidoran♀"],
    ["pokemon catcher", "Pokémon Catcher"],
    ["lillies clefairy", "Lillie's Clefairy ex"],
    ["team rockets mewtwo", "Team Rocket's Mewtwo ex"],
    ["boss orders", "Boss's Orders"],
    ["mega charizard ex", "Mega Charizard X ex"],
    ["charizard ex", "Charizard ex"],
  ];
  for (const [typed, card] of cases) {
    it(`"${typed}" finds ${card}`, () => {
      assert.ok(
        ilike(card, nameSearchPattern(typed)),
        `${nameSearchPattern(typed)} should match ${card}`,
      );
    });
  }

  it("still matches what it matched before", () => {
    for (const card of ["Pikachu", "Landorus", "Charizard VMAX", "Rockets"]) {
      assert.ok(ilike(card, nameSearchPattern(card.toLowerCase())), card);
    }
  });

  it("never lets a typed wildcard through", () => {
    assert.ok(!/[_]/.test(nameSearchPattern("pika_chu")));
    assert.equal(nameSearchPattern("100%"), "100");
  });

  it("does not turn another script into wildcards", () => {
    assert.equal(nameSearchPattern("ピカチュウ"), "ピカチュウ");
  });
});

describe("a misspelt Pokémon name", () => {
  it("corrects one letter out", () => {
    assert.equal(suggestNameCorrection("charzard ex"), "Charizard ex");
    assert.equal(suggestNameCorrection("snorlx"), "Snorlax");
  });

  it("corrects swapped letters", () => {
    assert.equal(suggestNameCorrection("pikahcu"), "Pikachu");
    assert.equal(suggestNameCorrection("lugai"), "Lugia");
  });

  it("leaves a right name alone", () => {
    assert.equal(suggestNameCorrection("gengar"), null);
    assert.equal(suggestNameCorrection("umbreon vmax"), null);
  });

  it("leaves words that are not Pokémon alone", () => {
    assert.equal(suggestNameCorrection("professors research"), null);
  });

  it("leaves short words alone", () => {
    assert.equal(suggestNameCorrection("mwe"), null);
  });

  it("counts a swap as one edit", () => {
    assert.equal(editDistance("ab", "ba"), 1);
    assert.equal(editDistance("kitten", "sitting"), 3);
  });
});

describe("the set typed first", () => {
  it("ssp pikachu", () => {
    const r = parseSearchQuery("ssp pikachu", SETS, RARITIES);
    assert.equal(r.name, "pikachu");
    assertSet(r.setHint, "Surging Sparks");
  });

  it("surging sparks pikachu", () => {
    const r = parseSearchQuery("surging sparks pikachu", SETS, RARITIES);
    assert.equal(r.name, "pikachu");
    assertSet(r.setHint, "Surging Sparks");
  });

  it("sv08 pikachu 057 — set, name and number", () => {
    const r = parseSearchQuery("sv08 pikachu 057", SETS, RARITIES);
    assert.equal(r.name, "pikachu");
    assertSet(r.setHint, "SV08");
    assert.equal(r.numberMatch, "057");
  });

  it("151 charizard", () => {
    const r = parseSearchQuery("151 charizard", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assertSet(r.setHint, "151");
  });

  it("base set charizard", () => {
    const r = parseSearchQuery("base set charizard", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assertSet(r.setHint, "Base Set");
  });

  it("a one-word set never eats a card name at the front", () => {
    // "Jungle" and "Team Rocket" are sets; the cards still come first.
    assert.equal(splitLeadingSet("jungle pikachu", SETS).setHint, null);
    assert.equal(splitLeadingSet("team rockets mewtwo", SETS).setHint, null);
  });

  it("derived initials are not read at the front", () => {
    assert.equal(splitLeadingSet("gg pikachu", SETS).setHint, null);
  });

  it("needs something left over", () => {
    assert.equal(splitLeadingSet("surging sparks", SETS).setHint, null);
  });

  it("reads the code of a set written with a dash", () => {
    const r = parseSearchQuery("charizard bus", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assertSet(r.setHint, "Burning Shadows");
  });

  it("knows the Mega Evolution era codes", () => {
    const r = parseSearchQuery("pfl charizard", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assertSet(r.setHint, "Phantasmal Flames");
  });
});

describe("the rarity written out", () => {
  it("pikachu illustration rare", () => {
    const r = parseSearchQuery("pikachu illustration rare", SETS, RARITIES);
    assert.equal(r.name, "pikachu");
    assert.deepEqual(r.rarityMatches, ["Illustration Rare"]);
  });

  it("special illustration rare beats illustration rare", () => {
    const r = parseSearchQuery(
      "charizard special illustration rare",
      SETS,
      RARITIES,
    );
    assert.equal(r.name, "charizard");
    assert.deepEqual(r.rarityMatches, ["Special Illustration Rare"]);
  });

  it("the word rare may be left off", () => {
    const r = parseSearchQuery("umbreon special illustration", SETS, RARITIES);
    assert.equal(r.name, "umbreon");
    assert.deepEqual(r.rarityMatches, ["Special Illustration Rare"]);
  });

  it("hyper rare on its own lists the rarity", () => {
    const r = parseSearchQuery("hyper rare", SETS, RARITIES);
    assert.equal(r.name, "");
    assert.deepEqual(r.rarityMatches, ["Hyper Rare"]);
  });

  it("with a set and a number too", () => {
    const r = parseSearchQuery("charizard obf hyper rare", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assertSet(r.setHint, "Obsidian Flames");
    assert.deepEqual(r.rarityMatches, ["Hyper Rare"]);
  });

  it("does not read a card name as a rarity", () => {
    assert.deepEqual(stripRarityPhrase("rare candy", RARITIES).rarityMatches, []);
    assert.deepEqual(stripRarityPhrase("ultra ball", RARITIES).rarityMatches, []);
  });

  it("the short codes still work", () => {
    for (const [q, rarity] of [
      ["charizard sir", "Special Illustration Rare"],
      ["pikachu ir", "Illustration Rare"],
      ["charizard hr", "Hyper Rare"],
      ["rayquaza gold star", "Gold Star"],
    ] as const) {
      assert.deepEqual(parseSearchQuery(q, SETS, RARITIES).rarityMatches, [rarity], q);
    }
  });
});

describe("the language", () => {
  it("pikachu jp", () => {
    const r = parseSearchQuery("pikachu jp", SETS, RARITIES);
    assert.equal(r.name, "pikachu");
    assert.equal(r.languageHint, "JP");
  });

  it("japanese charizard sar", () => {
    const r = parseSearchQuery("japanese charizard sar", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assert.equal(r.languageHint, "JP");
    assert.deepEqual(r.rarityMatches, ["Special Art Rare"]);
  });

  it("english on its own is not a filter", () => {
    assert.equal(stripLanguage("english").languageHint, null);
  });

  it("no language named, no hint", () => {
    assert.equal(parseSearchQuery("pikachu", SETS, RARITIES).languageHint, null);
  });
});

describe("the number, however it is written", () => {
  it("charizard 199/165", () => {
    const r = parseSearchQuery("charizard 199/165", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assert.equal(r.numberMatch, "199/165");
  });

  it("charizard #199", () => {
    const r = parseSearchQuery("charizard #199", SETS, RARITIES);
    assert.equal(r.name, "charizard");
    assert.equal(r.numberMatch, "199");
  });

  it("all six at once: language, set, name, number, rarity", () => {
    const r = parseSearchQuery("ssp pikachu 238 sir en", SETS, RARITIES);
    assert.equal(r.name, "pikachu");
    assertSet(r.setHint, "Surging Sparks");
    assert.equal(r.numberMatch, "238");
    assert.deepEqual(r.rarityMatches, ["Special Illustration Rare"]);
    assert.equal(r.languageHint, "EN");
  });
});

describe("the marketplace search, word by word across a listing", async () => {
  const { listingMatches } = await import("~/shared/search-listing");
  const charizard = {
    name: "Charizard ex",
    set: "SV3: Obsidian Flames",
    number: "223/197",
    rarity: "Special Illustration Rare",
    language: "EN",
    seller: "kantotrader",
    condition: "Near Mint",
    gradingProvider: "PSA",
    grade: "10",
    variant: "Holo",
    artist: "PLANETA Mochizuki",
  };
  const mime = { name: "Mr. Mime", set: "Jungle", number: "6/64", rarity: "Holo Rare", language: "JP" };

  const yes = (l: any, q: string) => assert.ok(listingMatches(l, q), `"${q}" should match`);
  const no = (l: any, q: string) => assert.ok(!listingMatches(l, q), `"${q}" should not match`);

  it("name, set code, rarity code", () => yes(charizard, "charizard obf sir"));
  it("name and number", () => {
    yes(charizard, "charizard 223");
    yes(charizard, "charizard 223/197");
    yes(charizard, "charizard #223");
  });
  it("grading", () => {
    yes(charizard, "charizard psa 10");
    yes(charizard, "charizard psa10");
  });
  it("the illustrator", () => yes(charizard, "mochizuki"));
  it("the language", () => {
    yes(mime, "mr mime jp");
    no(mime, "mr mime english");
  });
  it("punctuation left out", () => {
    yes(mime, "mrmime");
    yes(mime, "mr mime");
  });
  it("a typo", () => yes(charizard, "charzard"));
  it("word order", () => yes(charizard, "ex charizard"));
  it("every word must land somewhere", () => {
    no(charizard, "charizard pikachu");
    no(charizard, "charizard ir");
    no(charizard, "charizard 199");
  });
  it("an empty query matches", () => yes(charizard, "  "));
});

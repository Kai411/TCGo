// Matching a scanned card to the catalogue.
//
// Rows use the shapes the catalogue really stores: zero-padded numbers
// ("065/202"), TCGplayer's " - 199/165" suffix on same-name printings,
// accents, and Galarian Gallery numbers.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  nameScore,
  normalizeCardName,
  normalizeNumberPart,
  numberScore,
  printedNumberForms,
  rankScanMatches,
} from "~/shared/scan-match";

const row = (productId: number, name: string, number: string | null) => ({
  productId,
  name,
  number,
});

describe("normalizeCardName", () => {
  it("drops TCGplayer's number suffix, brackets, accents and punctuation", () => {
    assert.equal(normalizeCardName("Charizard ex - 199/165"), "charizard ex");
    assert.equal(normalizeCardName("Umbreon VMAX (Secret)"), "umbreon vmax");
    assert.equal(normalizeCardName("Flabébé"), "flabebe");
    assert.equal(normalizeCardName("Professor’s Research"), "professors research");
    assert.equal(normalizeCardName("Team Rocket's Mewtwo ex"), "team rockets mewtwo ex");
  });
});

describe("numbers", () => {
  it("compares numbers without leading zeros", () => {
    assert.equal(normalizeNumberPart("065"), "65");
    assert.equal(normalizeNumberPart("GG04"), "gg4");
    assert.equal(normalizeNumberPart("SWSH020"), "swsh20");
    assert.equal(normalizeNumberPart("0"), "0");
  });

  it("queries the padded forms the catalogue stores", () => {
    assert.deepEqual(printedNumberForms("65").sort(), ["065", "65"]);
    assert.deepEqual(printedNumberForms("5").sort(), ["005", "05", "5"]);
    assert.ok(printedNumberForms("GG4").includes("GG04"));
  });

  it("scores the full number above a bare one", () => {
    assert.equal(numberScore("65/202", "065/202"), 1);
    assert.equal(numberScore("65", "065/202"), 0.6);
    assert.equal(numberScore("65/198", "065/202"), 0.4);
    assert.equal(numberScore("66/202", "065/202"), 0);
    assert.equal(numberScore("", "065/202"), 0);
  });
});

describe("nameScore", () => {
  it("ranks identical, then extended, then partial", () => {
    assert.equal(nameScore("Charizard ex", "Charizard ex - 199/165"), 1);
    assert.equal(nameScore("Charizard", "Charizard ex"), 0.8);
    assert.ok(nameScore("Mewtwo ex", "Team Rocket's Mewtwo ex") < 0.8);
    assert.equal(nameScore("Pikachu", "Bulbasaur"), 0);
  });
});

describe("rankScanMatches", () => {
  it("finds a zero-padded card the old string match missed", () => {
    const rows = [row(1, "Dubwool V", "153/202"), row(2, "Zacian V", "138/202"), row(3, "Pikachu", "065/202")];
    const r = rankScanMatches({ name: "Pikachu", number: "65/202" }, rows);
    assert.deepEqual(r.exact.map((m) => m.productId), [3]);
  });

  it("is certain only when name and full number agree", () => {
    const rows = [row(1, "Charizard ex", "006/165"), row(2, "Charizard ex - 199/165", "199/165")];
    const r = rankScanMatches({ name: "Charizard ex", number: "199/165" }, rows);
    assert.deepEqual(r.exact.map((m) => m.productId), [2]);
  });

  it("prefers the identical name when an ex shares the number", () => {
    const rows = [row(1, "Pikachu ex", "063/191"), row(2, "Pikachu", "063/191")];
    const r = rankScanMatches({ name: "Pikachu", number: "63/191" }, rows);
    assert.deepEqual(r.exact.map((m) => m.productId), [2]);
  });

  it("offers every printing that matches exactly", () => {
    const rows = [row(1, "Umbreon VMAX", "215/203"), row(2, "Umbreon VMAX", "215/203")];
    const r = rankScanMatches({ name: "Umbreon VMAX", number: "215/203" }, rows);
    assert.equal(r.exact.length, 2);
  });

  it("falls back to a choice when the name was misread", () => {
    // A translation off by a word: the number still finds the card, but it
    // is offered, not picked.
    const rows = [row(1, "Mewtwo", "150/165"), row(2, "Team Rocket's Mewtwo ex", "081/182")];
    const r = rankScanMatches({ name: "Mewtwo ex", number: "81/182" }, rows);
    assert.equal(r.exact.length, 0);
    assert.equal(r.suggestions[0]?.productId, 2);
  });

  it("ranks a number match from another set below the right set", () => {
    const rows = [row(1, "Pikachu", "025/198"), row(2, "Pikachu", "025/165")];
    const r = rankScanMatches({ name: "Pikachu", number: "25/165" }, rows);
    assert.deepEqual(r.exact.map((m) => m.productId), [2]);
  });

  it("with no number, offers name matches rather than picking one", () => {
    const rows = [row(1, "Snorlax", "143/165"), row(2, "Snorlax", "051/078")];
    const r = rankScanMatches({ name: "Snorlax", number: "" }, rows);
    assert.equal(r.exact.length, 0);
    assert.equal(r.suggestions.length, 2);
  });

  it("drops rows that share nothing with the scan", () => {
    const r = rankScanMatches({ name: "Snorlax", number: "143/165" }, [row(1, "Eevee", "133/165")]);
    assert.equal(r.exact.length + r.suggestions.length, 0);
  });
});

// What buyers see as the seller: SSM numbers and business names are checked
// the same way in the form and on the server (shared/seller-disclosure.ts).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  hasSellerType,
  normaliseBusinessName,
  normaliseSsm,
} from "~/shared/seller-disclosure";

describe("SSM numbers", () => {
  it("accepts the 12-digit format, with spaces or dashes typed in", () => {
    assert.equal(normaliseSsm("202403123456"), "202403123456");
    assert.equal(normaliseSsm(" 2024-03-123456 "), "202403123456");
    // Older entities were renumbered with their original year.
    assert.equal(normaliseSsm("196501000123"), "196501000123");
  });

  it("accepts older company and enterprise numbers, tidied", () => {
    assert.equal(normaliseSsm("123456-a"), "123456-A");
    assert.equal(normaliseSsm("123456A"), "123456-A");
    assert.equal(normaliseSsm("jm0123456-x"), "JM0123456-X");
  });

  it("refuses things that aren't SSM numbers", () => {
    for (const bad of ["", "abc", "12345", "900101101234", "202400123456", "2024031234567", "123456-AB"]) {
      assert.equal(normaliseSsm(bad), "", `${bad} should be refused`);
    }
  });
});

describe("business names", () => {
  it("collapses spacing and refuses empty or overlong names", () => {
    assert.equal(normaliseBusinessName("  Kad   Kedai  Enterprise "), "Kad Kedai Enterprise");
    assert.equal(normaliseBusinessName(" "), "");
    assert.equal(normaliseBusinessName("x".repeat(121)), "");
  });
});

describe("seller type", () => {
  it("only counts the two known answers", () => {
    assert.equal(hasSellerType({ sellerType: "individual" }), true);
    assert.equal(hasSellerType({ sellerType: "business" }), true);
    assert.equal(hasSellerType({ sellerType: "" }), false);
    assert.equal(hasSellerType(null), false);
  });

  it("can't be set by the owner directly (rules)", () => {
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const fn = rules.slice(rules.indexOf("function protectedProfileFields"));
    assert.match(fn.slice(0, fn.indexOf("];")), /'sellerType'/);
  });
});

// The Gold Star rule runs on every nightly seed, over the whole catalogue.
//
// That is what makes it stick — the seed rewrites name and rarity from
// upstream every night, so a one-off UPDATE would not survive — and it is also
// what makes it worth pinning: a rule this broad going wrong renames cards
// that were never Gold Stars, on production data, unattended.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GOLD_STAR_RARITY,
  applyGoldStar,
  goldStarName,
  isGoldStar,
} from "~/scripts/lib/gold-star.mjs";

describe("which cards are Gold Stars", () => {
  it("recognises the subset marker", () => {
    for (const n of ["Rayquaza Star", "Charizard Star (Delta Species)"]) {
      assert.equal(isGoldStar(n), true, n);
    }
  });

  it("never touches Prism Star", () => {
    // A different subset with a different symbol (◇) whose cards also end in
    // the word. 53 of them in the catalogue.
    for (const n of ["Tapu Koko Prism Star", "Giratina Prism Star"]) {
      assert.equal(isGoldStar(n), false, n);
    }
  });

  it("ignores a name that merely contains the word", () => {
    for (const n of ["Starmie", "Staryu", "Starly", "Magnezone VSTAR", "Star Birth"]) {
      assert.equal(isGoldStar(n), false, n);
    }
  });

  it("survives a missing or odd name", () => {
    for (const n of [null, undefined, "", 42]) {
      assert.equal(isGoldStar(n as never), false, String(n));
    }
  });
});

describe("the rename", () => {
  it("puts the symbol where the word was", () => {
    assert.equal(goldStarName("Rayquaza Star"), "Rayquaza ★");
  });

  it("keeps a parenthesised qualifier after the symbol", () => {
    assert.equal(
      goldStarName("Charizard Star (Delta Species)"),
      "Charizard ★ (Delta Species)",
    );
  });

  it("handles a championship-deck suffix", () => {
    assert.equal(
      goldStarName("Mew Star (Delta Species) - 2008 (Dylan Lefavour)"),
      "Mew ★ (Delta Species) - 2008 (Dylan Lefavour)",
    );
  });

  it("is idempotent — the seed reapplies it every night", () => {
    // The rule runs against rows it has already rewritten. A second pass must
    // change nothing, or the name grows a star every day.
    const once = goldStarName("Rayquaza Star");
    assert.equal(goldStarName(once), once);
    assert.equal(applyGoldStar(applyGoldStar({ name: "Rayquaza Star", rarity: "Ultra Rare" })).name,
      "Rayquaza ★");
  });

  it("leaves a non-Gold-Star name exactly as it was", () => {
    assert.equal(goldStarName("Tapu Koko Prism Star"), "Tapu Koko Prism Star");
    assert.equal(goldStarName("Starmie"), "Starmie");
  });
});

describe("the row the seed writes", () => {
  it("files it under the rarity collectors use", () => {
    const row = applyGoldStar({ name: "Rayquaza Star", rarity: "Ultra Rare" });
    assert.equal(row.name, "Rayquaza ★");
    assert.equal(row.rarity, GOLD_STAR_RARITY);
  });

  it("fills in a rarity where upstream had none", () => {
    // Thirteen of these carried null or "None", which is what made the subset
    // impossible to search for.
    for (const rarity of [null, undefined, "None"]) {
      assert.equal(applyGoldStar({ name: "Jolteon Star", rarity }).rarity, GOLD_STAR_RARITY);
    }
  });

  it("passes everything else straight through", () => {
    const row = { name: "Tapu Koko Prism Star", rarity: "Prism Rare", hp: "60" };
    assert.deepEqual(applyGoldStar(row), row);
  });

  it("does not mutate the row it is given", () => {
    const row = { name: "Rayquaza Star", rarity: "Ultra Rare" };
    applyGoldStar(row);
    assert.equal(row.name, "Rayquaza Star", "input was mutated");
  });
});

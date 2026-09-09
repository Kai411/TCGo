// Gold Star cards, named and filed the way collectors know them.
//
// The catalogue takes TCGPlayer's spelling: "Rayquaza Star", rarity Ultra Rare
// in English and Shiny Rare in Japanese — and on a fair number of rows, no
// rarity at all. The card itself says ★, and everyone calls the subset Gold
// Star. Neither of those facts is anywhere in the upstream data.
//
// THIS RUNS ON EVERY SEED, WHICH IS THE ONLY REASON IT STICKS.
// The nightly job upserts name and rarity straight from TCGCSV, so a one-off
// UPDATE against the table would be overwritten within a day. Applying the
// rule as rows are built means the catalogue is correct after every sync
// rather than until the next one.
//
// A rule rather than a list of ids, so a Gold Star printing we do not hold yet
// is covered the day it arrives.

/** The subset marker, as printed on the card. */
export const GOLD_STAR_SYMBOL = "★";
export const GOLD_STAR_RARITY = "Gold Star";

/**
 * "Star" as the subset marker: the last word, or last before a parenthesised
 * qualifier.
 *
 *   Rayquaza Star                                  → Rayquaza ★
 *   Charizard Star (Delta Species)                 → Charizard ★ (Delta Species)
 *   Mew Star (Delta Species) - 2008 (Dylan Lefavour)
 *                                                  → Mew ★ (Delta Species) - ...
 */
const STAR_MARKER = / Star(?= \(|$)/;

/**
 * Prism Star is a different subset with a different symbol (◇), and its cards
 * end in " Star" too. Renaming those would be wrong twice over.
 */
const NOT_GOLD_STAR = /prism star/i;

export const isGoldStar = (name) =>
  typeof name === "string" && STAR_MARKER.test(name) && !NOT_GOLD_STAR.test(name);

export const goldStarName = (name) =>
  isGoldStar(name) ? name.replace(STAR_MARKER, ` ${GOLD_STAR_SYMBOL}`) : name;

/**
 * Apply to a row on its way into the catalogue.
 *
 * Returns the row unchanged when it is not a Gold Star, so it is safe to call
 * on everything. The original rarity is dropped on purpose: Ultra Rare and
 * Shiny Rare are what TCGPlayer files these under, but they describe the slot,
 * not the card, and thirteen of them carry no rarity at all — which is what
 * made the subset unsearchable in the first place.
 */
export const applyGoldStar = (row) => {
  if (!isGoldStar(row?.name)) return row;
  return { ...row, name: goldStarName(row.name), rarity: GOLD_STAR_RARITY };
};

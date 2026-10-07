// Recognising a card number in something a person typed.
//
// Numbers in the catalogue take several shapes, all real:
//
//   065/202     the common one — printed number over set size
//   GG61/GG70   Galarian Gallery, and TG.. for Trainer Gallery
//   SWSH020     promo series, no slash
//   227/S-P     Japanese promo
//   null        plenty of promos have none at all
//
// So "pikachu 012", "pikachu gg44" and "pikachu tg05" are all a name plus a
// number, and none of them worked: the query went to the catalogue as a NAME,
// and no card is called "pikachu 012".
//
// Deliberately prefix matching. Someone typing 012 wants 012/202 without
// knowing the set size, and someone typing gg44 wants GG44/GG70.

/**
 * Prefixes that appear before the digits in a real card number.
 *
 * Kept explicit rather than "any letters": a bare word like "ex" or "holo" is
 * part of a card's name or its finish, and treating those as numbers would
 * strip them out of the search that needs them.
 */
export const NUMBER_PREFIXES = [
  "gg", // Galarian Gallery
  "tg", // Trainer Gallery
  "sv", // Scarlet & Violet promos, and SV### black-star
  "swsh", // Sword & Shield promos
  "sm", // Sun & Moon promos
  "xy", // XY promos
  "bw", // Black & White promos
  "hgss", // HeartGold SoulSilver promos
  "dp", // Diamond & Pearl promos
  "rc", // Radiant Collection
  "gt", // Gold Trainer / misc subsets
];

const PREFIXED = new RegExp(`^(${NUMBER_PREFIXES.join("|")})\\d{1,4}$`, "i");

/**
 * Does this token look like a card number rather than part of a name?
 *
 * Pure digits, or one of the known prefixes followed by digits. "151" is the
 * awkward case — it is both a set name and a plausible number — and it is
 * treated as a number here; the caller searches both, so a set match still
 * comes back.
 */
export const looksLikeCardNumber = (token: string): boolean => {
  const t = token.trim();
  if (!t) return false;
  if (/^\d{1,4}$/.test(t)) return true;
  if (PREFIXED.test(t)) return true;
  // "065/202" — someone pasting the whole thing.
  if (/^[a-z]{0,4}\d{1,4}\/[a-z]{0,4}\d{1,4}$/i.test(t)) return true;
  return false;
};

/**
 * The forms a typed number might be stored as.
 *
 * "12" is printed as 012 on a modern card, so the zero-padded variants are
 * tried too — otherwise searching the number you can see on the card fails
 * whenever it is under 100.
 */
export const numberCandidates = (token: string): string[] => {
  const t = token.trim();
  if (!t) return [];
  const out = new Set<string>([t]);
  if (/^\d{1,3}$/.test(t)) {
    out.add(t.padStart(2, "0"));
    out.add(t.padStart(3, "0"));
    // And the other direction: someone types 012, the card is stored as 12.
    out.add(String(Number(t)));
  }
  return [...out];
};

export interface NumberSplit {
  /** The query with the number token removed. */
  name: string;
  /** The number token, or null. */
  number: string | null;
}

/**
 * Pull a card number out of a query.
 *
 * Scans from the END, because the number follows the name — "pikachu 012",
 * never "012 pikachu". A single-token query that is only a number is left
 * alone as a number search with no name.
 */
export const splitCardNumber = (input: string): NumberSplit => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { name: "", number: null };

  const last = tokens[tokens.length - 1]!;
  if (!looksLikeCardNumber(last)) return { name: input.trim(), number: null };

  return { name: tokens.slice(0, -1).join(" "), number: last };
};

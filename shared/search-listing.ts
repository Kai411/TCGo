// Matching a typed query against a marketplace listing.
//
// The navbar search used to test the whole query as ONE substring of
// "name set seller", so anything that mixed fields — "charizard obf sir",
// "pikachu 199", "umbreon psa 10" — found nothing, and so did a name typed
// without its punctuation ("mr mime") or with a typo ("charzard").
//
// Listings carry more than the catalogue does: condition, grading, variant,
// edition and the illustrator are all on the listing. So here every word of
// the query has to be found SOMEWHERE on the listing, each by whichever
// field it reads as:
//
//   name / set / seller / title / tags   plain text, punctuation-insensitive
//   set                                  its code or initials ("obf", "tg")
//   number                               "199" finds 199/165, "12" finds 012
//   rarity                               "sir", "ir", "hr", "gold", "chr"
//   language                             "jp", "english"
//   grading                              "psa", "10", "psa10", "bgs"
//   variant / edition / artist           "reverse", "1st", "arita"
//
// Pure, so it is tested without a running app.

import { compact, editDistance, fold } from "~/shared/search-name";
import {
  COLLOQUIAL_RARITIES,
  LANGUAGE_WORDS,
  matchRarity,
  rarityAliases,
  setAliases,
} from "~/shared/search-query";

export interface ListingSearchFields {
  name: string;
  set?: string | null;
  number?: string | null;
  rarity?: string | null;
  language?: string | null;
  seller?: string | null;
  title?: string | null;
  condition?: string | null;
  gradingProvider?: string | null;
  grade?: string | null;
  variant?: string | null;
  edition?: string | null;
  artist?: string | null;
  tags?: string[] | null;
}

/** Lowercase words, punctuation and accents removed: "Mr. Mime" → "mr mime". */
const words = (s: string): string =>
  fold(s).replace(/[^a-z0-9]+/g, " ").trim();

/** Does a typed number name this printed number? "12" ↔ "012/202". */
const numberMatches = (token: string, printed: string): boolean => {
  const t = token.toLowerCase().replace(/^#/, "");
  const p = printed.trim().toLowerCase();
  if (!t || !p) return false;
  if (p === t) return true;
  const head = p.split("/")[0]!;
  if (head === t) return true;
  // Same digits, different padding, same letter prefix ("tg5" ↔ "TG05").
  const a = /^([a-z]*)(\d+)$/.exec(t);
  const b = /^([a-z]*)(\d+)$/.exec(head);
  return !!a && !!b && a[1] === b[1] && Number(a[2]) === Number(b[2]);
};

const rarityMatches = (token: string, rarity: string): boolean => {
  const r = rarity.trim().toLowerCase();
  if (!r) return false;
  if (rarityAliases(rarity).includes(token)) return true;
  const named = matchRarity(token) ?? COLLOQUIAL_RARITIES[token];
  return !!named && named.toLowerCase() === r;
};

/**
 * Does every word of the query find a home on this listing?
 *
 * An empty query matches everything. Word order does not matter here — a
 * listing is a handful of short fields, not a catalogue of 60k names, so
 * "ex charizard" finding "Charizard ex" is help, not noise.
 */
export const listingMatches = (
  listing: ListingSearchFields,
  query: string,
): boolean => {
  const tokens = words(query.replace(/(^|\s)#(?=\w)/g, "$1"))
    .split(" ")
    .filter(Boolean);
  if (!tokens.length) return true;

  const text = words(
    [
      listing.name,
      listing.set,
      listing.number,
      listing.rarity,
      listing.seller,
      listing.title,
      listing.condition,
      listing.gradingProvider,
      listing.grade,
      listing.variant,
      listing.edition,
      listing.artist,
      ...(listing.tags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
  const padded = ` ${text} `;
  const squashed = compact(text);
  const textWords = text.split(" ");
  const setCodes = listing.set ? setAliases(listing.set) : [];

  // Words that only mean something together ("mr mime" → "mrmime") are
  // checked as a pair first, so "mr" alone need not appear anywhere.
  const fits = (t: string): boolean => {
    if (padded.includes(` ${t}`)) return true; // the start of a word
    if (t.length >= 4 && squashed.includes(t)) return true; // "farfetchd", "psa10"
    // A possessive typed without its apostrophe: "lillies" for "Lillie's".
    if (t.length >= 4 && t.endsWith("s") && padded.includes(` ${t.slice(0, -1)} s `)) {
      return true;
    }
    if (listing.number && numberMatches(t, listing.number)) return true;
    if (listing.rarity && rarityMatches(t, listing.rarity)) return true;
    if (setCodes.includes(t)) return true;
    const lang = LANGUAGE_WORDS[t];
    if (lang && (listing.language ?? "EN").toUpperCase() === lang) return true;
    // One typo in a long word: "charzard", "umbeon".
    if (t.length >= 5 && !/\d/.test(t)) {
      return textWords.some((w) => w.length >= 4 && editDistance(t, w, 1) <= 1);
    }
    return false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (fits(t)) continue;
    const pair = i + 1 < tokens.length ? t + tokens[i + 1] : null;
    if (pair && squashed.includes(pair)) {
      i += 1;
      continue;
    }
    return false;
  }
  return true;
};

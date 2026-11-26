// Matching the NAME part of a search against how cards are actually named.
//
// The catalogue's names carry punctuation and accents that nobody types:
// "Mr. Mime", "Farfetch'd", "Ho-Oh", "Flabébé", "Type: Null", "Lillie's
// Clefairy ex", "Boss's Orders". The search used to send what was typed as a
// plain substring — `name ILIKE '%mr mime%'` — and every one of those came
// back empty.
//
// Two jobs live here, both pure so they can be tested without a database:
//
//   nameSearchPattern     what was typed → an ILIKE pattern that tolerates
//                         the punctuation, accents and apostrophes it lacks.
//   suggestNameCorrection a misspelt Pokémon name → the real one, for a
//                         "showing results for…" retry when nothing matched.

import { POKEMON_NAMES } from "~/shared/pokemon-names";

/** Lowercase, with accents taken off: "Flabébé" → "flabebe". */
export const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Letters and digits only: "Mr. Mime" → "mrmime". */
export const compact = (s: string): string => fold(s).replace(/[^a-z0-9]/g, "");

/**
 * A species name as an ILIKE pattern.
 *
 * Accented letters become `_` (any one character), so the pattern finds the
 * card whether the catalogue spells it "Flabébé" or "Flabebe". Punctuation and
 * spaces become `%`, so "Mr. Mime", "Mr Mime" and "Mr.Mime" all match. Gender
 * signs are dropped — "Nidoran" should find both.
 */
const speciesPattern = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[♀♂]/g, "")
    .replace(/[^\x00-\x7f]/g, "_")
    .replace(/[^a-z0-9_]+/g, "%")
    .replace(/^%+|%+$/g, "");

/**
 * The species whose names are not just letters, keyed by how they are typed
 * without punctuation: "mrmime" → "mr%mime", "flabebe" → "flab_b_".
 *
 * Built once from the species list, so a new awkward name is handled the day
 * it is added there.
 */
const SPECIAL_NAMES: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const name of POKEMON_NAMES) {
    const key = compact(name);
    const pattern = speciesPattern(name);
    if (key && pattern !== key) m.set(key, pattern);
  }
  // Not a species, but on a great many trainer cards: "Pokémon Catcher",
  // "Pokémon Center Lady", "Pokémon Communication".
  m.set("pokemon", "pok_mon");
  return m;
})();

/**
 * One typed word as a pattern fragment.
 *
 * A Latin letter with an accent becomes `_`, for the same reason as above.
 * Anything else not plain ASCII is left alone — a query typed in another
 * script must not turn into a row of wildcards that matches everything.
 *
 * A word ending in "s" may be a possessive typed without its apostrophe:
 * "rockets" for "Rocket's", "boss" for "Boss's". `%` can match nothing, so
 * "rocket%s" still finds "Rockets" and "Landoru%s" still finds "Landorus" —
 * it only ever widens the match.
 */
const wordPattern = (word: string): string => {
  let out = "";
  for (const ch of word) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/^[a-z]$/.test(fold(ch))) out += "_";
    else out += ch;
  }
  if (out.length >= 4 && /[a-z]s$/.test(out)) out = `${out.slice(0, -1)}%s`;
  return out;
};

/**
 * What was typed as a name, as a pattern for `name ILIKE '%' || p || '%'`.
 *
 *   "mr mime"            → "mr%mime"            finds "Mr. Mime"
 *   "farfetchd"          → "farfetch%d"         finds "Farfetch'd"
 *   "ho oh"              → "ho%oh"              finds "Ho-Oh"
 *   "flabebe"            → "flab_b_"            finds "Flabébé"
 *   "lillies clefairy"   → "lillie%s%clefairy"  finds "Lillie's Clefairy ex"
 *   "mega charizard ex"  → "mega%charizard%ex"  finds "Mega Charizard X ex"
 *
 * Words are joined by `%`, so words the card has in between ("X") or
 * punctuation the searcher left out never stop a match. Word ORDER still
 * matters; that keeps "ex charizard" from matching every card with an "ex"
 * and a "charizard" anywhere in it.
 *
 * The pattern can never contain a `%` or `_` the searcher typed: those are
 * split out with the rest of the punctuation.
 */
export const nameSearchPattern = (name: string): string => {
  const words = name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const parts: string[] = [];
  for (let i = 0; i < words.length; ) {
    // The longest run of up to three words that spells an awkward species:
    // "mr mime", "mime jr", "type null", "chi yu", "farfetch d".
    let matched = false;
    for (let len = Math.min(3, words.length - i); len >= 1; len--) {
      const key = compact(words.slice(i, i + len).join(""));
      const pattern = SPECIAL_NAMES.get(key);
      if (pattern) {
        parts.push(pattern);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      parts.push(wordPattern(words[i]!));
      i += 1;
    }
  }
  return parts.join("%");
};

// ── Typo tolerance ─────────────────────────────────────────────────────

/** Every species, as typed without punctuation, mapped to its real name. */
const SPECIES_BY_KEY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const name of POKEMON_NAMES) {
    const key = compact(name);
    if (key && !m.has(key)) m.set(key, name);
  }
  return m;
})();
const SPECIES_KEYS = [...SPECIES_BY_KEY.keys()];

/**
 * Edit distance with adjacent swaps counted as one edit ("pikahcu"), giving up
 * as soon as it must exceed `max` — most of the 1025 comparisons stop after a
 * row or two.
 */
export const editDistance = (a: string, b: string, max = Infinity): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length]![b.length]!;
};

/**
 * The query with any misspelt Pokémon name corrected, or null if there is
 * nothing to correct.
 *
 *   "charzard ex"  → "Charizard ex"
 *   "pikahcu"      → "Pikachu"
 *   "gengar"       → null (already right)
 *
 * Only a fallback: the caller runs this when the search as typed found
 * nothing, and says what it searched instead. A word is left alone when it is
 * short (too many names are a letter apart), contains a digit, or already
 * appears inside a real name. A word that is equally close to two names is
 * left alone rather than guessed.
 */
export const suggestNameCorrection = (name: string): string | null => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = words.map((word) => {
    const w = compact(word);
    if (w.length < 4 || /\d/.test(w)) return word;
    if (SPECIES_KEYS.some((k) => k.includes(w))) return word;
    const max = w.length <= 5 ? 1 : 2;
    let best: string | null = null;
    let bestD = max + 1;
    let tied = false;
    for (const key of SPECIES_KEYS) {
      const d = editDistance(w, key, max);
      if (d < bestD) {
        best = key;
        bestD = d;
        tied = false;
      } else if (d === bestD && d <= max) {
        tied = true;
      }
    }
    if (!best || bestD > max || tied) return word;
    changed = true;
    return SPECIES_BY_KEY.get(best)!;
  });
  return changed ? out.join(" ") : null;
};

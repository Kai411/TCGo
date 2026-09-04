// Reading what someone typed into a search box.
//
// Pure string work, deliberately kept out of the composable: it needs no
// Supabase client and no Nuxt runtime, so it can be tested directly. The
// composable re-exports these, and both search surfaces call parseSearchQuery.

import { splitCardNumber } from "~/shared/card-number";

// ── Smart query parsing ───────────────────────────────────────────────
//
// Buyer-friendly natural input like:
//   "pikachu 151"           → name="pikachu", set hint="151"
//   "pikachu ir"            → name="pikachu", rarity="Illustration Rare"
//   "pikachu obsidian sir"  → name="pikachu", set hint="obsidian",
//                              rarity="Special Illustration Rare"
//
// Strategy: the leftmost token(s) form the name; trailing tokens that
// match a known rarity abbreviation are lifted out; everything else
// becomes a free-text set hint (joined with spaces). Filters caught
// here override the user's explicit dropdown filters so smart-typing
// always wins — the UI surfaces what got parsed via chips.

// Order matters — multi-char keys are checked before single-char so
// "SIR" doesn't get consumed as "S" + "IR".
const RARITY_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/^sir$/i, "Special Illustration Rare"],
  [/^ir$/i, "Illustration Rare"],
  [/^sr$/i, "Secret Rare"],
  [/^ur$/i, "Ultra Rare"],
  [/^hr$/i, "Hyper Rare"],
  [/^dr$/i, "Double Rare"],
  [/^ar$/i, "Art Rare"],
  [/^rh$/i, "Reverse Holo"],
  [/^holo$/i, "Holo Rare"],
  [/^promo$/i, "Promo"],
  [/^ace$/i, "ACE SPEC Rare"],
];

const matchRarity = (token: string): string | null => {
  for (const [pattern, full] of RARITY_ABBREVIATIONS) {
    if (pattern.test(token)) return full;
  }
  return null;
};

/**
 * Lift the rarity abbreviation out, wherever it sits.
 *
 * It has to come off before anything else reads the string: "charizard
 * obsidian flames sir" ends in the rarity, so the set is not last until the
 * rarity is gone.
 */
export const stripRarity = (
  input: string,
): { rest: string; rarityHint: string | null } => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  let rarityHint: string | null = null;
  const kept = tokens.filter((t, i) => {
    // Never the first token — a card can be named "Promo", and a query of one
    // word is a name.
    if (i === 0) return true;
    const r = matchRarity(t);
    if (!r) return true;
    rarityHint = r;
    return false;
  });
  return { rest: kept.join(" "), rarityHint };
};

export interface ParsedQuery {
  name: string;
  setHint: string | null;
  rarityHint: string | null;
}

export const parseSmartQuery = (input: string): ParsedQuery => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { name: "", setHint: null, rarityHint: null };

  // First token is always part of the name. Walk forward consuming further
  // tokens into the name until we hit a "filter-looking" token (rarity
  // abbreviation or numeric-only set hint). After that, leftover tokens
  // populate the set hint.
  let nameParts: string[] = [tokens[0]];
  let rarityHint: string | null = null;
  const setParts: string[] = [];

  let nameClosed = false;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const rarity = matchRarity(token);
    if (rarity) {
      rarityHint = rarity;
      nameClosed = true;
      continue;
    }
    // Pure numeric token → likely a set hint ("151", "164" etc).
    if (/^\d+$/.test(token)) {
      setParts.push(token);
      nameClosed = true;
      continue;
    }
    if (!nameClosed) {
      // Could still be a multi-word card name ("charizard ex", "rayquaza vmax")
      // — only treat as set if we've already seen a filter token.
      nameParts.push(token);
    } else {
      setParts.push(token);
    }
  }

  return {
    name: nameParts.join(" "),
    setHint: setParts.length ? setParts.join(" ") : null,
    rarityHint,
  };
};

/**
 * Pull a known set name out of a query, if one is trailing.
 *
 * parseSmartQuery only recognises rarity abbreviations and numeric set hints
 * ("151"), so "pikachu surging sparks" stayed one long name — and the search
 * RPC matches `q` against the card NAME only (c.name ILIKE '%q%'), so it could
 * never match anything. This closes that gap by checking the tail of the query
 * against the sets that actually exist.
 *
 * Longest match wins: "Prismatic Evolutions" must beat "Evolutions" or a card
 * from the wrong set comes back. Matching is anchored to the END of the query
 * because English puts the set after the card — "pikachu surging sparks", not
 * "surging sparks pikachu".
 *
 * Pure and exported so it can be tested without a database.
 */
/**
 * Every way someone might type a set's name.
 *
 * Derived rather than curated, because there are 214 sets and a hand-written
 * list would go stale the next time one ships. Three forms, from the real
 * naming in this catalogue:
 *
 *   "SV08: Surging Sparks"  → the whole thing, "sv08", "surging sparks", "ss"
 *   "SWSH: Crown Zenith: Galarian Gallery"
 *                           → …, "swsh", "galarian gallery", "gg"
 *
 * Initials are what make "ssp"-style shorthand work at all — the official
 * three-letter codes (SSP, TWM, SFA) are not in the data, so "ss" is the best
 * that can be derived honestly. A curated code map could be layered on later
 * without changing anything here.
 */
/**
 * Everything a typed query means, in one place.
 *
 * The collection search and the seller's add-card picker were pulling this
 * apart differently — the picker learned about set names and card numbers and
 * the collection page did not, so "reshiram rc" worked in one and not the
 * other. Both call this now.
 *
 * Order matters. The set name comes off first because it can be several words
 * and would otherwise be read as part of the card's name; then the number,
 * which is always the last token; then parseSmartQuery for rarity and numeric
 * set hints in what remains.
 */
export interface ParsedSearch {
  name: string;
  setHint: string | null;
  rarityHint: string | null;
  numberMatch: string | null;
}

export const parseSearchQuery = (
  raw: string,
  setNames: string[] = [],
): ParsedSearch => {
  // Rarity first: it can sit at the end, and while it does, nothing else is
  // last. Then the set, then the number.
  const { rest, rarityHint } = stripRarity(raw);

  // The set is tried at full length before any number is taken off, because a
  // set name can itself end in digits — "SV: Scarlet & Violet 151". Stripping
  // those as a card number would leave a set nobody can match.
  let hit = splitKnownSet(rest, setNames);
  let number: string | null = null;
  if (!hit.setHint) {
    const split = splitCardNumber(rest);
    number = split.number;
    hit = splitKnownSet(split.name, setNames);
  }

  // Whatever is left: parseSmartQuery still picks up numeric set hints like
  // "151" that are not in the caller's set list.
  const parsed = parseSmartQuery(hit.name);
  return {
    name: parsed.name.trim(),
    setHint: hit.setHint ?? parsed.setHint,
    rarityHint: rarityHint ?? parsed.rarityHint,
    numberMatch: number,
  };
};

/**
 * The abbreviation printed on the card, which initials cannot produce.
 *
 * "Surging Sparks" is SSP, "Obsidian Flames" is OBF, "Paldea Evolved" is PAL
 * — none of them the first letters of the words. These are what collectors
 * actually type, so they have to be data. Keyed by the set name with its code
 * prefix removed, which is what setAliases has in hand.
 */
export const SET_CODES: Record<string, string> = {
  // Scarlet & Violet
  "scarlet & violet": "svi",
  "paldea evolved": "pal",
  "obsidian flames": "obf",
  "paradox rift": "par",
  "paldean fates": "paf",
  "temporal forces": "tef",
  "twilight masquerade": "twm",
  "shrouded fable": "sfa",
  "stellar crown": "scr",
  "surging sparks": "ssp",
  "prismatic evolutions": "pre",
  "journey together": "jtg",
  "destined rivals": "dri",
  "black bolt": "blk",
  "white flare": "wht",
  // Sword & Shield
  "sword & shield": "ssh",
  "rebel clash": "rcl",
  "darkness ablaze": "daa",
  "champion's path": "cpa",
  "vivid voltage": "viv",
  "shining fates": "shf",
  "battle styles": "bst",
  "chilling reign": "cre",
  "evolving skies": "evs",
  "celebrations": "cel",
  "fusion strike": "fst",
  "brilliant stars": "brs",
  "astral radiance": "asr",
  "pokemon go": "pgo",
  "lost origin": "lor",
  "silver tempest": "sit",
  "crown zenith": "crz",
  // Sun & Moon
  "sun & moon": "sum",
  "guardians rising": "gri",
  "burning shadows": "bus",
  "crimson invasion": "cin",
  "ultra prism": "upr",
  "forbidden light": "fli",
  "celestial storm": "ces",
  "lost thunder": "lot",
  "team up": "teu",
  "unbroken bonds": "unb",
  "unified minds": "unm",
  "hidden fates": "hif",
  "cosmic eclipse": "cec",
};

/**
 * Every short form of a set name, mapped to the phrase it stands for.
 *
 * The phrase matters as much as the alias. "rc" is Radiant Collection, and
 * TWO sets end that way — Legendary Treasures and Generations — so resolving
 * "rc" to one set name picks the wrong one half the time. Resolving it to
 * "Radiant Collection" matches both, which is what someone typing it meant.
 */
/** Words that never start a set's short name. */
const STOP_WORDS = new Set(["and", "&", "the", "of", "a", "de"]);

/**
 * Initials of a phrase, or null if they would not make a usable alias.
 *
 * Letters only, two minimum: a one-letter alias matches half the catalogue,
 * and "Battle Academy 2024" yielding "ba2" is an artefact of the year, not
 * something anyone types.
 */
const initialsOf = (words: string[]): string | null => {
  const ini = words.map((w) => w[0]).join("").toLowerCase();
  return /^[a-z]{2,}$/.test(ini) ? ini : null;
};

export const setAliasMap = (setName: string): Map<string, string> => {
  const m = new Map<string, string>();
  const full = setName.trim();
  if (!full) return m;
  m.set(full.toLowerCase(), full);

  // Everything before a colon is the code; everything after is the name.
  const parts = full.split(":").map((x) => x.trim()).filter(Boolean);
  const target = parts.length > 1 ? parts[parts.length - 1]! : full;
  if (parts.length > 1) {
    m.set(parts[0]!.toLowerCase(), parts[0]!); // "sv08", "swsh"
    m.set(target.toLowerCase(), target); // "surging sparks"
  }

  const code = SET_CODES[target.toLowerCase()];
  if (code) m.set(code, target);

  // Initials of the name, and of its last two words. The last two matter
  // because subsets are named after their parent: "Brilliant Stars Trainer
  // Gallery" gives "bstg", and nobody types that — they type "tg".
  //
  // Two letters minimum; a one-letter alias would match half the catalogue.
  // A set with a printed code does not also claim its initials. Rebel Clash
  // is RCL, and letting it answer to "rc" as well took Radiant Collection's
  // alias away from it — the collision that made "reshiram rc" find nothing.
  const words = target.split(/\s+/).filter(Boolean);
  const all = initialsOf(words);
  if (!code && all) m.set(all, target);
  // Only slice off a tail that reads as a name in its own right. "Diamond and
  // Pearl" ends in "and Pearl", whose initials are "ap" — an alias for a set
  // nobody calls that, competing with the ones people do type.
  if (words.length > 2 && !STOP_WORDS.has(words[words.length - 2]!.toLowerCase())) {
    const lastTwo = words.slice(-2);
    const ini = initialsOf(lastTwo);
    if (ini) m.set(ini, lastTwo.join(" "));
  }
  return m;
};

export const setAliases = (setName: string): string[] => [
  ...setAliasMap(setName).keys(),
];

export const splitKnownSet = (
  input: string,
  setNames: string[],
): { name: string; setHint: string | null } => {
  const raw = input.trim();
  if (!raw || !setNames.length) return { name: raw, setHint: null };

  const lower = raw.toLowerCase();
  let best: string | null = null;

  for (const set of setNames) {
    const s = set.trim().toLowerCase();
    if (!s) continue;
    // Set names in this catalogue carry their code: "SV08: Surging Sparks",
    // "SWSH: Crown Zenith: Galarian Gallery". People type the code, the name,
    // or an abbreviation of the name — all three are matched, longest wins.
    for (const alias of setAliases(set)) {
      if (lower === alias || lower.endsWith(" " + alias)) {
        if (!best || alias.length > best.length) best = alias;
      }
    }
    // Trailing, on a word boundary — so "ex" inside "Charizard ex" is never
    // mistaken for a set whose name happens to end the same way.
    if (lower === s || lower.endsWith(" " + s)) {
      if (!best || s.length > best.length) best = s;
    }
  }
  if (!best) return { name: raw, setHint: null };

  const name = lower === best ? "" : raw.slice(0, raw.length - best.length).trim();

  // An alias shared by several sets resolves to the phrase behind it, not to
  // whichever set happened to be listed first. setHint is used as a substring
  // match, so "Radiant Collection" finds both sets that end that way and
  // "Trainer Gallery" finds all four.
  const matching = setNames.filter((n) => setAliasMap(n).has(best!));
  if (matching.length > 1) {
    const phrases = new Set(
      matching.map((n) => setAliasMap(n).get(best!)!.toLowerCase()),
    );
    if (phrases.size === 1) {
      return { name, setHint: setAliasMap(matching[0]!).get(best!)! };
    }
    // Sets that disagree about what the alias means. "bs" is Base Set, Battle
    // Stadium and Burning Shadows; picking one silently filters the results to
    // a set the searcher did not ask for and shows them nothing. Leave the
    // token in the name instead.
    if (!setNames.some((n) => n.trim().toLowerCase() === best)) {
      return { name: raw, setHint: null };
    }
  }

  // Recover the set's real casing for display and for the RPC's substring match.
  const canonical =
    setNames.find((n) => n.trim().toLowerCase() === best) ??
    matching[0] ??
    best;
  return { name, setHint: canonical };
};

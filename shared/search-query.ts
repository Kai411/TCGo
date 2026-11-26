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
 * Colloquial names for a rarity, which are not abbreviations of anything.
 *
 * "Gold charizard" is what collectors say; the catalogue calls it Hyper Rare
 * and carries no colour or finish field of its own, so this is the mapping
 * between the two. Validated against the real rarity list before use, so a
 * name that stops existing stops being matched rather than filtering to
 * nothing.
 */
export const COLLOQUIAL_RARITIES: Record<string, string> = {
  gold: "Hyper Rare",
  rainbow: "Rainbow Rare",
  // Printed codes that are not the initials of the name. Character Rare
  // abbreviates to "cr" on paper and nobody types that — the card says CHR.
  chr: "Character Rare",
  // What applyPhrases rewrites "gold star" and a trailing "star" into. Not
  // "gs": that is also the initials of the set "Golden Sky, Silvery Ocean",
  // and the rewrite would filter to a set instead of a rarity.
  goldstar: "Gold Star",
};

/**
 * Short forms of a rarity, derived from its own name.
 *
 * "Mega Ultra Rare" gives "mur", "Special Illustration Rare" gives "sir" —
 * so a rarity that appears in a new set is typeable the day it lands, with
 * nothing to maintain here.
 */
export const rarityAliases = (rarity: string): string[] => {
  const full = rarity.trim().toLowerCase();
  if (!full) return [];
  const out = new Set<string>([full]);
  const ini = full
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
  if (/^[a-z]{2,}$/.test(ini)) out.add(ini);
  return [...out];
};

/**
 * What rarity a single token means, if any.
 *
 * Three sources, in order of authority:
 *
 *  1. The explicit table. It carries forms initials cannot produce, and it
 *     settles collisions — "hr" is Hyper Rare, though Holo Rare abbreviates
 *     the same way.
 *  2. Colloquial names, for the words people actually say.
 *  3. Initials derived from the catalogue's own rarity names.
 *
 * Every source is checked against the real rarity list when one is supplied.
 * The table used to map "ar" to Art Rare and "rh" to Reverse Holo, neither of
 * which exists here — those searched for a rarity no card has and quietly
 * returned nothing. A name that fails validation falls through to the next
 * source, and finally stays part of the card's name.
 */
const rarityFromToken = (token: string, rarityNames: string[]): string[] => {
  const t = token.trim().toLowerCase();
  if (!t) return [];
  const known = (r: string) =>
    !rarityNames.length || rarityNames.some((n) => n.trim().toLowerCase() === r.toLowerCase());

  const explicit = matchRarity(t);
  if (explicit && known(explicit)) return [explicit];

  const colloquial = COLLOQUIAL_RARITIES[t];
  if (colloquial && known(colloquial)) return [colloquial];

  // Everything the abbreviation could mean.
  //
  // Across both languages the codes genuinely collide: "sr" is Super Rare in
  // Japan and Secret Rare in English, and Shiny Rare as well — 1179, 601 and
  // 418 cards. Picking the biggest would handto an English collector a pile of
  // Japanese cards, and dropping it entirely (what this used to do) shows them
  // nothing. So the search asks for all of them and lets the reader see which
  // is which.
  const hits = rarityNames.filter((r) => rarityAliases(r).includes(t));
  const seen = new Set<string>();
  return hits.filter((r) => {
    const k = r.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Lift the rarity out of a query, wherever it sits.
 *
 * It has to come off before anything else reads the string: "charizard
 * obsidian flames sir" ends in the rarity, so the set is not last until the
 * rarity is gone.
 */
export const stripRarity = (
  input: string,
  rarityNames: string[] = [],
): { rest: string; rarityMatches: string[] } => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  let rarityMatches: string[] = [];
  const kept = tokens.filter((t, i) => {
    // Never the first token — a card can be named "Promo", and a query of one
    // word is a name.
    if (i === 0) return true;
    if (rarityMatches.length) return true; // Only the first rarity found.
    const r = rarityFromToken(t, rarityNames);
    if (!r.length) return true;
    rarityMatches = r;
    return false;
  });
  return { rest: kept.join(" "), rarityMatches };
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
// ── Qualifiers: language, grading, finish ─────────────────────────────
//
// Words that describe the copy someone wants rather than the card. None of
// them is part of a card's name, so left in they made the name match fail:
// "charizard jp" looked for a card called that, and "charizard psa 10" was
// worse — the 10 was read as a card number. Lifting them out first lets the
// rest of the parser see only the card.

/** Words that pick a catalogue language. */
const LANGUAGE_WORDS: Record<string, "EN" | "JP"> = {
  jp: "JP",
  jpn: "JP",
  jap: "JP",
  japanese: "JP",
  en: "EN",
  eng: "EN",
  english: "EN",
};

/**
 * Grading companies.
 *
 * "tag" and "ace" are graders too, but also words in card names ("Tag Team")
 * and a rarity ("ace" is ACE SPEC). Those two only count with a grade after
 * them — "tag 10" — never on their own.
 */
const GRADERS = ["psa", "bgs", "cgc", "sgc", "beckett", "tag", "ace"];
const GRADER_NEEDS_NUMBER = new Set(["tag", "ace"]);
const GRADE_NUMBER = /^(10|[1-9])(\.5)?$/;
const GRADER_GLUED = new RegExp(`^(${GRADERS.join("|")})(10|[1-9])(\\.5)?$`, "i");

export interface GradeHint {
  /** Upper-cased company, "PSA" / "BGS" / ... */
  company: string;
  /** "10", "9.5", or null when only the company was typed. */
  grade: string | null;
}

/**
 * Finish phrases, as TCGPlayer names the price sub-type they correspond to.
 *
 * The catalogue has one row per card, not per finish — the finish lives in
 * the price, not the name — so these are not filters. They are lifted out so
 * the name still matches, and handed back so the page can show the right
 * price. Longest first, so "reverse holo" is taken before "holo" could be.
 */
const VARIANT_PHRASES: Array<[string[], string]> = [
  [["1st", "edition", "holo"], "1st Edition Holofoil"],
  [["first", "edition", "holo"], "1st Edition Holofoil"],
  [["reverse", "holo"], "Reverse Holofoil"],
  [["rev", "holo"], "Reverse Holofoil"],
  [["1st", "edition"], "1st Edition"],
  [["first", "edition"], "1st Edition"],
  [["1st", "ed"], "1st Edition"],
  [["non", "holo"], "Normal"],
  [["reverse"], "Reverse Holofoil"],
  [["rh"], "Reverse Holofoil"],
  [["nonholo"], "Normal"],
  [["unlimited"], "Unlimited"],
];

export interface Qualifiers {
  /** The query with every qualifier removed. */
  rest: string;
  language: "EN" | "JP" | null;
  grade: GradeHint | null;
  /** A TCGPlayer price sub-type: "Reverse Holofoil", "1st Edition", ... */
  variant: string | null;
}

/**
 * Lift language, grading and finish words out of a query.
 *
 * None of them may take the whole query: something has to be left to search
 * for, so "english" alone stays a name search.
 */
export const extractQualifiers = (input: string): Qualifiers => {
  let tokens = input.trim().split(/\s+/).filter(Boolean);
  let language: Qualifiers["language"] = null;
  let grade: GradeHint | null = null;
  let variant: string | null = null;

  // Grading: "psa 10", "bgs 9.5", "psa10", "cgc". Taken before anything reads
  // a bare number as a card number.
  for (let i = 0; i < tokens.length && !grade; i++) {
    const t = tokens[i]!.toLowerCase();
    const glued = GRADER_GLUED.exec(t);
    if (glued) {
      grade = { company: glued[1]!.toUpperCase(), grade: glued[2]! + (glued[3] ?? "") };
      tokens.splice(i, 1);
      break;
    }
    if (!GRADERS.includes(t)) continue;
    const next = tokens[i + 1];
    if (next && GRADE_NUMBER.test(next)) {
      grade = { company: t.toUpperCase(), grade: next };
      tokens.splice(i, 2);
    } else if (!GRADER_NEEDS_NUMBER.has(t) && tokens.length > 1) {
      grade = { company: t.toUpperCase(), grade: null };
      tokens.splice(i, 1);
    }
  }

  // Finish: the longest phrase found anywhere after the first word.
  outer: for (const [phrase, subtype] of VARIANT_PHRASES) {
    for (let i = 1; i + phrase.length <= tokens.length; i++) {
      const hit = phrase.every((w, j) => tokens[i + j]!.toLowerCase() === w);
      if (!hit) continue;
      variant = subtype;
      tokens.splice(i, phrase.length);
      break outer;
    }
  }

  // Language: anywhere, as long as something is left.
  if (tokens.length > 1) {
    const i = tokens.findIndex((t) => LANGUAGE_WORDS[t.toLowerCase()]);
    if (i !== -1) {
      language = LANGUAGE_WORDS[tokens[i]!.toLowerCase()]!;
      tokens = tokens.filter((_, j) => j !== i);
    }
  }

  return { rest: tokens.join(" "), language, grade, variant };
};

/**
 * Rarity names as the catalogue files them, for when the caller has not
 * loaded the real list. Only used to recognise a rarity typed out in full;
 * the abbreviation logic keeps its own rules.
 */
export const KNOWN_RARITIES = [
  "Common", "Uncommon", "Rare", "Holo Rare", "Double Rare", "Ultra Rare",
  "Hyper Rare", "Secret Rare", "Illustration Rare", "Special Illustration Rare",
  "Amazing Rare", "Radiant Rare", "Rainbow Rare", "Shiny Rare",
  "Shiny Ultra Rare", "Mega Ultra Rare", "Mega Hyper Rare", "Mega Attack Rare",
  "ACE SPEC Rare", "Promo", "Art Rare", "Special Art Rare", "Super Rare",
  "Character Rare", "Character Super Rare", "ACE Rare", "Gold Star", "Prism Rare",
  "Black White Rare",
];

/**
 * How collectors say a rarity in more than one word, when that is not the
 * rarity's own name.
 */
const RARITY_PHRASES: Record<string, string> = {
  "ace spec": "ACE SPEC Rare",
  "special art": "Special Art Rare",
  "special illustration": "Special Illustration Rare",
  "secret": "Secret Rare",
};

/**
 * Take a rarity typed out in words — "hyper rare", "special illustration
 * rare", "ace spec" — off the query.
 *
 * The token reader below sees one word at a time, so "charizard hyper rare"
 * used to keep "charizard hyper" as the name and read "rare" as the rarity
 * Rare: no card matched both. This runs first and takes the longest phrase.
 *
 * When the phrase is the whole query it is a browse — "hyper rare" means
 * every Hyper Rare — so the name comes back empty.
 */
export const stripRarityPhrase = (
  input: string,
  rarityNames: string[] = [],
): { rest: string; rarityMatches: string[] } => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const lower = tokens.map((t) => t.toLowerCase());
  const names = rarityNames.length ? rarityNames : KNOWN_RARITIES;
  const known = (r: string) =>
    names.some((n) => n.trim().toLowerCase() === r.toLowerCase());

  const candidates: Array<[string[], string]> = [
    ...names
      .map((n) => n.trim())
      .filter((n) => n.split(/\s+/).length > 1)
      .map((n): [string[], string] => [n.toLowerCase().split(/\s+/), n]),
    ...Object.entries(RARITY_PHRASES)
      .filter(([, r]) => known(r))
      .map(([p, r]): [string[], string] => [p.split(" "), r]),
  ].sort((a, b) => b[0].length - a[0].length);

  for (const [words, rarity] of candidates) {
    // A one-word phrase ("secret") never takes the first word: that is a
    // name, as in stripRarity.
    const from = words.length > 1 ? 0 : 1;
    for (let i = from; i + words.length <= lower.length; i++) {
      if (!words.every((w, j) => lower[i + j] === w)) continue;
      const rest = [...tokens.slice(0, i), ...tokens.slice(i + words.length)].join(" ");
      return { rest, rarityMatches: [rarity] };
    }
  }
  return { rest: tokens.join(" "), rarityMatches: [] };
};

/**
 * A set code typed before the card, as it reads on a binder page or a
 * price list: "ssp 238", "sv08 pikachu", "pfl mega charizard x ex".
 *
 * Trailing sets are handled by splitKnownSet. Leading ones are taken only
 * when they are unmistakably codes — a printed code from SET_CODES, or a
 * code with digits in it like "sv08" or "sm11b" — because a leading WORD is
 * almost always the card's name: "Arceus", "Jungle" and "Charizard" are all
 * set names too.
 */
export const splitLeadingSetCode = (
  input: string,
  setNames: string[],
): { name: string; setHint: string | null } => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || !setNames.length) return { name: input.trim(), setHint: null };
  const first = tokens[0]!.toLowerCase();
  const printed = Object.values(SET_CODES).includes(first);
  const withDigits = /^[a-z]{1,5}\d{1,3}[a-z]?$/.test(first) && !/^\d+$/.test(first);
  if (!printed && !withDigits) return { name: input.trim(), setHint: null };
  const hit = splitKnownSet(first, setNames);
  if (!hit.setHint || hit.name) return { name: input.trim(), setHint: null };
  return { name: tokens.slice(1).join(" "), setHint: hit.setHint };
};

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
  /** Every rarity the typed code could mean; ORed by the caller. */
  rarityMatches: string[];
  /** The first match, for chips and labels. */
  rarityHint: string | null;
  numberMatch: string | null;
  /**
   * setHint and numberMatch are ALTERNATIVES, not filters to combine.
   *
   * Set when the trailing token reads both ways — "pikachu 151" is a Pikachu
   * in the 151 set and also a Pikachu numbered 151, and both exist. Combining
   * them finds neither, so the caller must OR them.
   */
  setOrNumber: boolean;
  /** "jp" / "english" in the query. Overrides the language dropdown. */
  language: "EN" | "JP" | null;
  /**
   * "psa 10", "bgs 9.5". The catalogue has no grades, so this is not a
   * filter there; it is lifted out so it is not read as a card number, and
   * kept for a listing search that does know grades.
   */
  grade: GradeHint | null;
  /** "reverse holo", "1st edition": the price sub-type someone wants. */
  variant: string | null;
}

/**
 * Is this number also the name of a set?
 *
 * Only as a trailing word, and only two digits or more: "POP Series 5" would
 * otherwise make every single-digit number a set search.
 */
const numberNamesASet = (number: string, setNames: string[]): boolean => {
  if (!/^\d{2,}$/.test(number)) return false;
  const pattern = new RegExp(`(^|\\s)${number}$`);
  return setNames.some((n) => pattern.test(n.trim()));
};

/**
 * Collector phrases rewritten to what the catalogue is filed under.
 *
 * Gold Star cards are stored as "Rayquaza ★" with the rarity "Gold Star", so
 * the search that works is a name plus a rarity. Rewriting the phrase into a
 * single token that names that rarity lets the ordinary rarity machinery do
 * the rest, with no special case downstream.
 *
 * "star" on its own is rewritten too, because ★ cannot be typed and people
 * have always searched these as "rayquaza star". The one exception is Prism
 * Star, a different subset with a different symbol whose cards genuinely end
 * in the word — "tapu koko prism star" must stay a name.
 *
 * Token work rather than a regex: the rule is about the last word and the one
 * before it, which reads plainly here and does not in a lookbehind.
 */
export const applyPhrases = (input: string): string => {
  const t = input.trim().split(/\s+/).filter(Boolean);
  if (t.length < 2) return t.join(" ");

  const last = t[t.length - 1]!.toLowerCase();
  const prev = t[t.length - 2]!.toLowerCase();
  if (last !== "star") return t.join(" ");

  if (prev === "gold") return [...t.slice(0, -2), "goldstar"].join(" ");
  if (prev === "prism") return t.join(" ");
  return [...t.slice(0, -1), "goldstar"].join(" ");
};

export const parseSearchQuery = (
  raw: string,
  setNames: string[] = [],
  rarityNames: string[] = [],
): ParsedSearch => {
  // Language, grading and finish words describe the copy, not the card.
  // Off first, so "charizard psa 10" is not read as card number 10.
  const q = extractQualifiers(raw);
  const extra = { language: q.language, grade: q.grade, variant: q.variant };

  // Known collector phrases first, before any of it is read as a rarity.
  const phrased = applyPhrases(q.rest);

  // A phrase that collapsed to a single word IS the whole query, and it names
  // a category rather than a card: "gold star" on its own means every Gold
  // Star, not a card called "goldstar".
  //
  // Narrow on purpose. stripRarity never reads the first token as a rarity —
  // a one-word query is a name, and a card can be called "Promo" — and that
  // rule stands. This only lifts it where a MULTI-word phrase was rewritten
  // into one token, which is something the searcher cannot type by accident.
  const rawWords = q.rest.trim().split(/\s+/).filter(Boolean);
  const phrasedWords = phrased.split(/\s+/).filter(Boolean);
  if (rawWords.length > 1 && phrasedWords.length === 1) {
    const only = COLLOQUIAL_RARITIES[phrasedWords[0]!.toLowerCase()];
    const known =
      only && (!rarityNames.length ||
        rarityNames.some((n) => n.trim().toLowerCase() === only.toLowerCase()));
    if (only && known) {
      return {
        name: "",
        setHint: null,
        rarityMatches: [only],
        rarityHint: only,
        numberMatch: null,
        setOrNumber: false,
        ...extra,
      };
    }
  }

  // A rarity typed out in words — "hyper rare", "ace spec" — before the
  // one-word reader, which would take "rare" alone and leave "hyper" in the
  // name. On its own it is a browse of that rarity.
  const phrase = stripRarityPhrase(phrased, rarityNames);
  if (phrase.rarityMatches.length && !phrase.rest.trim()) {
    return {
      name: "",
      setHint: null,
      rarityMatches: phrase.rarityMatches,
      rarityHint: phrase.rarityMatches[0]!,
      numberMatch: null,
      setOrNumber: false,
      ...extra,
    };
  }

  // Rarity next: it can sit at the end, and while it does, nothing else is
  // last. Then the set, then the number.
  const { rest, rarityMatches } = phrase.rarityMatches.length
    ? phrase
    : stripRarity(phrased, rarityNames);

  // A set code in front — "ssp 238", "sv08 pikachu". Settles the set, so
  // only the number is left to find.
  const lead = splitLeadingSetCode(rest, setNames);

  // The set is tried at full length before any number is taken off, because a
  // set name can itself end in digits — "SV: Scarlet & Violet 151". Stripping
  // those as a card number would leave a set nobody can match.
  let hit = lead.setHint
    ? { name: lead.name, setHint: lead.setHint as string | null }
    : splitKnownSet(rest, setNames);
  let number: string | null = null;
  let setOrNumber = false;
  if (lead.setHint) {
    const split = splitCardNumber(lead.name);
    number = split.number;
    hit = { name: split.name, setHint: lead.setHint };
  } else if (!hit.setHint) {
    const split = splitCardNumber(rest);
    number = split.number;
    hit = splitKnownSet(split.name, setNames);

    // A token that reads as a number AND as a set. Both readings are real, so
    // keep both and let the caller ask for either.
    //
    // Two ways this happens. A set code that starts with a number prefix —
    // "xy3" is the XY3 set and XY17 is a real promo number, so the prefix list
    // claims it first and the set was never reached; likewise "dp1", "sm5",
    // "bw9". And a set named after a number — "pikachu 151" is a Pikachu in
    // the 151 set and a Pikachu numbered 151.
    if (number && !hit.setHint) {
      const asSet = splitKnownSet(number, setNames);
      if (asSet.setHint && !asSet.name.trim()) {
        hit = { name: split.name, setHint: asSet.setHint };
        setOrNumber = true;
      } else if (numberNamesASet(number, setNames)) {
        // The bare number as a substring, so it finds the English and the
        // Japanese 151 set alike.
        hit = { name: split.name, setHint: number };
        setOrNumber = true;
      }
    }
  }

  // Sets are named after Pokémon — "Arceus", "Jungle", "Pokemon TCG Classic:
  // Charizard" — so a set alias can swallow the card name whole. When a rarity
  // or number has already been lifted, the searcher clearly typed a name plus
  // a filter, and a set match that leaves nothing behind has eaten the name.
  // "charizard sir" is a Charizard, not the Charizard set with no card.
  // Not when the set came from the number itself: a bare "151" is a number
  // and a set at once, and resetting it here turned it into a name search
  // for cards called "151".
  if (
    (rarityMatches.length || number) &&
    hit.setHint &&
    !hit.name.trim() &&
    !setOrNumber &&
    !lead.setHint
  ) {
    hit = { name: rest.trim(), setHint: null };
    setOrNumber = false;
  }

  // Whatever is left: parseSmartQuery still picks up numeric set hints like
  // "151" that are not in the caller's set list.
  const parsed = parseSmartQuery(hit.name);
  const rarities = rarityMatches.length
    ? rarityMatches
    : rarityNames.length
      ? []
      : parsed.rarityHint
        ? [parsed.rarityHint]
        : [];
  return {
    name: parsed.name.trim(),
    setHint: hit.setHint ?? parsed.setHint,
    // parseSmartQuery runs its own rarity pass off the unvalidated table. Once
    // we have the catalogue's real rarity list, stripRarity above is the
    // authority — otherwise a name it deliberately rejected ("rh" is Reverse
    // Holo, a finish no card here is filed under) comes back in through the
    // side door and filters the results to nothing.
    rarityMatches: rarities,
    rarityHint: rarities[0] ?? null,
    numberMatch: number,
    setOrNumber,
    ...extra,
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
  // Mega Evolution
  "mega evolution": "meg",
  "phantasmal flames": "pfl",
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
  "shining legends": "slg",
  "dragon majesty": "drm",
  "detective pikachu": "det",
  // XY
  "xy": "xy",
  "flashfire": "flf",
  "furious fists": "ffi",
  "phantom forces": "phf",
  "primal clash": "prc",
  "roaring skies": "ros",
  "ancient origins": "aor",
  "breakthrough": "bkt",
  "breakpoint": "bkp",
  "generations": "gen",
  "fates collide": "fco",
  "steam siege": "sts",
  "evolutions": "evo",
  // Black & White
  "black & white": "blw",
  "emerging powers": "epo",
  "noble victories": "nvi",
  "next destinies": "nxd",
  "dark explorers": "dex",
  "dragons exalted": "drx",
  "dragon vault": "drv",
  "boundaries crossed": "bcr",
  "plasma storm": "pls",
  "plasma freeze": "plf",
  "plasma blast": "plb",
  "legendary treasures": "ltr",
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

  // A whole query swallowed by one bare word is almost always a card name.
  // Sets are named after Pokémon — "Arceus", "Jungle", "Pokemon TCG Classic:
  // Charizard" — so only a set CODE ("tg", "sm11b", "xy3") or a multi-word
  // name may consume the entire query. "charizard" on its own is a Charizard.
  const codeLike = /^[a-z]{1,4}\d{0,3}[a-z]?$/.test(best);
  if (!name && !codeLike && !best.includes(" ")) {
    return { name: raw, setHint: null };
  }

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

    // Sets that disagree about what the alias means. Across both languages
    // this is common — "tg" is Trainer Gallery on four sets and Time Gazer on
    // one, "rc" is Radiant Collection on two and Red Collection and Rebellion
    // Crash on one each. The reading with the most sets behind it is the one
    // people mean; a genuine tie is left in the name rather than guessed.
    const byPhrase = new Map<string, { phrase: string; count: number }>();
    for (const n of matching) {
      const phrase = setAliasMap(n).get(best!)!;
      const k = phrase.toLowerCase();
      const e = byPhrase.get(k) ?? { phrase, count: 0 };
      e.count += 1;
      byPhrase.set(k, e);
    }
    const ranked = [...byPhrase.values()].sort((a, b) => b.count - a.count);
    if (ranked.length > 1 && ranked[0]!.count > ranked[1]!.count) {
      return { name, setHint: ranked[0]!.phrase };
    }
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

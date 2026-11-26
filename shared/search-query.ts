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

export const matchRarity = (token: string): string | null => {
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
  /**
   * A language named in the query — "pikachu jp", "charizard english". The
   * caller uses it in place of its language dropdown, the same way a typed
   * set beats the set dropdown.
   */
  languageHint: "EN" | "JP" | null;
  /**
   * The finish asked for — reverse holo, 1st edition and so on. Not a card of
   * its own in the catalogue (TCGPlayer files it as a price subtype of the
   * same card), so it picks which price to show rather than filtering.
   */
  variant: CardVariant | null;
  /**
   * A grade typed with the card: "psa 10", "bgs 9.5", "graded", "raw". The
   * catalogue has no grades, so this mainly keeps "charizard psa 10" from
   * being read as card number 10. Surfaced for the UI and listing searches.
   */
  grade: GradeHint | null;
}

export type CardVariant =
  | "reverse-holo"
  | "holo"
  | "non-holo"
  | "1st-edition"
  | "unlimited";

/** TCGPlayer price subtypes for each variant, best first. */
export const VARIANT_SUBTYPES: Record<CardVariant, string[]> = {
  "reverse-holo": ["Reverse Holofoil"],
  holo: ["Holofoil", "Unlimited Holofoil", "1st Edition Holofoil"],
  "non-holo": ["Normal", "Unlimited", "1st Edition"],
  "1st-edition": ["1st Edition Holofoil", "1st Edition"],
  unlimited: ["Unlimited Holofoil", "Unlimited"],
};

export interface GradeHint {
  /** "PSA", "BGS", "CGC"… or null for a bare "graded". */
  company: string | null;
  /** "10", "9.5"… or null. */
  grade: string | null;
  /** True for "raw" / "ungraded". */
  raw: boolean;
}

/**
 * Finishes, as [phrase, meaning].
 *
 * Longest first, so "reverse holo" is taken whole before "holo" can be. Bare
 * "holo" is deliberately absent: on vintage cards "Holo Rare" is the rarity,
 * and that reading already works.
 */
const VARIANT_PHRASES: Array<[string, CardVariant]> = [
  ["reverse holofoil", "reverse-holo"],
  ["reverse holo", "reverse-holo"],
  ["rev holo", "reverse-holo"],
  ["reverse", "reverse-holo"],
  ["revholo", "reverse-holo"],
  ["rh", "reverse-holo"],
  ["non holo", "non-holo"],
  ["non-holo", "non-holo"],
  ["nonholo", "non-holo"],
  ["holofoil", "holo"],
  ["1st edition", "1st-edition"],
  ["first edition", "1st-edition"],
  ["1st ed", "1st-edition"],
  ["1st", "1st-edition"],
  ["unlimited", "unlimited"],
];

const GRADERS = ["psa", "bgs", "beckett", "cgc", "sgc", "tag", "ace", "ags"];

/**
 * Take what describes the copy out of a query: its finish and its grade.
 * The language is stripLanguage's job.
 *
 * Any position, because "psa 10 charizard" and "charizard psa 10" are both
 * natural. Never
 * the whole query, though — "unlimited" alone is better searched as a name
 * than as nothing.
 */
export const extractModifiers = (
  input: string,
): {
  rest: string;
  variant: CardVariant | null;
  grade: GradeHint | null;
} => {
  let tokens = input.trim().split(/\s+/).filter(Boolean);
  let variant: CardVariant | null = null;
  let grade: GradeHint | null = null;

  const lower = () => tokens.map((t) => t.toLowerCase());
  const remove = (start: number, len: number) => {
    tokens = [...tokens.slice(0, start), ...tokens.slice(start + len)];
  };
  // Remove a phrase only if something is left to search for.
  const take = (phrase: string): boolean => {
    const words = phrase.split(" ");
    const l = lower();
    for (let i = 0; i + words.length <= l.length; i++) {
      if (words.every((w, j) => l[i + j] === w)) {
        if (tokens.length - words.length < 1) return false;
        remove(i, words.length);
        return true;
      }
    }
    return false;
  };

  // Grade first: "psa 10" must lose its 10 before anything reads it as a
  // card number. "psa10" written as one word too.
  {
    const l = lower();
    for (let i = 0; i < l.length; i++) {
      const glued = l[i]!.match(/^(psa|bgs|cgc|sgc|tag|ags)(\d{1,2}(?:\.5)?)$/);
      if (glued && tokens.length > 1) {
        grade = { company: glued[1]!.toUpperCase(), grade: glued[2]!, raw: false };
        remove(i, 1);
        break;
      }
      if (GRADERS.includes(l[i]!)) {
        const next = l[i + 1];
        const hasNum = !!next && /^\d{1,2}(\.5)?$/.test(next) && Number(next) <= 10;
        // Some graders' names are words on cards too: "ace" is ACE SPEC, "tag"
        // is TAG TEAM. Those only count as a grade with a number after them.
        if (["ace", "tag", "ags"].includes(l[i]!) && !hasNum) continue;
        if (tokens.length - (hasNum ? 2 : 1) < 1) continue;
        grade = {
          company: l[i] === "beckett" ? "BGS" : l[i]!.toUpperCase(),
          grade: hasNum ? next! : null,
          raw: false,
        };
        remove(i, hasNum ? 2 : 1);
        break;
      }
    }
    if (!grade) {
      if (take("gem mint") || take("graded") || take("slab") || take("slabbed")) {
        grade = { company: null, grade: null, raw: false };
      } else if (take("ungraded") || take("raw")) {
        grade = { company: null, grade: null, raw: true };
      }
    }
  }

  for (const [phrase, v] of VARIANT_PHRASES) {
    if (take(phrase)) {
      variant = v;
      break;
    }
  }


  return { rest: tokens.join(" "), variant, grade };
};


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

/**
 * Tidy what was typed before reading it.
 *
 * "#4", "No. 4" and "4/102" are all the card number; curly apostrophes from a
 * phone keyboard should match the straight ones in "Team Rocket's"; and "alt
 * art" is how collectors say what TCGPlayer files as "(Alternate Art …)" in
 * the card's name.
 */
export const normalizeQuery = (raw: string): string =>
  raw
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/(^|\s)(?:no\.?\s*)?#\s*(?=[a-z]{0,4}\d)/gi, "$1")
    .replace(/\balt(?:ernate)?\s+art\b|\balt\b/gi, "alternate")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A full printed number ("199/165", "GG44/GG70", "4/102") anywhere in the
 * query. The trailing-number reader only looks at the last word; a number
 * with a slash cannot be anything else, so it is safe to lift from anywhere —
 * "199/165 charizard" works as well as "charizard 199/165".
 */
const takeSlashNumber = (input: string): { rest: string; number: string | null } => {
  const tokens = input.split(/\s+/).filter(Boolean);
  const i = tokens.findIndex((t) => /^[a-z]{0,4}\d{1,4}\/[a-z]{0,4}\d{1,4}$/i.test(t));
  if (i < 0 || i === tokens.length - 1) return { rest: input, number: null };
  const number = tokens[i]!;
  return { rest: [...tokens.slice(0, i), ...tokens.slice(i + 1)].join(" "), number };
};

export const parseSearchQuery = (
  raw: string,
  setNames: string[] = [],
  rarityNames: string[] = [],
): ParsedSearch => {
  // The language, and a "#" in front of a number, come off before anything
  // else reads the words.
  const { rest: unlanguaged, languageHint } = stripLanguage(normalizeQuery(raw));
  // Then what describes the copy rather than the card, so "psa 10" is never
  // read as card number 10 and "reverse holo" never as the Holo Rare rarity.
  const { rest: plain, variant, grade } = extractModifiers(unlanguaged);
  raw = plain.replace(/(^|\s)#(?=\w)/g, "$1");

  // Known collector phrases first, before any of it is read as a rarity.
  const phrased = applyPhrases(raw);

  // A phrase that collapsed to a single word IS the whole query, and it names
  // a category rather than a card: "gold star" on its own means every Gold
  // Star, not a card called "goldstar".
  //
  // Narrow on purpose. stripRarity never reads the first token as a rarity —
  // a one-word query is a name, and a card can be called "Promo" — and that
  // rule stands. This only lifts it where a MULTI-word phrase was rewritten
  // into one token, which is something the searcher cannot type by accident.
  const rawWords = raw.trim().split(/\s+/).filter(Boolean);
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
        languageHint,
        variant,
        grade,
      };
    }
  }

  // Rarity next: it can sit at the end, and while it does, nothing else is
  // last. Then the set, then the number.
  // A rarity written out in full ("pikachu illustration rare") is a phrase,
  // which the token pass below would never see as one.
  const byPhrase = stripRarityPhrase(phrased, rarityNames);
  const stripped = byPhrase.rarityMatches.length
    ? byPhrase
    : stripRarity(phrased, rarityNames);
  const { rarityMatches } = stripped;
  // A full printed number ("199/165") can sit anywhere; take it now, before
  // "199/165 charizard" ends in a word the Charizard set claims.
  const slash = takeSlashNumber(stripped.rest);
  const rest = slash.rest;

  // The set is tried at full length before any number is taken off, because a
  // set name can itself end in digits — "SV: Scarlet & Violet 151". Stripping
  // those as a card number would leave a set nobody can match.
  //
  // A set CODE or multi-word set name at the start is taken first: in "obf
  // charizard 125" the trailing "charizard" would otherwise end-match the set
  // named after Charizard, and Obsidian Flames would be read as the card name.
  const lead = splitLeadingSet(rest, setNames);
  let hit = lead.setHint ? lead : splitKnownSet(rest, setNames);
  let number: string | null = slash.number;
  let setOrNumber = false;
  if (lead.setHint) {
    // "sv08 pikachu 057": the set leads, and a number may still trail.
    const split = splitCardNumber(lead.name);
    if (split.number) {
      hit = { name: split.name, setHint: lead.setHint };
      number ??= split.number;
    }
  } else if (!hit.setHint && !number) {
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
    !lead.setHint &&
    hit.setHint &&
    !hit.name.trim() &&
    !setOrNumber
  ) {
    hit = { name: rest.trim(), setHint: null };
    setOrNumber = false;
  }

  // Nothing at the end named a set, so try the front: "ssp pikachu",
  // "sv08 pikachu 057", "surging sparks pikachu", "151 charizard". People
  // type the set first as often as last.
  if (!hit.setHint) {
    const lead = splitLeadingSet(hit.name, setNames);
    if (lead.setHint) hit = lead;
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
    languageHint,
    variant,
    grade,
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
  "ascended heroes": "asc",
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
  // XY
  "flashfire": "flf",
  "furious fists": "ffi",
  "phantom forces": "phf",
  "primal clash": "prc",
  "roaring skies": "ros",
  "ancient origins": "aor",
  "breakthrough": "bkt",
  "breakpoint": "bkp",
  "fates collide": "fco",
  "steam siege": "sts",
  "evolutions": "evo",
  // Black & White
  "emerging powers": "epo",
  "noble victories": "nvi",
  "next destinies": "nxd",
  "dark explorers": "dex",
  "dragons exalted": "drx",
  "boundaries crossed": "bcr",
  "plasma storm": "pls",
  "plasma freeze": "plf",
  "plasma blast": "plb",
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
  // TCGplayer writes some eras as "SM - Burning Shadows" rather than with a
  // colon; both are a code and a name.
  const parts = full.split(/:| - /).map((x) => x.trim()).filter(Boolean);
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

  const setHint = resolveSetAlias(best, setNames);
  return setHint ? { name, setHint } : { name: raw, setHint: null };
};

/**
 * The set filter an alias stands for, or null when it cannot be decided.
 *
 * An alias shared by several sets resolves to the phrase behind it, not to
 * whichever set happened to be listed first. setHint is used as a substring
 * match, so "Radiant Collection" finds both sets that end that way and
 * "Trainer Gallery" finds all four.
 */
const resolveSetAlias = (best: string, setNames: string[]): string | null => {
  const matching = setNames.filter((n) => setAliasMap(n).has(best));
  if (matching.length > 1) {
    const phrases = new Set(
      matching.map((n) => setAliasMap(n).get(best)!.toLowerCase()),
    );
    if (phrases.size === 1) return setAliasMap(matching[0]!).get(best)!;

    // Sets that disagree about what the alias means. Across both languages
    // this is common — "tg" is Trainer Gallery on four sets and Time Gazer on
    // one, "rc" is Radiant Collection on two and Red Collection and Rebellion
    // Crash on one each. The reading with the most sets behind it is the one
    // people mean; a genuine tie is left in the name rather than guessed.
    const byPhrase = new Map<string, { phrase: string; count: number }>();
    for (const n of matching) {
      const phrase = setAliasMap(n).get(best)!;
      const k = phrase.toLowerCase();
      const e = byPhrase.get(k) ?? { phrase, count: 0 };
      e.count += 1;
      byPhrase.set(k, e);
    }
    const ranked = [...byPhrase.values()].sort((a, b) => b.count - a.count);
    if (ranked.length > 1 && ranked[0]!.count > ranked[1]!.count) {
      return ranked[0]!.phrase;
    }
    if (!setNames.some((n) => n.trim().toLowerCase() === best)) return null;
  }

  // Recover the set's real casing for display and for the RPC's substring match.
  return (
    setNames.find((n) => n.trim().toLowerCase() === best) ??
    matching[0] ??
    best
  );
};

/**
 * Pull a set off the FRONT of a query: "ssp pikachu", "surging sparks
 * pikachu", "sv08 pikachu", "151 charizard".
 *
 * Stricter than the trailing match, because the front is where the card's
 * own name usually sits and sets are named after Pokémon and trainers. Only
 * forms that cannot be a card's first word are taken:
 *
 *   - a printed set code ("ssp", "obf", "pfl") or a code with digits
 *     ("sv08", "swsh09", "sm11b")
 *   - a set name of two words or more ("surging sparks", "base set")
 *   - a number that a set is named after ("151")
 *
 * Derived initials ("ss", "gg") are not taken here: two letters at the start
 * of a query are too often the start of something else. Something must be
 * left over — a query that is only a set is the trailing match's job.
 */
export const splitLeadingSet = (
  input: string,
  setNames: string[],
): { name: string; setHint: string | null } => {
  const raw = input.trim();
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2 || !setNames.length) return { name: raw, setHint: null };
  const lower = raw.toLowerCase();

  // "151 charizard": the number that names a set.
  const first = words[0]!;
  if (/^\d{2,}$/.test(first) && numberNamesASet(first, setNames)) {
    return { name: words.slice(1).join(" "), setHint: first };
  }

  const printed = new Set(Object.values(SET_CODES));
  let best: string | null = null;
  for (const set of setNames) {
    for (const alias of setAliases(set)) {
      const eligible =
        alias.includes(" ") || /\d/.test(alias) || printed.has(alias);
      if (!eligible || !lower.startsWith(alias + " ")) continue;
      if (!best || alias.length > best.length) best = alias;
    }
  }
  if (!best) return { name: raw, setHint: null };

  const name = raw.slice(best.length).trim();
  if (!name) return { name: raw, setHint: null };
  const setHint = resolveSetAlias(best, setNames);
  return setHint ? { name, setHint } : { name: raw, setHint: null };
};

// ── Language ────────────────────────────────────────────────────────────

export const LANGUAGE_WORDS: Record<string, "EN" | "JP"> = {
  jp: "JP",
  jpn: "JP",
  jap: "JP",
  japan: "JP",
  japanese: "JP",
  en: "EN",
  eng: "EN",
  english: "EN",
};

/**
 * Lift a language word out of the query: "pikachu jp", "japanese charizard".
 *
 * Anywhere in the query, but never the only word — "japanese" alone is too
 * thin a search to be worth reading as a filter with nothing to filter.
 */
export const stripLanguage = (
  input: string,
): { rest: string; languageHint: "EN" | "JP" | null } => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { rest: tokens.join(" "), languageHint: null };
  let languageHint: "EN" | "JP" | null = null;
  const kept = tokens.filter((t) => {
    if (languageHint) return true;
    const lang = LANGUAGE_WORDS[t.toLowerCase()];
    if (!lang) return true;
    languageHint = lang;
    return false;
  });
  return { rest: kept.join(" "), languageHint };
};

// ── Rarities written out ────────────────────────────────────────────────

/**
 * Lift a rarity typed in words: "pikachu illustration rare", "charizard
 * special illustration", "hyper rare" on its own.
 *
 * stripRarity reads one token at a time, so a rarity of several words stayed
 * in the card's name and matched nothing. Only names of two words or more are
 * read as a phrase — "Rare" and "Promo" alone are handled (or not) by the
 * token pass — and the word "rare" may be left off a name of three words
 * ("special illustration", "special art", "ace spec"). Longest wins, so
 * "special illustration rare" is never read as "illustration rare".
 */
export const stripRarityPhrase = (
  input: string,
  rarityNames: string[] = [],
): { rest: string; rarityMatches: string[] } => {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const lower = words.map((w) => w.toLowerCase());
  const names = rarityNames.length
    ? rarityNames
    : [...new Set(RARITY_ABBREVIATIONS.map(([, full]) => full))];

  const phrases: Array<{ words: string[]; rarity: string }> = [];
  for (const rarity of names) {
    const rw = rarity.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (rw.length >= 2) phrases.push({ words: rw, rarity });
    if (rw.length >= 3 && rw[rw.length - 1] === "rare") {
      phrases.push({ words: rw.slice(0, -1), rarity });
    }
  }
  phrases.sort((a, b) => b.words.length - a.words.length);

  for (const { words: pw } of phrases) {
    for (let i = 0; i + pw.length <= lower.length; i++) {
      if (!pw.every((w, k) => lower[i + k] === w)) continue;
      const key = pw.join(" ");
      const matches = [
        ...new Set(
          phrases.filter((p) => p.words.join(" ") === key).map((p) => p.rarity),
        ),
      ];
      const rest = [...words.slice(0, i), ...words.slice(i + pw.length)];
      return { rest: rest.join(" "), rarityMatches: matches };
    }
  }
  return { rest: words.join(" "), rarityMatches: [] };
};

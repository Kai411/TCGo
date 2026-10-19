// Matching what the scanner read off a card to rows in the TCGo catalogue.
//
// The scanner gets two things back from the model: an English name and the
// printed number ("65/202"). Neither is reliable on its own:
//
//   - the number is the stronger signal, but the model strips leading zeros
//     ("65/202") while the catalogue stores them ("065/202"), so comparing
//     the strings directly misses most cards numbered under 100;
//   - the name can be a translation (Japanese cards), drop an accent
//     ("Flabebe"), or lose a suffix ("Charizard" for "Charizard ex").
//
// So candidates come from both (the caller queries by number and by name) and
// are ranked here on both. Only a candidate that agrees on name AND the whole
// printed number is treated as certain; everything else is offered as a choice.

/** What the scanner read. `number` is "N/Total", "GG44/GG70", "SWSH020" or "". */
export interface ScanReading {
  name: string;
  number: string;
}

/** The catalogue fields ranking needs. */
export interface MatchCandidate {
  name: string;
  number: string | null;
}

export interface PrintedNumber {
  /** The part before the slash, as printed ("065", "GG44", "SWSH020"). */
  printed: string;
  /** The set size after the slash, or null when there is none. */
  total: string | null;
}

/** Split "065/202" into its two halves. Empty or unreadable → null. */
export const parsePrintedNumber = (raw: string | null | undefined): PrintedNumber | null => {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const [printed, total] = t.split("/").map((s) => s.trim());
  if (!printed) return null;
  return { printed, total: total || null };
};

/**
 * One number half in a comparable form: lower case, leading zeros dropped
 * after any letter prefix. "065" → "65", "GG04" → "gg4", "SWSH020" → "swsh20".
 */
export const normalizeNumberPart = (part: string): string =>
  part
    .trim()
    .toLowerCase()
    .replace(/^([a-z-]*)0+(?=\d)/, "$1");

/**
 * The stored forms a printed number could take, for the catalogue query.
 * "65" → 65, 065; "5" → 5, 05, 005; "GG44" → GG44. Matching is by ILIKE, so
 * case doesn't matter.
 */
export const printedNumberForms = (printed: string): string[] => {
  const t = printed.trim();
  if (!t) return [];
  const out = new Set<string>([t]);
  const m = t.match(/^([a-z-]*)(\d+)$/i);
  if (m) {
    const [, prefix, digits] = m;
    const bare = String(Number(digits));
    out.add(`${prefix}${bare}`);
    out.add(`${prefix}${bare.padStart(2, "0")}`);
    out.add(`${prefix}${bare.padStart(3, "0")}`);
  }
  return [...out];
};

/**
 * A card name in a comparable form. Drops accents (Flabébé), the
 * " - 199/165" suffix TCGplayer adds to tell same-name printings apart, any
 * bracketed note ("(Secret)"), and punctuation.
 */
export const normalizeCardName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+-\s+[a-z]*\d+[a-z]*(\/[a-z]*\d+)?\s*$/i, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * How well two names agree, 0–1.
 *   1    identical once normalised
 *   0.8  one is the other plus extra words ("charizard" / "charizard ex")
 *   0–0.6 share of words in common otherwise
 */
export const nameScore = (detected: string, candidate: string): number => {
  const a = normalizeCardName(detected);
  const b = normalizeCardName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.startsWith(`${a} `) || a.startsWith(`${b} `)) return 0.8;
  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  let shared = 0;
  for (const w of aw) if (bw.has(w)) shared++;
  return (shared / Math.max(aw.size, bw.size)) * 0.6;
};

/**
 * How well two printed numbers agree, 0–1.
 *   1    same number and same set size
 *   0.6  same number, set size missing on one side
 *   0.4  same number, different set size (another set)
 *   0    different number, or nothing to compare
 */
export const numberScore = (detected: string, candidate: string | null): number => {
  const a = parsePrintedNumber(detected);
  const b = parsePrintedNumber(candidate);
  if (!a || !b) return 0;
  if (normalizeNumberPart(a.printed) !== normalizeNumberPart(b.printed)) return 0;
  if (!a.total || !b.total) return 0.6;
  return normalizeNumberPart(a.total) === normalizeNumberPart(b.total) ? 1 : 0.4;
};

export interface RankedCandidate<T> {
  row: T;
  score: number;
  name: number;
  number: number;
}

/** Name and number weigh the same; a name-only or number-only hit tops out at 0.5. */
export const scoreCandidate = (reading: ScanReading, c: MatchCandidate) => {
  const name = nameScore(reading.name, c.name);
  const number = numberScore(reading.number, c.number);
  return { name, number, score: (name + number) / 2 };
};

export interface ScanMatchResult<T> {
  /**
   * Candidates that agree on the name and the full printed number. One means
   * the scan is certain; several (a holo and a reverse holo listed as separate
   * products) means the member picks between them.
   */
  exact: T[];
  /** Everything else worth showing, best first, when `exact` is empty. */
  suggestions: T[];
}

/** Names this close count as the same card for `exact`. */
const EXACT_NAME = 0.8;

/**
 * Rank catalogue rows against a scan. Rows that share neither name nor number
 * with the reading are dropped. Ties keep the order the rows came in.
 */
export const rankScanMatches = <T extends MatchCandidate>(
  reading: ScanReading,
  rows: T[],
  limit = 12,
): ScanMatchResult<T> => {
  const ranked: RankedCandidate<T>[] = rows
    .map((row) => ({ row, ...scoreCandidate(reading, row) }))
    .filter((r) => r.score > 0);
  // Stable sort: Array.prototype.sort is stable, so equal scores keep input order.
  ranked.sort((x, y) => y.score - x.score);

  const exact = ranked.filter((r) => r.number === 1 && r.name >= EXACT_NAME);
  if (exact.length) {
    // An identical name beats a "plus extra words" one: "Pikachu" read off the
    // card should not tie with "Pikachu ex" carrying the same number.
    const best = Math.max(...exact.map((r) => r.name));
    return { exact: exact.filter((r) => r.name === best).map((r) => r.row), suggestions: [] };
  }
  return { exact: [], suggestions: ranked.slice(0, limit).map((r) => r.row) };
};

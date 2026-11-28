// Helpers for the nightly catalog seed (scripts/seed-pokemon-catalog.mjs),
// kept apart so they can be tested without Supabase or TCGCSV.

// The columns the seed compares against what is already stored. A card is
// only written when one of these differs, so a night with no upstream edits
// writes almost nothing. Every column is compared against the stored row, not
// a remembered hash, so a hand edit to any of them is still put back by the
// next run, as the full sync always did.
//
// Left out: modified_on (TCGCSV's timestamp, stored in a different format and
// read by nothing) and extended_data (no longer written; see the seed).
export const COMPARED_COLUMNS = [
  "name",
  "clean_name",
  "image_url",
  "category_id",
  "group_id",
  "group_name",
  "url",
  "rarity",
  "number",
  "card_type",
  "stage",
  "hp",
  "language",
  "released_on",
];

const norm = (value) => (value == null || value === "" ? null : String(value));

/** True when `row` would change anything in `stored` (or there is no stored row). */
export function rowChanged(row, stored) {
  if (!stored) return true;
  for (const column of COMPARED_COLUMNS) {
    if (!(column in row)) continue; // e.g. released_on before it exists
    if (norm(row[column]) !== norm(stored[column])) return true;
  }
  return false;
}

// A set's real release date from TCGCSV's publishedOn, or null.
//
// Real sets carry a midnight date ("2023-09-22T00:00:00"). Groups with no
// release date of their own (POP Series, Nintendo Promos, Burger King
// Promos...) carry the time TCGCSV last rebuilt its files instead
// ("2026-11-25T20:00:07.3733511Z"), the same stamp on all of them, so they all
// looked released last night and sat at the top of every Newest search. Those
// count as undated, which Newest sorts last.
//
// "Miscellaneous Cards & Products" is a catch-all that TCGCSV re-dates with a
// midnight stamp whenever something is added to it (2026-11-24 on 11-28), so
// the format check alone lets it through. It is never a release.
export function releaseDate(group) {
  if (/^miscellaneous\b/i.test(String(group?.name ?? ""))) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T00:00:00$/.exec(String(group?.publishedOn ?? ""));
  return m ? m[1] : null;
}

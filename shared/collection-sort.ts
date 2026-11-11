// Order and filters for the owned cards on /collection.
//
// The page's Sort, Filter and price controls used to only act on search
// results, leaving them doing nothing while the owned grid was on screen.
// These apply the same choices to what the reader owns.

export type OwnedSort = "newest" | "best" | "name" | "price_asc" | "price_desc";

export interface SortableCard {
  productId: number;
  name: string;
  price: { market: number } | null;
}

/**
 * `cards` must arrive most recently added first; that order is kept as the
 * tie-break, and is the whole order for "best" (there is no query to match).
 *
 * Newest compares the set's release date (YYYY-MM-DD). Cards whose date is
 * unknown go last rather than first, so a missing date never looks new.
 * Cards with no price go last in both price directions.
 */
export const sortOwned = <T extends SortableCard>(
  cards: T[],
  sort: OwnedSort,
  releasedOn: Map<number, string>,
): T[] => {
  const added = new Map(cards.map((c, i) => [c.productId, i]));
  const tie = (a: T, b: T) => added.get(a.productId)! - added.get(b.productId)!;
  const last = (x: unknown, y: unknown) => (x == null ? 1 : 0) - (y == null ? 1 : 0);

  const compare: Record<OwnedSort, (a: T, b: T) => number> = {
    best: tie,
    name: (a, b) => a.name.localeCompare(b.name) || tie(a, b),
    newest: (a, b) => {
      const x = releasedOn.get(a.productId);
      const y = releasedOn.get(b.productId);
      if (x == null || y == null) return last(x, y) || tie(a, b);
      return y.localeCompare(x) || tie(a, b);
    },
    price_desc: (a, b) => {
      const x = a.price?.market;
      const y = b.price?.market;
      if (x == null || y == null) return last(x, y) || tie(a, b);
      return y - x || tie(a, b);
    },
    price_asc: (a, b) => {
      const x = a.price?.market;
      const y = b.price?.market;
      if (x == null || y == null) return last(x, y) || tie(a, b);
      return x - y || tie(a, b);
    },
  };
  return [...cards].sort(compare[sort]);
};

export interface OwnedFilter {
  /** Exact set name; the dropdown is built from the owned cards. */
  set: string;
  rarity: string;
  language: "ALL" | "EN" | "JP";
}

export const filterOwned = <
  T extends { setName: string; rarity: string | null; language: string },
>(
  cards: T[],
  f: OwnedFilter,
): T[] =>
  cards.filter(
    (c) =>
      (!f.set || c.setName === f.set) &&
      (!f.rarity || c.rarity === f.rarity) &&
      (f.language === "ALL" || c.language === f.language),
  );

/** Distinct values with how many owned cards carry each, A–Z. */
export const countBy = <T>(cards: T[], key: (c: T) => string | null) => {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const k = key(c);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

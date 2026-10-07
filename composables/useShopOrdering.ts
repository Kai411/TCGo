// Discovery ordering for the shop grid.
//
// "Newest" on its own means the same handful of sellers who listed last always
// sit on top, and everything listed on the same day is shown in upload order.
// This keeps newest-day-first but shuffles listings *within* a day, and mixes a
// few of the most-viewed listings from deeper pages into page one so good
// stock still gets seen.
//
// The shuffle is seeded once per browser session so paging back and forth
// (and reloading) keeps a stable order; a new session gets a fresh mix.

export const SHOP_PAGE_SIZE = 60;

// sessionStorage key for the shop's resume state ({ page, y, tcg }). Read by
// app/router.options.ts to restore the scroll offset on re-entry.
export const SHOP_STATE_KEY = "tcgo:shop:state";

// How many top-viewed listings to pull into page one, and how far apart.
const MIX_IN_COUNT = 6;
const MIX_IN_EVERY = 10;
const MIX_IN_POOL = 12;

interface Orderable {
  id: string;
  createdAt?: number;
  viewCount?: number;
}

const sessionSeed = (): number => {
  if (!import.meta.client) return 1;
  const key = "tcgo:shop:seed";
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return Number(saved);
    const seed = Math.floor(Math.random() * 2 ** 31) || 1;
    sessionStorage.setItem(key, String(seed));
    return seed;
  } catch {
    return Math.floor(Math.random() * 2 ** 31) || 1;
  }
};

// Small string hash mixed with the seed — deterministic per (seed, id).
const rank = (seed: number, id: string): number => {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const dayKey = (ts: number | undefined): string => {
  const d = new Date(ts ?? 0);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const useShopOrdering = () => {
  const seed = sessionSeed();

  // Newest day first; random (but stable) order within the same day.
  const newestShuffled = <T extends Orderable>(items: T[]): T[] =>
    [...items].sort((a, b) => {
      const da = dayKey(a.createdAt);
      const db = dayKey(b.createdAt);
      if (da !== db) return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      return rank(seed, a.id) - rank(seed, b.id);
    });

  // Pull a few of the most-viewed listings that would otherwise be buried
  // past page one and space them through page one.
  const mixInTopViewed = <T extends Orderable>(ordered: T[]): T[] => {
    if (ordered.length <= SHOP_PAGE_SIZE) return ordered;
    const buried = ordered.slice(SHOP_PAGE_SIZE);
    const pool = buried
      .filter((c) => (c.viewCount ?? 0) > 0)
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, MIX_IN_POOL)
      .sort((a, b) => rank(seed, a.id) - rank(seed, b.id))
      .slice(0, MIX_IN_COUNT);
    if (!pool.length) return ordered;

    const picked = new Set(pool.map((c) => c.id));
    const rest = ordered.filter((c) => !picked.has(c.id));
    // Slot them at 5, 15, 25… so they read as part of the feed, not a banner.
    pool.forEach((c, i) => {
      const at = Math.min(MIX_IN_EVERY * i + MIX_IN_EVERY / 2, rest.length);
      rest.splice(at, 0, c);
    });
    return rest;
  };

  const discoveryOrder = <T extends Orderable>(items: T[]): T[] =>
    mixInTopViewed(newestShuffled(items));

  return { discoveryOrder };
};

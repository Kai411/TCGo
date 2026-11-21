// Pure helpers for scripts/backfill-price-history.mjs, kept apart so the
// rules that decide which days are kept can be tested without the network.

/** TCGCSV's price archive starts here (its FAQ: "February 8, 2024 and onwards"). */
export const ARCHIVE_START = "2024-02-08";

/** History is kept for this many days, one point a day (kai, 2026-11-21: "1 year max"). */
export const HISTORY_DAYS = 365;

// Same order as snapshot_prices_range() in supabase/schema.sql, so a
// backfilled day reads exactly like a nightly one.
export const SUBTYPE_PREFERENCE = ["Holofoil", "Normal", "Reverse Holofoil"];

const DAY_MS = 86_400_000;

export const toDate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const dayMs = (date) => Date.parse(`${date}T00:00:00Z`);

/**
 * The same keep-rule as snapshot_prices_range(): every day inside the last
 * HISTORY_DAYS days counted back from `today`, nothing older.
 */
export const isKeptDate = (date, today) =>
  dayMs(date) > dayMs(today) - HISTORY_DAYS * DAY_MS;

/**
 * Archive days to fetch, oldest first: from `from` (no earlier than the
 * archive start) to `to`, inclusive, keeping only days the history would keep.
 */
export const planDates = ({ from = ARCHIVE_START, to, today }) => {
  const start = Math.max(dayMs(from), dayMs(ARCHIVE_START));
  const end = dayMs(to);
  const dates = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const date = toDate(t);
    if (isKeptDate(date, today)) dates.push(date);
  }
  return dates;
};

/**
 * One archive day's price rows (TCGCSV `prices` files: one row per productId
 * and subTypeName) to a map of productId → market USD, using the same
 * sub-type preference as the nightly snapshot. Rows with no market are
 * skipped, as the snapshot skips them.
 */
export const marketByProduct = (priceRows) => {
  const bySubtype = new Map();
  for (const row of priceRows) {
    if (!row?.productId || !row?.subTypeName) continue;
    const market = row.marketPrice;
    if (market == null || !Number.isFinite(Number(market))) continue;
    if (!bySubtype.has(row.productId)) bySubtype.set(row.productId, {});
    bySubtype.get(row.productId)[row.subTypeName] = Number(market);
  }
  const out = new Map();
  for (const [productId, subtypes] of bySubtype) {
    for (const subtype of SUBTYPE_PREFERENCE) {
      if (subtypes[subtype] != null) {
        out.set(productId, subtypes[subtype]);
        break;
      }
    }
  }
  return out;
};

/** `{ results: [...] }` or a bare array, as TCGCSV serves both. */
export const priceRowsFrom = (payload) => {
  const rows = payload?.results ?? payload;
  return Array.isArray(rows) ? rows : [];
};

/**
 * Points for one product from its per-day column, newest first like the
 * stored history. `values[i]` belongs to `dates[i]`; NaN means no price.
 * Prices are rounded to cents, as TCGPlayer publishes them.
 */
export const pointsFor = (dates, values) => {
  const points = [];
  for (let i = dates.length - 1; i >= 0; i--) {
    const v = values[i];
    if (Number.isFinite(v)) points.push({ date: dates[i], market: Math.round(v * 100) / 100 });
  }
  return points;
};

/** TCGCSV's FAQ: past its threshold an IP is "temporarily throttled for 10 minutes". */
export const DEFAULT_THROTTLE_MS = 10 * 60_000;

/**
 * How long to wait after a 429. Honours Retry-After (seconds or an HTTP
 * date), never less than a minute or more than 30, and falls back to
 * TCGCSV's 10-minute throttle when the header is missing or unreadable.
 */
export const retryDelayMs = (retryAfter, now = Date.now()) => {
  const clamp = (ms) => Math.min(30 * 60_000, Math.max(60_000, ms));
  if (retryAfter == null || String(retryAfter).trim() === "") return DEFAULT_THROTTLE_MS;
  const text = String(retryAfter).trim();
  if (/^\d+$/.test(text)) return clamp(Number(text) * 1000);
  const at = Date.parse(text);
  return Number.isFinite(at) ? clamp(at - now) : DEFAULT_THROTTLE_MS;
};

/**
 * The next `size` planned days not done yet, newest first (so the 1Y chart and
 * recent gaps fill in soonest), returned oldest-first as the script expects.
 */
export const nextChunk = (planned, done, size) => {
  const todo = planned.filter((date) => !done.has(date));
  return { next: todo.slice(-size), remaining: todo.length };
};

/**
 * 20:30 to 00:30 UTC: TCGCSV's rebuild (~20:05) and the nightly catalogue
 * seed (21:00), price snapshot (22:00) and Cardmarket job (23:00), with room
 * for a slow night. The scheduled backfill must not write then.
 */
export const inNightlyWindow = (when) => {
  const minutes = when.getUTCHours() * 60 + when.getUTCMinutes();
  return minutes >= 20 * 60 + 30 || minutes < 30;
};

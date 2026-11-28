// card_prices.history, read back as one value per day.
//
// The nightly job (snapshot_prices_range in supabase/schema.sql) stores a
// point only on days the market price CHANGED, newest first:
//   [{ "date": "2026-11-26", "market": 22.5 }, { "date": "2026-11-20", "market": 21 }]
// meaning 21 from 11-20 to 11-25 and 22.5 from 11-26 onwards. A typical card
// changes on about 81 of 268 days, so this keeps the table a fraction of the
// size of one point a day, and a card whose price held costs no write.
//
// `market: null` marks the day TCGPlayer stopped publishing a price; there is
// no value from then until the next numeric point.
//
// Old rows still hold one point a day; expanding those gives the same series,
// so both shapes read the same during the switch.

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Longest series returned: kai's one-year rule (365 daily points). */
export const HISTORY_DAYS = 365;

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  market: number; // as stored (USD)
}

const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * One point per day, oldest first, from the first stored point (or one year
 * before `today`, whichever is later) up to `today`, carrying each price
 * forward until the next change. Days after a null point are left out.
 */
export const expandHistory = (
  raw: unknown,
  today: string = isoDay(Date.now()),
  days = HISTORY_DAYS,
): DailyPoint[] => {
  if (!Array.isArray(raw) || !DATE_RE.test(today)) return [];

  const changes = new Map<string, number | null>();
  for (const point of raw) {
    if (!point || typeof point !== "object") continue;
    const date = String((point as any).date ?? "");
    if (!DATE_RE.test(date) || !Number.isFinite(dayTime(date))) continue;
    const rawMarket = (point as any).market;
    const market = rawMarket == null ? null : Number(rawMarket);
    if (market !== null && !Number.isFinite(market)) continue;
    changes.set(date, market);
  }
  const sorted = [...changes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!sorted.length) return [];

  const end = dayTime(today);
  const windowStart = end - (Math.max(1, days) - 1) * DAY_MS;
  const out: DailyPoint[] = [];
  let value: number | null = null;
  let i = 0;
  // Start at the first stored point; the window clips it below.
  for (let t = dayTime(sorted[0]![0]); t <= end; t += DAY_MS) {
    const date = isoDay(t);
    while (i < sorted.length && sorted[i]![0] <= date) {
      value = sorted[i]![1];
      i++;
    }
    if (t >= windowStart && value !== null) out.push({ date, market: value });
  }
  return out;
};

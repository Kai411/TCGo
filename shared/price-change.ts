// The small ▲/▼ beside a card's value on the collection tiles.
//
// Measured snapshot to snapshot from card_prices.history, so both ends were
// taken by the same nightly job from the same price subtype and converted at
// the same exchange rate: the arrow moves with the card's price, never with
// the ringgit.

/** Days the tile change looks back over. Switch to 1 or 30 here. */
export const PRICE_CHANGE_DAYS = 7;

/**
 * Snapshots can be missing for days (2026-09-28 to 10-06 never ran). If the
 * nearest snapshot before the window is older than this, the change would
 * describe a longer period than the tile implies, so none is shown.
 */
const MAX_BASELINE_DAYS = PRICE_CHANGE_DAYS * 2;

const DAY_MS = 86_400_000;
const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

export interface ChangePoint {
  date: string; // YYYY-MM-DD
  market: number;
}

export interface PriceChange {
  direction: "up" | "down";
  /** Absolute percentage, already rounded for display. */
  pct: number;
  /** "4.2%" under 10, then whole numbers ("12%", "130%"): the tile is narrow. */
  label: string;
  /** Date of the snapshot it was compared against. */
  since: string;
}

/**
 * Change between the newest snapshot and the newest one at least `days`
 * before it. Null when there is no such pair, a price is unusable, or the
 * change rounds to nothing.
 */
export const priceChange = (
  points: ChangePoint[],
  days = PRICE_CHANGE_DAYS,
): PriceChange | null => {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]!;
  const latestTime = dayTime(latest.date);
  const target = latestTime - days * DAY_MS;
  const oldest = latestTime - Math.max(days, MAX_BASELINE_DAYS) * DAY_MS;

  let baseline: ChangePoint | null = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const time = dayTime(sorted[i]!.date);
    if (time <= target) {
      if (time >= oldest) baseline = sorted[i]!;
      break;
    }
  }
  if (!baseline) return null;
  if (!(baseline.market > 0) || !Number.isFinite(latest.market)) return null;

  const raw = ((latest.market - baseline.market) / baseline.market) * 100;
  const tenths = Math.round(Math.abs(raw) * 10) / 10;
  if (tenths === 0) return null;
  const whole = tenths >= 10;
  const pct = whole ? Math.round(tenths) : tenths;

  return {
    direction: raw > 0 ? "up" : "down",
    pct,
    label: whole ? `${pct}%` : `${pct.toFixed(1)}%`,
    since: baseline.date,
  };
};

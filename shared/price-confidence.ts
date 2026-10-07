// How much to trust the price we are showing.
//
// A market price on a marketplace is not decoration: a seller reads it and
// prices against it, a buyer reads it and decides whether an offer is fair.
// Ours comes from one upstream source, is refreshed on a schedule, and for
// scarce cards is often stale or absent entirely — 34 of 61 Gold Stars have no
// published price at all. Showing one number for all of those cases, with the
// same weight, tells people something we do not actually know.
//
// So every price carries a confidence, and the confidence carries its reasons.
// "Low" on its own invites arguing with the badge; "Low — one source, last
// updated 40 days ago" tells a seller what to do about it.
//
// Deliberately conservative. It is better to under-claim on a price that turns
// out to be solid than to call a stale, uncorroborated figure "high".

export type ConfidenceLevel = "none" | "low" | "medium" | "high";

export interface ConfidenceInput {
  /** The price being shown, in MYR. Null when nothing was published. */
  market: number | null;
  /** Days since that price was last refreshed. Null when unknown. */
  ageDays?: number | null;
  /** Daily snapshots we hold for this card. */
  snapshotCount?: number;
  /** Lowest and highest snapshot in the window, for volatility. */
  min?: number | null;
  max?: number | null;
  /** Asking prices from live listings on TCGo, in MYR. */
  listingPrices?: number[];
  /** Independent price sources that produced a figure. */
  sourceCount?: number;
}

export interface Confidence {
  level: ConfidenceLevel;
  /** 0–100, for sorting and for the bar. Not shown as a number. */
  score: number;
  /** Plain sentences, most important first. */
  reasons: string[];
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  none: "No price",
  low: "Low confidence",
  medium: "Fair confidence",
  high: "High confidence",
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Thresholds, named so the scoring below reads as prose. */
const FRESH_DAYS = 2;
const RECENT_DAYS = 7;
const STALE_DAYS = 30;

export const priceConfidence = (input: ConfidenceInput): Confidence => {
  const { market } = input;
  if (market == null || !Number.isFinite(market) || market <= 0) {
    return {
      level: "none",
      score: 0,
      reasons: [
        "No market price has been published for this card. That usually means it trades too rarely to have one.",
      ],
    };
  }

  const reasons: string[] = [];
  let score = 50;

  // ── How recent ────────────────────────────────────────────────────
  const age = input.ageDays ?? null;
  if (age == null) {
    score -= 5;
  } else if (age <= FRESH_DAYS) {
    score += 20;
  } else if (age <= RECENT_DAYS) {
    score += 12;
  } else if (age <= STALE_DAYS) {
    score += 4;
    reasons.push(`Last updated ${Math.round(age)} days ago.`);
  } else {
    score -= 15;
    reasons.push(`Last updated ${Math.round(age)} days ago, so it may be out of date.`);
  }

  // ── How much history stands behind it ─────────────────────────────
  const snapshots = input.snapshotCount ?? 0;
  if (snapshots >= 30) score += 15;
  else if (snapshots >= 10) score += 8;
  else if (snapshots >= 3) score += 3;
  else {
    score -= 5;
    reasons.push("We have only just started tracking this card's price.");
  }

  // ── How steady it has been ────────────────────────────────────────
  const { min, max } = input;
  if (min != null && max != null && min > 0 && max >= min && snapshots >= 3) {
    const spread = (max - min) / ((max + min) / 2);
    if (spread < 0.1) score += 15;
    else if (spread < 0.25) score += 8;
    else if (spread < 0.5) score += 0;
    else {
      score -= 12;
      reasons.push("The price has moved a lot recently.");
    }
  }

  // ── Whether real listings agree ───────────────────────────────────
  //
  // Asking prices are not sales, so agreement is weaker evidence than a sale
  // would be — but a market price nobody is anywhere near is worth flagging.
  const asks = (input.listingPrices ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (asks.length) {
    const gap = Math.abs(median(asks) - market) / market;
    if (gap <= 0.25) {
      score += 15;
      reasons.push(`Listings on TCGo are close to this price.`);
    } else if (gap <= 0.5) {
      score += 5;
    } else {
      score -= 10;
      reasons.push("Listings on TCGo differ noticeably from this price.");
    }
  }

  // ── How many sources ──────────────────────────────────────────────
  const sources = input.sourceCount ?? 1;
  if (sources >= 3) score += 15;
  else if (sources === 2) score += 8;
  else reasons.push("Based on a single price source.");

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: ConfidenceLevel = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  if (!reasons.length) {
    reasons.push("Recently updated and steady, with more than one check agreeing.");
  }
  return { level, score, reasons };
};

/** Tailwind classes per level, kept beside the levels they describe. */
export const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  none: "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-zinc-400",
  low: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

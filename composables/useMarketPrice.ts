// Cheap market-price hint for the scan flow.
//
// pokemontcg.io returns USD prices from TCGPlayer and EUR from Cardmarket.
// We convert to MYR and surface a low–high range so users know what to
// price against. Conversion rates are constants — exact precision doesn't
// matter at this scale (the range is already a wide bracket).
//
// First commit on this feature; later we can swap in a live FX feed if
// the static rate drifts too far.

import type { TcgCard, TcgPriceBlock } from "./usePokemonTcg";

// 2026-05 ballpark rates. Round numbers — these are for an order-of-
// magnitude hint, not an FX quote.
const USD_MYR = 4.7;
const EUR_MYR = 5.1;

const round = (n: number) => Math.round(n);

export interface MarketPrice {
  low: number; // MYR
  high: number; // MYR
  source: "tcgplayer" | "cardmarket";
  variant?: string; // for tcgplayer: holofoil / normal / reverseHolofoil / ...
}

// TCGPlayer publishes per-variant prices. We pick the most likely variant
// in this preference order — most cards are sold as the holofoil/reverse
// version when those exist, otherwise normal.
const VARIANT_ORDER = [
  "holofoil",
  "reverseHolofoil",
  "normal",
  "1stEditionHolofoil",
  "1stEditionNormal",
  "unlimitedHolofoil",
];

const pickTcgPlayerBlock = (
  prices?: Record<string, TcgPriceBlock | undefined>,
): { variant: string; block: TcgPriceBlock } | null => {
  if (!prices) return null;
  for (const v of VARIANT_ORDER) {
    const b = prices[v];
    if (b && (b.low || b.mid || b.high || b.market)) return { variant: v, block: b };
  }
  // Fall back: any variant with usable numbers.
  for (const [variant, block] of Object.entries(prices)) {
    if (block && (block.low || block.mid || block.high || block.market))
      return { variant, block };
  }
  return null;
};

export const extractMarketPrice = (card: TcgCard | undefined): MarketPrice | null => {
  if (!card) return null;

  // Prefer TCGPlayer — it has more granular variant pricing.
  const tcg = pickTcgPlayerBlock(card.tcgplayer?.prices);
  if (tcg) {
    const { block, variant } = tcg;
    const lowUsd = block.low ?? block.market ?? block.mid;
    const highUsd = block.high ?? block.market ?? block.mid;
    if (lowUsd && highUsd) {
      return {
        low: round(lowUsd * USD_MYR),
        high: round(highUsd * USD_MYR),
        source: "tcgplayer",
        variant,
      };
    }
  }

  // Cardmarket fallback. averageSellPrice ± ~25% gives a usable bracket
  // since the API doesn't publish a true min/max.
  const cm = card.cardmarket?.prices;
  const avg = cm?.averageSellPrice ?? cm?.trendPrice ?? cm?.avg7;
  if (avg) {
    return {
      low: round(avg * EUR_MYR * 0.75),
      high: round(avg * EUR_MYR * 1.25),
      source: "cardmarket",
    };
  }

  return null;
};

export const formatMarketPrice = (p: MarketPrice): string =>
  p.low === p.high
    ? `RM ${p.low}`
    : `RM ${p.low}–${p.high}`;

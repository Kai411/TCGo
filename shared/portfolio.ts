// What a seller's stock is worth, and what it has earned.
//
// Pure, so the arithmetic can be tested without Firestore or Supabase, and
// shared so the seller home card and the items table agree to the sen.
//
// THREE RULES THE NUMBERS FOLLOW
//
// 1. Unknown is not zero. A row with no costPrice is "cost not recorded": it
//    counts in revenue and is reported as missing, never treated as free.
//    Otherwise the first seller to skip the field would see a 100% margin.
// 2. The headline is a market figure. Rows with no market price (no catalog
//    match, or a card TCGPlayer does not price) are reported beside it at
//    their asking price, never folded in.
// 3. Unrealised gain compares like with like. Cost basis and the market value
//    it is set against are summed over the same rows — those with both a
//    cost and a market price — so the gain is a real comparison.
// 4. Profit is what the seller kept. TCGo's fee comes off before the cost is
//    subtracted, using the fee recorded on the row at settlement. Postage is
//    not in the picture: the buyer pays it to TCGo and TCGo buys the label,
//    so it is never the seller's money and never a card's cost.
//
// Prices are per unit and a row's units multiply them. The POS sells a whole
// row and the items page already values stock as listPrice × quantity, so
// this keeps to the same convention. Almost every row is a single card.

import { startOfDayMs } from "~/shared/sales-summary";
import { STANDARD_RATE } from "~/shared/pricing";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

/** The slice of an inventory row this module reads. */
export interface PortfolioRow {
  productId: number | null;
  quantity: number;
  listPrice: number;
  costPrice?: number | null;
  soldPrice?: number | null;
  /** TCGo's fee on the sale, per unit, as charged. See feeOf. */
  soldFee?: number | null;
  saleChannel?: string | null;
  status: string;
  soldAt?: number | null;
  updatedAt?: number | null;
}

const HELD = new Set(["in_stock", "listed", "reserved"]);

export const isHeld = (row: PortfolioRow): boolean => HELD.has(row.status);
export const isSold = (row: PortfolioRow): boolean => row.status === "sold";

/** A recorded cost: any finite, non-negative number. Zero is a real cost. */
export const hasCost = (row: PortfolioRow): row is PortfolioRow & { costPrice: number } =>
  typeof row.costPrice === "number" && Number.isFinite(row.costPrice) && row.costPrice >= 0;

/** Units on the row; a missing or broken quantity counts as one, as elsewhere. */
export const unitsOf = (row: PortfolioRow): number =>
  Math.max(1, Math.floor(Number(row.quantity) || 1));

/**
 * What a unit actually fetched. Counter sales record soldPrice; online sales
 * settled before the webhook wrote it fall back to the asking price, which is
 * how the sales dashboard already values them. A cancelled order nulls
 * soldPrice, which falls back the same way.
 */
export const realisedUnitPrice = (row: PortfolioRow): number => {
  const sold = row.soldPrice;
  if (typeof sold === "number" && Number.isFinite(sold) && sold >= 0) return sold;
  return Number(row.listPrice) || 0;
};

/**
 * TCGo's fee on one unit of a sold row.
 *
 * The recorded figure wins: the payment webhook and the till write `soldFee`
 * at settlement from the rate the sale was actually charged, and a
 * hand-marked sale records 0 because no payment went through TCGo. Rows sold
 * before the field existed have no record. An online sale always carried a
 * fee, so it is estimated at today's standard rate; a counter sale without a
 * record is read as fee-free, the same reading recordedPosFee gives a
 * receipt with no fee (cash, or before the counter fee existed).
 */
export const hasRecordedFee = (row: PortfolioRow): row is PortfolioRow & { soldFee: number } =>
  typeof row.soldFee === "number" && Number.isFinite(row.soldFee) && row.soldFee >= 0;

export const feeOf = (row: PortfolioRow): number => {
  if (hasRecordedFee(row)) return row.soldFee;
  if (row.saleChannel === "online") return round2(realisedUnitPrice(row) * STANDARD_RATE);
  return 0;
};

/** What one unit left the seller with after TCGo's fee. */
export const netUnitPrice = (row: PortfolioRow): number =>
  round2(realisedUnitPrice(row) - feeOf(row));

/** TCGo's fee on the whole row, for display beside its profit. */
export const rowFee = (row: PortfolioRow): number => round2(feeOf(row) * unitsOf(row));

/**
 * Profit on one sold row — what it fetched, less TCGo's fee, less what it
 * cost — or null when it cannot be known: the row is not sold, or its cost
 * was never recorded.
 */
export const rowProfit = (row: PortfolioRow): number | null => {
  if (!isSold(row) || !hasCost(row)) return null;
  return round2((netUnitPrice(row) - row.costPrice) * unitsOf(row));
};

export interface Holdings {
  rows: number;
  units: number;
  /** Σ market × units over held rows that have a market price. */
  marketValue: number;
  pricedRows: number;
  unpricedRows: number;
  /** What the unpriced rows would fetch at their asking price. */
  unpricedAskingValue: number;
  /** Σ cost × units over rows with both a cost and a market price. */
  costBasis: number;
  /** Σ market × units over those same rows. */
  costedMarketValue: number;
  costedRows: number;
  /** Held rows with no recorded cost, priced or not. */
  missingCostRows: number;
  unrealisedGain: number;
  /** Gain over cost basis, as a percentage; null when there is no basis. */
  unrealisedPct: number | null;
}

export const EMPTY_HOLDINGS: Holdings = {
  rows: 0,
  units: 0,
  marketValue: 0,
  pricedRows: 0,
  unpricedRows: 0,
  unpricedAskingValue: 0,
  costBasis: 0,
  costedMarketValue: 0,
  costedRows: 0,
  missingCostRows: 0,
  unrealisedGain: 0,
  unrealisedPct: null,
};

/**
 * Value the stock still on the shelf. `market` maps productId → current
 * market price per unit in MYR; a product missing from it is unpriced.
 */
export const valueHoldings = (
  rows: PortfolioRow[],
  market: Map<number, number>,
): Holdings => {
  let held = 0;
  let units = 0;
  let marketValue = 0;
  let pricedRows = 0;
  let unpricedRows = 0;
  let unpricedAskingValue = 0;
  let costBasis = 0;
  let costedMarketValue = 0;
  let costedRows = 0;
  let missingCostRows = 0;

  for (const row of rows) {
    if (!isHeld(row)) continue;
    held++;
    const n = unitsOf(row);
    units += n;

    const price = row.productId == null ? undefined : market.get(row.productId);
    const priced = typeof price === "number" && Number.isFinite(price) && price > 0;
    const costed = hasCost(row);
    if (!costed) missingCostRows++;

    if (priced) {
      pricedRows++;
      marketValue += price * n;
      if (costed) {
        costedRows++;
        costBasis += row.costPrice * n;
        costedMarketValue += price * n;
      }
    } else {
      unpricedRows++;
      unpricedAskingValue += (Number(row.listPrice) || 0) * n;
    }
  }

  // Rounded once, here, so the three figures that sit together on screen
  // (basis, value, gain) always reconcile with each other.
  const basis = round2(costBasis);
  const costedValue = round2(costedMarketValue);
  const gain = round2(costedValue - basis);
  return {
    rows: held,
    units,
    marketValue: round2(marketValue),
    pricedRows,
    unpricedRows,
    unpricedAskingValue: round2(unpricedAskingValue),
    costBasis: basis,
    costedMarketValue: costedValue,
    costedRows,
    missingCostRows,
    unrealisedGain: gain,
    unrealisedPct: pct(gain, basis),
  };
};

export interface Realised {
  rows: number;
  units: number;
  /** Everything sold rows fetched, cost recorded or not. */
  revenue: number;
  /** TCGo's fees across those sales. */
  fees: number;
  /** revenue − fees: what actually reached the seller. */
  net: number;
  /** Revenue over the rows that have a cost — what `marginPct` is measured against. */
  costedRevenue: number;
  /** Net over those same rows — what `profit` is measured from. */
  costedNet: number;
  cost: number;
  profit: number;
  costedRows: number;
  missingCostRows: number;
  /** profit / costedRevenue, as a percentage; null when nothing costed sold. */
  marginPct: number | null;
}

export const EMPTY_REALISED: Realised = {
  rows: 0,
  units: 0,
  revenue: 0,
  fees: 0,
  net: 0,
  costedRevenue: 0,
  costedNet: 0,
  cost: 0,
  profit: 0,
  costedRows: 0,
  missingCostRows: 0,
  marginPct: null,
};

/** When a row sold. Hand-marked rows from before soldAt existed fall back. */
const soldTime = (row: PortfolioRow): number => Number(row.soldAt ?? row.updatedAt) || 0;

/**
 * Profit on what has sold since `since` (ms epoch; 0 = all time). Revenue is
 * everything sold; profit and margin only cover rows whose cost is known,
 * and the rest are counted so the UI can ask for them. Fees come off every
 * row, costed or not, so `net` is what actually reached the seller.
 */
export const summariseRealised = (rows: PortfolioRow[], since = 0): Realised => {
  let count = 0;
  let units = 0;
  let revenue = 0;
  let fees = 0;
  let costedRevenue = 0;
  let costedNet = 0;
  let cost = 0;
  let costedRows = 0;
  let missingCostRows = 0;

  for (const row of rows) {
    if (!isSold(row)) continue;
    if (since > 0 && soldTime(row) < since) continue;
    count++;
    const n = unitsOf(row);
    units += n;
    const gross = realisedUnitPrice(row) * n;
    const fee = feeOf(row) * n;
    revenue += gross;
    fees += fee;
    if (hasCost(row)) {
      costedRows++;
      costedRevenue += gross;
      costedNet += gross - fee;
      cost += row.costPrice * n;
    } else {
      missingCostRows++;
    }
  }

  const costedRev = round2(costedRevenue);
  const costedNetR = round2(costedNet);
  const totalCost = round2(cost);
  const profit = round2(costedNetR - totalCost);
  return {
    rows: count,
    units,
    revenue: round2(revenue),
    fees: round2(fees),
    net: round2(revenue - fees),
    costedRevenue: costedRev,
    costedNet: costedNetR,
    cost: totalCost,
    profit,
    costedRows,
    missingCostRows,
    marginPct: pct(profit, costedRev),
  };
};

export interface RealisedPeriods {
  last30: Realised;
  allTime: Realised;
}

export const realisedByPeriod = (
  rows: PortfolioRow[],
  now = Date.now(),
): RealisedPeriods => ({
  // Same window as the sales page: today plus the 29 days before it.
  last30: summariseRealised(rows, startOfDayMs(29, now)),
  allTime: summariseRealised(rows),
});

export interface Basket {
  productIds: number[];
  quantities: Map<number, number>;
  /** Stable across row order; changes only when the priced basket changes. */
  key: string;
}

/**
 * The held rows with a catalog match, collapsed per product with units
 * summed — two rows of one card weigh the trend as two copies. `key` lets a
 * caller refetch prices only when this changes, not on every edit to a row.
 */
export const basketOf = (rows: PortfolioRow[]): Basket => {
  const quantities = new Map<number, number>();
  for (const row of rows) {
    if (!isHeld(row)) continue;
    if (row.productId == null || !Number.isFinite(row.productId)) continue;
    quantities.set(row.productId, (quantities.get(row.productId) ?? 0) + unitsOf(row));
  }
  const productIds = [...quantities.keys()].sort((a, b) => a - b);
  return {
    productIds,
    quantities,
    key: productIds.map((id) => `${id}:${quantities.get(id)}`).join(","),
  };
};

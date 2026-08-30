// Aggregating counter sales for the seller's sales page.
//
// Pure and separate from the route so the arithmetic can be tested without a
// database. It matters more than it looks: `subtotal` is what the labels said
// and `total` is what was actually taken, so getting the two confused would
// either hide the margin a seller is giving away or invent revenue they never
// received.

import type { PosSale, PosPaymentMethod, PosSaleStatus } from "~/shared/pos-sale";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SalesTotals {
  saleCount: number;
  itemCount: number;
  /** What the labels asked for. */
  subtotal: number;
  /** What was actually taken. */
  total: number;
  /** subtotal − total: margin handed over at the counter. */
  discountTotal: number;
  /** Lines sold below their asking price. */
  discountedLines: number;
  averageSale: number;
}

export const EMPTY_TOTALS: SalesTotals = {
  saleCount: 0,
  itemCount: 0,
  subtotal: 0,
  total: 0,
  discountTotal: 0,
  discountedLines: 0,
  averageSale: 0,
};

/**
 * Totals for a set of sales.
 *
 * Only counts what was actually paid — an abandoned QR sale sitting in
 * `awaiting_payment` is not revenue, and counting it would overstate a day's
 * takings in the one report a seller uses to reconcile their cash drawer.
 */
export const summariseSales = (sales: PosSale[]): SalesTotals => {
  const paid = sales.filter((s) => s.status === "paid");
  if (!paid.length) return { ...EMPTY_TOTALS };

  let subtotal = 0;
  let total = 0;
  let itemCount = 0;
  let discountedLines = 0;

  for (const s of paid) {
    subtotal += s.subtotal || 0;
    total += s.total || 0;
    itemCount += s.lines?.length || 0;
    for (const l of s.lines ?? []) {
      if ((l.listPrice || 0) - (l.soldPrice || 0) > 0.005) discountedLines++;
    }
  }

  return {
    saleCount: paid.length,
    itemCount,
    subtotal: round2(subtotal),
    total: round2(total),
    // Recomputed from the rounded pair rather than summed per sale, so the
    // three figures on screen always reconcile with each other.
    discountTotal: round2(Math.max(0, round2(subtotal) - round2(total))),
    discountedLines,
    averageSale: round2(round2(total) / paid.length),
  };
};

/** Start of the local day, `daysAgo` days back. */
export const startOfDayMs = (daysAgo = 0, now = Date.now()): number => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - daysAgo * 86_400_000;
};

export interface SalesPeriods {
  today: SalesTotals;
  last7: SalesTotals;
  last30: SalesTotals;
  allTime: SalesTotals;
}

export const summariseByPeriod = (
  sales: PosSale[],
  now = Date.now(),
): SalesPeriods => {
  const since = (days: number) =>
    sales.filter((s) => (s.paidAt ?? s.createdAt) >= startOfDayMs(days, now));
  return {
    today: summariseSales(since(0)),
    last7: summariseSales(since(6)),
    last30: summariseSales(since(29)),
    allTime: summariseSales(sales),
  };
};

export const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  duitnow_qr: "DuitNow QR",
  tap_to_pay: "Tap to Pay",
  // Marketplace checkout. Not a POS method, but it shares the takings split
  // so a seller can see both channels in one column.
  online: "Marketplace",
};

export const STATUS_LABELS: Record<PosSaleStatus, string> = {
  paid: "Paid",
  awaiting_payment: "Awaiting payment",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Takings split by how the customer paid — the cash-drawer reconciliation. */
export const summariseByMethod = (
  sales: PosSale[],
): { method: string; label: string; count: number; total: number }[] => {
  const byMethod = new Map<string, { count: number; total: number }>();
  for (const s of sales) {
    if (s.status !== "paid") continue;
    const m = (s.method || "cash") as string;
    const cur = byMethod.get(m) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += s.total || 0;
    byMethod.set(m, cur);
  }
  return [...byMethod.entries()]
    .map(([method, v]) => ({
      method,
      label: METHOD_LABELS[method] ?? method,
      count: v.count,
      total: round2(v.total),
    }))
    .sort((a, b) => b.total - a.total);
};

/** Best-selling cards across the window, for the "what moves" panel. */
export const topCards = (
  sales: PosSale[],
  limit = 5,
): { cardName: string; count: number; total: number; image: string }[] => {
  const byCard = new Map<string, { count: number; total: number; image: string }>();
  for (const s of sales) {
    if (s.status !== "paid") continue;
    for (const l of s.lines ?? []) {
      const cur = byCard.get(l.cardName) ?? { count: 0, total: 0, image: l.image || "" };
      cur.count++;
      cur.total += l.soldPrice || 0;
      if (!cur.image && l.image) cur.image = l.image;
      byCard.set(l.cardName, cur);
    }
  }
  return [...byCard.entries()]
    .map(([cardName, v]) => ({ cardName, ...v, total: round2(v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};

// The stock value card and the profit column are read as money. The rules
// worth pinning: an unrecorded cost is never treated as zero, the headline
// value only ever contains market prices, and unrealised gain is measured
// over the same rows on both sides.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  basketOf,
  realisedByPeriod,
  realisedUnitPrice,
  rowProfit,
  summariseRealised,
  valueHoldings,
  type PortfolioRow,
} from "~/shared/portfolio";

const row = (over: Partial<PortfolioRow> = {}): PortfolioRow => ({
  productId: 1,
  quantity: 1,
  listPrice: 100,
  status: "in_stock",
  ...over,
});
const market = (entries: Array<[number, number]>) => new Map(entries);

describe("valueHoldings", () => {
  it("prices held rows at market × units and leaves sold rows out", () => {
    const h = valueHoldings(
      [
        row({ productId: 1, quantity: 2 }),
        row({ productId: 2, status: "listed" }),
        row({ productId: 3, status: "reserved" }),
        row({ productId: 1, status: "sold", soldPrice: 60 }),
      ],
      market([
        [1, 50],
        [2, 80],
        [3, 10],
      ]),
    );
    assert.equal(h.rows, 3);
    assert.equal(h.units, 4);
    assert.equal(h.marketValue, 190);
    assert.equal(h.pricedRows, 3);
    assert.equal(h.unpricedRows, 0);
  });

  it("reports unpriced rows beside the headline, never inside it", () => {
    const h = valueHoldings(
      [
        row({ productId: 1, listPrice: 30 }),
        row({ productId: null, listPrice: 40 }),
        row({ productId: 9, listPrice: 25, quantity: 2 }),
      ],
      market([[1, 30]]),
    );
    assert.equal(h.marketValue, 30);
    assert.equal(h.unpricedRows, 2);
    assert.equal(h.unpricedAskingValue, 90);
  });

  it("measures unrealised gain only over rows with both a cost and a price", () => {
    const h = valueHoldings(
      [
        row({ productId: 1, costPrice: 40 }),
        row({ productId: 2, costPrice: 10 }),
        row({ productId: 3 }),
      ],
      market([
        [1, 100],
        [3, 500],
      ]),
    );
    assert.equal(h.marketValue, 600);
    assert.equal(h.costBasis, 40);
    assert.equal(h.costedMarketValue, 100);
    assert.equal(h.unrealisedGain, 60);
    assert.equal(h.unrealisedPct, 150);
    assert.equal(h.costedRows, 1);
    assert.equal(h.missingCostRows, 1);
  });

  it("treats zero as a real cost and a missing cost as unknown", () => {
    const h = valueHoldings(
      [row({ costPrice: 0 }), row({ costPrice: null }), row({})],
      market([[1, 20]]),
    );
    assert.equal(h.costedRows, 1);
    assert.equal(h.missingCostRows, 2);
    assert.equal(h.costBasis, 0);
    assert.equal(h.unrealisedGain, 20);
    assert.equal(h.unrealisedPct, null);
  });

  it("rounds money once, at the end", () => {
    const h = valueHoldings(
      [row({ quantity: 3, costPrice: 0.1 }), row({ costPrice: 0.2 })],
      market([[1, 0.1]]),
    );
    assert.equal(h.marketValue, 0.4);
    assert.equal(h.costBasis, 0.5);
    assert.equal(h.unrealisedGain, -0.1);
  });
});

describe("rowProfit", () => {
  it("is sold price less cost, per unit", () => {
    assert.equal(
      rowProfit(row({ status: "sold", soldPrice: 150, costPrice: 100, quantity: 2 })),
      100,
    );
  });

  it("is unknown for held rows and for sold rows without a cost", () => {
    assert.equal(rowProfit(row({ costPrice: 10 })), null);
    assert.equal(rowProfit(row({ status: "sold", soldPrice: 150 })), null);
  });

  it("falls back to the asking price when no sold price was recorded", () => {
    assert.equal(realisedUnitPrice(row({ status: "sold", soldPrice: null })), 100);
    assert.equal(rowProfit(row({ status: "sold", costPrice: 60 })), 40);
  });
});

describe("summariseRealised", () => {
  const sold = [
    row({ status: "sold", soldPrice: 120, costPrice: 80, soldAt: 1000 }),
    row({ status: "sold", soldPrice: 50, costPrice: 70, soldAt: 2000 }),
    row({ status: "sold", soldPrice: 200, soldAt: 3000 }),
    row({ status: "in_stock", costPrice: 5 }),
  ];

  it("counts every sale in revenue but only costed sales in profit", () => {
    const r = summariseRealised(sold);
    assert.equal(r.rows, 3);
    assert.equal(r.revenue, 370);
    assert.equal(r.costedRevenue, 170);
    assert.equal(r.cost, 150);
    assert.equal(r.profit, 20);
    assert.equal(r.costedRows, 2);
    assert.equal(r.missingCostRows, 1);
  });

  it("measures margin against the revenue it can actually explain", () => {
    assert.equal(summariseRealised(sold).marginPct, 11.8);
  });

  it("has no margin when nothing costed has sold", () => {
    assert.equal(summariseRealised([sold[2]!]).marginPct, null);
  });

  it("respects the window by sold time", () => {
    const r = summariseRealised(sold, 2000);
    assert.equal(r.rows, 2);
    assert.equal(r.profit, -20);
  });
});

describe("realisedByPeriod", () => {
  it("splits the last 30 days from all time", () => {
    const now = Date.now();
    const day = 86_400_000;
    const rows = [
      row({ status: "sold", soldPrice: 110, costPrice: 100, soldAt: now - 5 * day }),
      row({ status: "sold", soldPrice: 130, costPrice: 100, soldAt: now - 40 * day }),
      // Hand-marked before soldAt existed: only its updatedAt says when.
      row({ status: "sold", soldPrice: 105, costPrice: 100, updatedAt: now - day }),
    ];
    const p = realisedByPeriod(rows, now);
    assert.equal(p.last30.rows, 2);
    assert.equal(p.last30.profit, 15);
    assert.equal(p.allTime.rows, 3);
    assert.equal(p.allTime.profit, 45);
  });
});

describe("basketOf", () => {
  it("collapses held rows per product with units summed, in a stable order", () => {
    const a = basketOf([
      row({ productId: 2 }),
      row({ productId: 1, quantity: 2 }),
      row({ productId: 1 }),
      row({ productId: 3, status: "sold" }),
      row({ productId: null }),
    ]);
    assert.deepEqual(a.productIds, [1, 2]);
    assert.equal(a.quantities.get(1), 3);
    assert.equal(a.key, "1:3,2:1");

    const b = basketOf([
      row({ productId: 1 }),
      row({ productId: 1, quantity: 2 }),
      row({ productId: 2 }),
    ]);
    assert.equal(b.key, a.key);
  });
});

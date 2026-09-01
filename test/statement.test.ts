// What the seller reads, and what the platform books.
//
// The settlement statement is the screen sellers trust least, so the shape of
// it is tested as tightly as the arithmetic: an earlier version opened with
// the buyer's total and read as though RM 6 had been taken from the seller.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  settlementLines,
  shippingNote,
  rateCharged,
  feeCharged,
  payoutAmount,
} from "~/shared/settlement";

import {
  summariseFinance,
  isSettled,
  courierCost,
  shippingRevenue,
  posPlatformRevenue,
  isSettledPosSale,
  BILLPLZ_FPX_FEE,
} from "~/shared/finance";

import {
  isOpenParcel,
  closedReason,
  findOpenParcel,
  JOIN_FEE_MYR,
} from "~/shared/order-joining";

import { buyerShippingPrice, SHIPPING_BUFFER_MYR } from "~/shared/shipping-quote";
import { posTotals, lineDiscount, recordedPosFee, toSen } from "~/shared/pos-sale";

const platformBooked = {
  subtotal: 100,
  shipping: 6,
  total: 106,
  platformFee: 4,
  platformFeeRate: 0.04,
  sellerPayout: 96,
  shipmentOrderNo: "DLV1",
};

describe("settlement statement", () => {
  const lines = settlementLines(platformBooked);

  it("opens at the sale, never at what the buyer paid", () => {
    assert.equal(lines[0]!.label, "Card sold");
    assert.equal(lines[0]!.amount, 100);
    assert.ok(
      !lines.some((l) => l.amount === 106),
      "the buyer's total must not appear — it was never the seller's money",
    );
  });

  it("ends at what reaches the bank", () => {
    const last = lines.at(-1)!;
    assert.equal(last.kind, "total");
    assert.equal(last.amount, 96);
  });

  it("adds up", () => {
    const body = lines.filter((l) => l.kind !== "total" && l.kind !== "sub");
    const sum = body.reduce((t, l) => t + l.amount, 0);
    assert.equal(Math.round(sum * 100) / 100, payoutAmount(platformBooked));
  });

  it("shows the fee's two halves summing to the fee", () => {
    const subs = lines.filter((l) => l.kind === "sub");
    assert.equal(subs.length, 2);
    const sum = Math.round(subs.reduce((t, l) => t + l.amount, 0) * 100) / 100;
    assert.equal(sum, -feeCharged(platformBooked));
  });

  it("keeps the buyer's postage out of the statement, as a footnote", () => {
    assert.ok(
      !lines.some((l) => l.label.toLowerCase().includes("shipping")),
      "postage the platform paid is not a seller deduction",
    );
    assert.match(shippingNote(platformBooked), /RM 6\.00/);
  });

  it("reimburses postage as a credit when the seller bought the label", () => {
    const { shipmentOrderNo, ...sellerShipped } = platformBooked;
    const l = settlementLines({ ...sellerShipped, sellerPayout: 102 });
    const credit = l.find((x) => x.kind === "credit");
    assert.ok(credit, "seller-paid postage must come back to them");
    assert.equal(credit!.amount, 6);
    assert.equal(shippingNote(sellerShipped), "");
  });
});

describe("the rate shown on a statement", () => {
  it("reads the recorded rate rather than dividing a rounded fee", () => {
    // The 1.79% bug: 2% of RM 1.12 stores as RM 0.02 and divides back wrong.
    const tiny = { subtotal: 1.12, platformFee: 0.02, platformFeeRate: 0.02 };
    assert.equal(rateCharged(tiny), 2);
  });

  it("snaps a legacy order to the rate it was really charged", () => {
    assert.equal(rateCharged({ subtotal: 1.12, platformFee: 0.02 }), 2);
  });

  it("shows an unrecognised rate as-is rather than inventing one", () => {
    const blended = { subtotal: 100, platformFee: 3.3 };
    assert.equal(rateCharged(blended), 3.3);
  });
});

describe("platform finance", () => {
  it("counts only settled online orders", () => {
    assert.equal(isSettled({ paymentMethod: "billplz", status: "paid" }), true);
    assert.equal(isSettled({ paymentMethod: "billplz", status: "pending" }), false);
    assert.equal(isSettled({ paymentMethod: "cash", status: "paid" }), false);
  });

  it("never books postage or courier cost when the seller shipped it", () => {
    const sellerShipped = { shipping: 6, shippingQuotedRate: 4.76 };
    assert.equal(shippingRevenue(sellerShipped), 0);
    assert.equal(courierCost(sellerShipped), 0);
  });

  it("does not subtract the courier twice", () => {
    const s = summariseFinance(
      [{ ...platformBooked, paymentMethod: "billplz", status: "paid", shippingQuotedRate: 4.76 }],
      [],
    );
    // postage is revenue gross; the courier is a separate cost line
    assert.equal(s.shippingRevenue, 6);
    assert.equal(s.courierCost, 4.76);
    assert.equal(s.shippingMargin, 1.24);
    assert.equal(s.revenue, 4 + 6);
    assert.equal(s.costs, 4.76 + BILLPLZ_FPX_FEE);
  });

  it("treats GMV as the seller's money, never revenue", () => {
    const s = summariseFinance(
      [{ paymentMethod: "billplz", status: "paid", subtotal: 5000, platformFee: 200 }],
      [],
    );
    assert.equal(s.gmv, 5000);
    assert.ok(s.revenue < 250, "GMV must never leak into revenue");
  });

  it("counts the counter fee but not counter volume", () => {
    const s = summariseFinance([], [], { pro: 0 }, () => "free", [
      { status: "paid", method: "duitnow_qr", total: 250, platformFee: 2 },
      { status: "paid", method: "cash", total: 80, platformFee: 0 },
      { status: "failed", method: "duitnow_qr", total: 999, platformFee: 7.99 },
    ]);
    assert.equal(s.posSaleCount, 2, "a failed sale took no money");
    assert.equal(s.posVolume, 330);
    assert.equal(s.posRevenue, 2, "cash is charged nothing");
    assert.equal(s.revenue, 2);
  });

  it("reads zero counter fee for rows written before the fee existed", () => {
    assert.equal(posPlatformRevenue({ total: 500 }), 0);
    assert.equal(isSettledPosSale({ status: "paid" }), true);
    assert.equal(isSettledPosSale({ status: "awaiting_payment" }), false);
  });

  it("cancels the payout cost against the withdrawal fee", () => {
    const s = summariseFinance([], [
      { status: "paid", amount: 98.75, withdrawalFee: 1.25, executedAt: 1, autoPayoutSupported: true },
    ]);
    assert.equal(s.withdrawalFeeRevenue, s.billplzPayoutFees);
    assert.equal(s.netProfit, 0);
  });

  it("charges no payout fee for a batch that was never sent", () => {
    const s = summariseFinance([], [{ status: "queued", amount: 50 }]);
    assert.equal(s.billplzPayoutFees, 0);
  });
});

describe("the parcel-joining window", () => {
  const open = { status: "paid", buyerUid: "b1", sellerUid: "s1" };

  it("is open while the money is in and no label exists", () => {
    assert.equal(isOpenParcel(open), true);
    assert.equal(closedReason(open), null);
  });

  it("closes the moment a waybill exists", () => {
    const labelled = { ...open, shipmentOrderNo: "DLV1" };
    assert.equal(isOpenParcel(labelled), false);
    assert.match(closedReason(labelled)!, /waybill/i);
  });

  it("treats a booking in flight as closed, not as 'not yet'", () => {
    assert.equal(isOpenParcel({ ...open, shipmentClaimedAt: Date.now() }), false);
  });

  it("never joins auctions or a payment under review", () => {
    assert.equal(isOpenParcel({ ...open, auctionId: "a1" }), false);
    assert.equal(isOpenParcel({ ...open, paymentAmountMismatch: true }), false);
  });

  it("picks the oldest parcel to the same seller and address", () => {
    const orders = [
      { ...open, id: "new", createdAt: 200, addr: "A" },
      { ...open, id: "old", createdAt: 100, addr: "A" },
      { ...open, id: "elsewhere", createdAt: 50, addr: "B" },
    ];
    const found = findOpenParcel(orders, { sellerUid: "s1", addressKey: "A" }, (o) => o.addr);
    assert.equal(found?.id, "old");
  });

  it("does not join a different seller's parcel", () => {
    const orders = [{ ...open, id: "x", createdAt: 1, addr: "A" }];
    assert.equal(
      findOpenParcel(orders, { sellerUid: "other", addressKey: "A" }, (o) => o.addr),
      null,
    );
  });
});

describe("what the buyer is quoted for postage", () => {
  it("adds the buffer then rounds up to 50 sen", () => {
    assert.equal(buyerShippingPrice(5.0), 6.0);
    assert.equal(buyerShippingPrice(4.76), 6.0);
    assert.equal(buyerShippingPrice(5.6), 7.0);
    assert.equal(buyerShippingPrice(10.9), 12.0);
  });

  it("never quotes below the courier's own rate", () => {
    for (const raw of [2, 4.76, 5.6, 9.99, 23.4, 88.5]) {
      assert.ok(
        buyerShippingPrice(raw) >= raw + SHIPPING_BUFFER_MYR - 0.001,
        `RM ${raw} quoted below cost`,
      );
    }
  });

  it("returns nothing for a nonsense rate", () => {
    assert.equal(buyerShippingPrice(0), 0);
    assert.equal(buyerShippingPrice(-3), 0);
    assert.equal(buyerShippingPrice(NaN), 0);
  });

  it("stays cheaper to join than to ship again", () => {
    assert.ok(JOIN_FEE_MYR < buyerShippingPrice(4.76));
  });
});

describe("counter sale totals", () => {
  const lines = [
    { listPrice: 50, soldPrice: 45 },
    { listPrice: 20, soldPrice: 20 },
  ];

  it("separates what the labels said from what was charged", () => {
    const t = posTotals(lines);
    assert.equal(t.subtotal, 70);
    assert.equal(t.total, 65);
    assert.equal(t.discountTotal, 5);
    assert.equal(t.discountedCount, 1);
  });

  it("does not treat an upsell as a negative discount", () => {
    assert.equal(lineDiscount({ listPrice: 20, soldPrice: 25 }), 0);
    assert.equal(posTotals([{ listPrice: 20, soldPrice: 25 }]).discountTotal, 0);
  });

  it("reads no fee for a sale taken before the counter fee existed", () => {
    assert.equal(recordedPosFee({}), 0);
    assert.equal(recordedPosFee({ platformFee: 0.8 }), 0.8);
  });

  it("converts to sen without float drift", () => {
    assert.equal(toSen(0.1 + 0.2), 30);
    assert.equal(toSen(19.99), 1999);
  });
});

// What a sale costs, and what a seller is left with.
//
// These are not coverage tests. Every case here is a bug that actually
// happened, or one the code carries a comment warning about — the point is
// that the warning is enforced rather than merely written down.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PLANS,
  STANDARD_RATE,
  BETA_RATE,
  BETA_PRICING,
  SST_REGISTERED,
  effectiveRate,
  planById,
  sstOn,
  splitFee,
  posPlatformFee,
  POS_PLATFORM_RATE,
  POS_PROVIDER_RATE,
  POS_ALL_IN_RATE,
  WITHDRAWAL_FEE,
} from "~/shared/pricing";

import {
  platformFeeFor,
  computeSellerPayout,
  recordedFee,
  recordedSst,
  recordedPayout,
  shippingReimbursement,
  isPayoutEligible,
  PAYOUT_HOLD_MS,
} from "~/shared/payouts";

import { BILLPLZ_FPX_FEE, BILLPLZ_PAYOUT_FEE } from "~/shared/finance";
import { JOIN_FEE_MYR } from "~/shared/order-joining";

describe("plans", () => {
  it("charges one commission rate on every plan", () => {
    const rates = new Set(PLANS.map((p) => p.rate));
    assert.equal(rates.size, 1, "a plan must never buy a cheaper rate");
    assert.equal(effectiveRate("free"), effectiveRate("pro"));
  });

  it("falls back to Free for a plan id that no longer exists", () => {
    // A user doc left carrying `plan: "vendor"` must be inert, not a crash.
    assert.equal(planById("vendor").id, "free");
    assert.equal(planById(undefined).id, "free");
    assert.equal(effectiveRate(undefined as never), STANDARD_RATE);
  });
});

describe("commission is history, not a live constant", () => {
  // The trap: reading today's rate to describe a sale that already settled.
  // Flipping BETA_PRICING would have re-priced every beta order at 4%.
  const betaOrder = { subtotal: 100, platformFee: 2, platformFeeRate: 0.02 };

  it("reports the fee that was charged, not today's", () => {
    assert.equal(recordedFee(betaOrder), 2);
    assert.notEqual(recordedFee(betaOrder), platformFeeFor(betaOrder));
  });

  it("pays out the amount that was recorded", () => {
    const settled = { subtotal: 100, platformFee: 2, sellerPayout: 98 };
    assert.equal(recordedPayout(settled), 98);
  });

  it("only derives for an order predating the fields", () => {
    assert.equal(recordedFee({ subtotal: 100 }), 100 * STANDARD_RATE);
  });
});

describe("SST", () => {
  it("is not charged before registration", () => {
    assert.equal(SST_REGISTERED, false);
    assert.equal(sstOn(100), 0);
  });

  it("reads ZERO for an order with no recorded tax, never a fresh sum", () => {
    // The retro-tax trap: deriving here would hand every pre-registration
    // order an 8% bill the day SST_REGISTERED flips.
    assert.equal(recordedSst({ subtotal: 1000 }), 0);
    assert.equal(recordedSst({ subtotal: 1000, sstAmount: 0 }), 0);
    assert.equal(recordedSst({ subtotal: 1000, sstAmount: 3.2 }), 3.2);
  });
});

describe("shipping reimbursement", () => {
  it("pays postage back only when the seller bought the label", () => {
    assert.equal(shippingReimbursement({ shipping: 6 }), 6);
    assert.equal(
      shippingReimbursement({ shipping: 6, shipmentOrderNo: "DLV1" }),
      0,
      "reimbursing postage the platform already paid pays it twice",
    );
  });

  it("does not double-pay postage on a platform-booked order", () => {
    const order = { subtotal: 100, shipping: 6, shipmentOrderNo: "DLV1" };
    assert.equal(computeSellerPayout(order), 100 - 100 * STANDARD_RATE);
  });
});

describe("the fee split shown on a statement", () => {
  it("always sums to the fee exactly", () => {
    for (const fee of [0.05, 0.03, 4, 6.13, 0.01, 123.45]) {
      const { processing, platform } = splitFee(fee);
      assert.equal(
        Math.round((processing + platform) * 100) / 100,
        fee,
        `halves of ${fee} must add back up`,
      );
    }
  });
});

describe("payout eligibility", () => {
  const now = Date.now();
  const delivered = {
    paymentMethod: "billplz",
    status: "delivered",
    deliveredAt: now - PAYOUT_HOLD_MS - 1000,
    sellerPayout: 50,
  };

  it("releases funds after the hold", () => {
    assert.equal(isPayoutEligible(delivered, now), true);
  });

  it("holds them before it elapses", () => {
    assert.equal(
      isPayoutEligible({ ...delivered, deliveredAt: now - 1000 }, now),
      false,
    );
  });

  it("never releases counter or manual sales", () => {
    assert.equal(
      isPayoutEligible({ ...delivered, paymentMethod: "cash" }, now),
      false,
    );
  });
});

describe("no rail loses money", () => {
  // The buffer covers collection; the withdrawal fee covers the payout.
  const BUFFER = 1.24; // typical: RM 4.76 courier quoted to the buyer at 6.00

  it("recovers the payout cost exactly, without earning on it", () => {
    assert.equal(WITHDRAWAL_FEE, BILLPLZ_PAYOUT_FEE);
  });

  it("keeps a joined order as profitable as a standalone one", () => {
    // At RM 1.00 the join fee sat under the collection fee, which put
    // break-even at RM 6.25 and 38 of 113 live listings underwater.
    assert.ok(
      JOIN_FEE_MYR >= BILLPLZ_FPX_FEE,
      `join fee ${JOIN_FEE_MYR} must cover the ${BILLPLZ_FPX_FEE} it costs to collect`,
    );
    const breakEven = (BILLPLZ_FPX_FEE - JOIN_FEE_MYR) / STANDARD_RATE;
    assert.ok(breakEven <= 0, "every joined order should clear its own cost");
  });

  it("leaves a standalone order profitable at any price", () => {
    const breakEven = (BILLPLZ_FPX_FEE - BUFFER) / STANDARD_RATE;
    assert.ok(breakEven < 0.5, `break-even drifted to RM ${breakEven}`);
  });
});

describe("the counter", () => {
  it("adds up to the round number the shop is quoted", () => {
    assert.equal(POS_PLATFORM_RATE + POS_PROVIDER_RATE, POS_ALL_IN_RATE);
    assert.equal(Math.round(POS_ALL_IN_RATE * 1000) / 1000, 0.02);
  });

  it("rounds the fee to the sen HitPay will deduct", () => {
    assert.equal(posPlatformFee(100), 0.8);
    assert.equal(posPlatformFee(37.5), 0.3);
    assert.equal(posPlatformFee(12.34), 0.1);
  });

  it("never returns a negative or NaN fee", () => {
    assert.equal(posPlatformFee(0), 0);
    assert.equal(posPlatformFee(-50), 0);
  });
});

describe("beta is over", () => {
  it("charges the launch rate", () => {
    assert.equal(BETA_PRICING, false);
    assert.equal(effectiveRate("free"), STANDARD_RATE);
    assert.notEqual(STANDARD_RATE, BETA_RATE);
  });
});

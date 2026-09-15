// The 30-minute window: buyer can cancel inside it, seller can book after it.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CANCEL_GRACE_MS,
  canBookCourier,
  canBuyerCancel,
  graceEndsAt,
  minutesUntil,
} from "~/shared/order-windows";

const paidAt = 1_000_000_000_000;
const order = { status: "paid", paidAt, createdAt: paidAt - 60_000 };

describe("the cancellation grace period", () => {
  it("lets the buyer cancel for 30 minutes after payment", () => {
    assert.equal(canBuyerCancel(order, paidAt), true);
    assert.equal(canBuyerCancel(order, paidAt + CANCEL_GRACE_MS - 1), true);
  });

  it("closes at 30 minutes", () => {
    assert.equal(canBuyerCancel(order, paidAt + CANCEL_GRACE_MS), false);
  });

  it("counts from payment, not creation", () => {
    assert.equal(graceEndsAt(order), paidAt + CANCEL_GRACE_MS);
    assert.equal(graceEndsAt({ createdAt: 5 }), 5 + CANCEL_GRACE_MS, "falls back to creation");
  });

  it("never allows cancelling once a label is booked, or outside paid states", () => {
    assert.equal(canBuyerCancel({ ...order, shipmentOrderNo: "DLV1" }, paidAt), false);
    for (const status of ["pending", "shipped", "delivered", "cancelled"]) {
      assert.equal(canBuyerCancel({ ...order, status }, paidAt), false, status);
    }
  });
});

describe("courier booking", () => {
  it("is locked while the buyer can still cancel", () => {
    assert.equal(canBookCourier(order, paidAt + CANCEL_GRACE_MS - 1), false);
  });

  it("opens the moment the cancellation window closes — never both at once", () => {
    for (const t of [paidAt, paidAt + CANCEL_GRACE_MS - 1, paidAt + CANCEL_GRACE_MS, paidAt + CANCEL_GRACE_MS + 1]) {
      assert.notEqual(canBuyerCancel(order, t), canBookCourier(order, t), `at +${t - paidAt}ms`);
    }
  });

  it("is not blocked for an order with no timestamps", () => {
    assert.equal(canBookCourier({ status: "paid" }), true);
  });
});

describe("minutes left", () => {
  it("rounds up and never goes negative", () => {
    assert.equal(minutesUntil(paidAt + 61_000, paidAt), 2);
    assert.equal(minutesUntil(paidAt - 1, paidAt), 0);
    assert.equal(minutesUntil(null, paidAt), 0);
  });
});

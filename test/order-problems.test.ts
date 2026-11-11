// "Report a problem": who can raise one, when, and what it does to payouts.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CLAIM_WINDOW_MS,
  canReportProblem,
  problemActionsFor,
  validateProblemReport,
} from "~/shared/order-problems";
import { isPayoutEligible, PAYOUT_HOLD_MS } from "~/shared/payouts";

const DAY = 24 * 60 * 60 * 1000;
const delivered = (deliveredAt: number, extra: Record<string, unknown> = {}) => ({
  status: "delivered",
  paymentMethod: "billplz",
  deliveredAt,
  subtotal: 100,
  sellerPayout: 96,
  ...extra,
});

describe("reporting a problem", () => {
  it("is open for the claim window after delivery, then closes", () => {
    const now = 1_000 * DAY;
    assert.equal(canReportProblem(delivered(now - DAY), now).ok, true);
    assert.equal(canReportProblem(delivered(now - CLAIM_WINDOW_MS - 1), now).ok, false);
  });

  it("matches the payout hold, so a report always beats the payout", () => {
    assert.equal(CLAIM_WINDOW_MS, PAYOUT_HOLD_MS);
  });

  it("is refused once the seller has been paid, or a problem exists", () => {
    const now = 1_000 * DAY;
    assert.equal(canReportProblem(delivered(now, { payoutStatus: "paid" }), now).ok, false);
    assert.equal(canReportProblem(delivered(now, { problem: { status: "resolved" } }), now).ok, false);
  });

  it("points a buyer still inside the cancel window to cancelling instead", () => {
    const now = 1_000 * DAY;
    const paid = { status: "paid", paymentMethod: "billplz", paidAt: now - 60_000 };
    assert.equal(canReportProblem(paid, now).ok, false);
    assert.equal(canReportProblem({ ...paid, paidAt: now - DAY }, now).ok, true);
  });

  it("doesn't cover orders paid outside TCGo", () => {
    assert.equal(canReportProblem({ status: "delivered", paymentMethod: "manual" }).ok, false);
  });

  it("needs a reason and some detail", () => {
    assert.ok(validateProblemReport({ reasonCode: "", details: "long enough text" }));
    assert.ok(validateProblemReport({ reasonCode: "damaged", details: "short" }));
    assert.equal(validateProblemReport({ reasonCode: "damaged", details: "Corner is bent badly" }), null);
  });
});

describe("while a problem is open", () => {
  it("holds the seller's payout", () => {
    const now = 1_000 * DAY;
    const o = delivered(now - 10 * DAY);
    assert.equal(isPayoutEligible(o as any, now), true);
    assert.equal(isPayoutEligible({ ...o, problem: { status: "open" } } as any, now), false);
    assert.equal(isPayoutEligible({ ...o, problem: { status: "escalated" } } as any, now), false);
    assert.equal(isPayoutEligible({ ...o, problem: { status: "resolved" } } as any, now), true);
    assert.equal(isPayoutEligible({ ...o, problem: { status: "refunded" }, refundStatus: "pending" } as any, now), false);
  });

  it("lets each side do only their part", () => {
    assert.deepEqual(problemActionsFor({ status: "open" }, "seller"), ["reply", "agree_refund", "escalate"]);
    assert.deepEqual(problemActionsFor({ status: "open" }, "buyer"), ["reply", "resolve", "escalate"]);
    assert.deepEqual(problemActionsFor({ status: "refunded" }, "buyer"), []);
  });
});

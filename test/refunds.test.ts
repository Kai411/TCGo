// The buyer's refund form: what a buyer must give us for the money to go back.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CANCEL_REASONS,
  REFUND_FEE_MIN,
  REFUND_FEE_RATE,
  checkIc,
  maskTail,
  refundBreakdown,
  toRefundRecipient,
  validateRefundForm,
} from "~/shared/refunds";

const valid = {
  reasonCode: "changed_mind",
  reasonNote: "",
  holderName: "Tan Ah Kow",
  identityNumber: "900101-14-5678",
  bankCode: "MBBEMYKL",
  bankAccountNumber: "5123 4567 8901",
};

describe("the refund form", () => {
  it("accepts a complete form", () => {
    assert.deepEqual(validateRefundForm(valid), {});
  });

  it("requires every field", () => {
    const errors = validateRefundForm({});
    for (const f of ["reasonCode", "holderName", "identityNumber", "bankCode", "bankAccountNumber"]) {
      assert.ok(errors[f as keyof typeof errors], `${f} should be required`);
    }
  });

  it("offers Other, and requires a note when it's chosen", () => {
    assert.ok(CANCEL_REASONS.some((r) => r.code === "other"));
    assert.ok(validateRefundForm({ ...valid, reasonCode: "other", reasonNote: "  " }).reasonNote);
    assert.deepEqual(validateRefundForm({ ...valid, reasonCode: "other", reasonNote: "Wrong card" }), {});
  });

  it("doesn't need a note for a listed reason", () => {
    assert.equal(validateRefundForm({ ...valid, reasonNote: "" }).reasonNote, undefined);
  });

  it("rejects an unknown bank or a malformed account number", () => {
    assert.ok(validateRefundForm({ ...valid, bankCode: "NOPE" }).bankCode);
    assert.ok(validateRefundForm({ ...valid, bankAccountNumber: "12ab" }).bankAccountNumber);
  });

  it("stores digits only for the IC and account", () => {
    const r = toRefundRecipient(valid);
    assert.equal(r.identityNumber, "900101145678");
    assert.equal(r.bankAccountNumber, "512345678901");
    assert.equal(r.name, "Tan Ah Kow");
  });
});

describe("IC numbers", () => {
  it("accepts 12 digits with or without dashes", () => {
    assert.equal(checkIc("900101-14-5678").ok, true);
    assert.equal(checkIc("900101145678").ok, true);
  });

  it("rejects the wrong length, letters, or an impossible date", () => {
    assert.equal(checkIc("90010114567").ok, false);
    assert.equal(checkIc("9001011456AB").ok, false);
    assert.equal(checkIc("901301145678").ok, false, "month 13");
    assert.equal(checkIc("900132145678").ok, false, "day 32");
  });
});

describe("what the buyer gets back", () => {
  it("deducts 4% of the order total", () => {
    assert.equal(REFUND_FEE_RATE, 0.04);
    assert.deepEqual(refundBreakdown(51.25), { total: 51.25, fee: 2.05, amount: 49.2 });
    assert.deepEqual(refundBreakdown(2999), { total: 2999, fee: 119.96, amount: 2879.04 });
  });

  it("charges at least RM 1", () => {
    assert.equal(REFUND_FEE_MIN, 1);
    assert.deepEqual(refundBreakdown(10), { total: 10, fee: 1, amount: 9 });
  });

  it("never refunds a negative amount", () => {
    assert.deepEqual(refundBreakdown(0.5), { total: 0.5, fee: 0.5, amount: 0 });
    assert.deepEqual(refundBreakdown(0), { total: 0, fee: 0, amount: 0 });
  });

  it("masks all but the last four digits", () => {
    assert.equal(maskTail("512345678901"), "•••• 8901");
  });
});

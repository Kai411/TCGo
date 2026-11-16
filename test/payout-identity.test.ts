// Payouts go only to the verified seller, and only for orders Billplz shows
// as paid (regulator review H3, hacker review C3, Merchant of Record C1).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  checkPayoutIdentity,
  namesLooselyMatch,
  payoutIdentityNumber,
  payoutNameApproved,
} from "~/shared/payout-identity";
import { orderPaymentProblem } from "~/shared/payout-paid";
import { DEFAULT_AUTO_PAYOUT, decideAutoPayouts } from "~/shared/auto-payout";
import { SERVER_PRIVATE_FIELDS } from "~/shared/private-profile";

const ACCOUNT = { name: "MUHAMMAD AMIRUL BIN ABDUL RAHMAN", bankAccountNumber: "1234567890" };
const verified = (extra: Record<string, unknown> = {}) => ({
  kycStatus: "verified",
  kycVerifiedName: "Muhammad Amirul bin Abdul Rahman",
  ...extra,
});

describe("loose name match", () => {
  const same: [string, string][] = [
    ["Muhammad Amirul bin Abdul Rahman", "MUHAMMAD AMIRUL BIN ABDUL RAHMAN"],
    ["Muhammad Amirul bin Abdul Rahman", "Muhammad Amirul Abdul Rahman"],
    ["Muhammad Amirul bin Abdul Rahman", "MUHAMMAD AMIRUL B ABDUL RAHM"],
    ["Tan Ah Kow", "TAN AHKOW"],
    ["Siti Nurhaliza binti Tarudin", "Siti Nurhaliza"],
    ["Rajesh a/l Subramaniam", "RAJESH SUBRAMANIAM"],
    ["José Lim", "Jose Lim"],
  ];
  for (const [a, b] of same) {
    it(`accepts "${b}" for "${a}"`, () => assert.equal(namesLooselyMatch(a, b), true));
  }

  const different: [string, string][] = [
    ["Muhammad Amirul bin Abdul Rahman", "Lee Chong Wei"],
    ["Tan Ah Kow", "Tan Mei Ling"],
    ["Siti Nurhaliza binti Tarudin", "Siti"],
    ["Ash Ketchum", ""],
    ["", "Ash Ketchum"],
  ];
  for (const [a, b] of different) {
    it(`flags "${b}" for "${a}"`, () => assert.equal(namesLooselyMatch(a, b), false));
  }
});

describe("payout identity check", () => {
  it("passes a verified seller paying their own account", () => {
    assert.deepEqual(checkPayoutIdentity(verified(), ACCOUNT), { ok: true });
  });

  it("blocks a seller who isn't verified", () => {
    for (const kycStatus of [undefined, "none", "pending_review", "declined"]) {
      const r = checkPayoutIdentity(verified({ kycStatus }), ACCOUNT);
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.kind, "block");
      assert.equal(!r.ok && r.reason, "kyc_not_verified");
    }
  });

  it("blocks a suspended seller even when verified", () => {
    const r = checkPayoutIdentity(verified({ sellingSuspended: true }), ACCOUNT);
    assert.equal(!r.ok && r.reason, "selling_suspended");
  });

  it("holds, not blocks, an account in someone else's name", () => {
    const r = checkPayoutIdentity(verified(), { ...ACCOUNT, name: "LEE CHONG WEI" });
    assert.equal(!r.ok && r.kind, "hold");
    assert.equal(!r.ok && r.reason, "name_mismatch");
  });

  it("holds a verification with no name kept", () => {
    const r = checkPayoutIdentity(verified({ kycVerifiedName: undefined }), ACCOUNT);
    assert.equal(!r.ok && r.reason, "name_mismatch");
  });

  it("releases the hold once staff approve that exact name and account", () => {
    const other = { name: "TCGO TRADING ENTERPRISE", bankAccountNumber: "5550001111" };
    const approval = {
      holder: other.name,
      bankAccountNumber: other.bankAccountNumber,
      approvedAt: 1,
      approvedBy: "staff1",
    };
    assert.deepEqual(checkPayoutIdentity(verified({ payoutNameApproval: approval }), other), { ok: true });
    // A different account, or a different name on it, needs approving again.
    assert.equal(payoutNameApproved(approval, { ...other, bankAccountNumber: "9999999999" }), false);
    assert.equal(payoutNameApproved(approval, { ...other, name: "SOMEONE ELSE" }), false);
    assert.equal(
      checkPayoutIdentity(verified({ payoutNameApproval: approval }), { ...other, name: "SOMEONE ELSE" }).ok,
      false,
    );
  });

  it("sends with the IC Didit read, not a typed one", () => {
    assert.equal(payoutIdentityNumber({ kycIdentityNumber: "900101101234", identityNumber: "111111111111" }), "900101101234");
    assert.equal(payoutIdentityNumber({ identityNumber: "900101-10-1234" }), "900101101234");
    assert.equal(payoutIdentityNumber(null), "");
  });
});

describe("order payment proof", () => {
  const order = { paymentMethod: "billplz", paidAt: 1, billplzBillId: "bill_1" };
  const bill = { id: "bill_1", paid: true, state: "paid", amount: 5000, paid_amount: 5000, reference_1: "order_1" };

  it("accepts a paid bill for this order that covers the payout", () => {
    assert.equal(orderPaymentProblem("order_1", order, bill, 48.5), null);
  });

  it("refuses an order the buyer faked without paying", () => {
    assert.match(orderPaymentProblem("order_1", { ...order, paidAt: undefined }, bill, 10)!, /never marked paid/);
    assert.match(orderPaymentProblem("order_1", { ...order, billplzBillId: undefined }, bill, 10)!, /no Billplz bill/);
    assert.match(orderPaymentProblem("order_1", order, null, 10)!, /no bill/);
    assert.match(orderPaymentProblem("order_1", order, { ...bill, paid: false, state: "due" }, 10)!, /due/);
  });

  it("refuses someone else's paid bill copied onto the order", () => {
    assert.match(orderPaymentProblem("order_1", order, { ...bill, reference_1: "order_2" }, 10)!, /different order/);
    assert.match(orderPaymentProblem("order_1", order, { ...bill, id: "bill_2" }, 10)!, /different bill/);
  });

  it("refuses a payout bigger than what the buyer paid", () => {
    assert.match(orderPaymentProblem("order_1", order, { ...bill, paid_amount: 100 }, 48.5)!, /more than the buyer paid/);
  });

  it("refuses an order that wasn't paid online", () => {
    assert.match(orderPaymentProblem("order_1", { ...order, paymentMethod: "manual" }, bill, 10)!, /not an online/);
  });
});

describe("automatic payouts", () => {
  it("never sends a batch that fails the identity check", () => {
    const batch = {
      id: "p1",
      sellerUid: "s1",
      amount: 50,
      status: "queued",
      autoPayoutSupported: true,
      requestedAt: 0,
    };
    const d = decideAutoPayouts([batch], { ...DEFAULT_AUTO_PAYOUT, enabled: true }, {
      spentLast24h: 0,
      identityHeldBatchIds: new Set(["p1"]),
      now: 10 * 60 * 60 * 1000,
    });
    assert.equal(d.approved.length, 0);
    assert.equal(d.skipped[0]?.reason, "identity_check");
  });
});

describe("firestore.rules", () => {
  it("keeps the Didit IC and the staff approval server-written", () => {
    assert.ok(SERVER_PRIVATE_FIELDS.includes("kycIdentityNumber" as any));
    assert.ok(SERVER_PRIVATE_FIELDS.includes("payoutNameApproval" as any));
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const priv = rules.slice(rules.indexOf("match /private/{docId}"));
    const block = priv.slice(0, priv.indexOf("allow delete"));
    // Allowed to be present, and listed among the keys the owner can't touch
    // on create and on update.
    assert.equal(block.split("'kycIdentityNumber'").length - 1, 3);
    assert.equal(block.split("'payoutNameApproval'").length - 1, 3);
  });
});

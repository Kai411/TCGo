// Who gets into the marketplace, and who is still being asked for something.
//
// The first version of hasIdentity() compared kycStatus to "approved". Didit
// reports "Approved" but kycStatusFor() stores "verified", so that check could
// never pass and onboarding could never be finished. It failed silently — the
// gate just never opened. These tests exist so it cannot happen again.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ONBOARDING_STEPS,
  SELLER_STEPS,
  hasBankDetails,
  hasDeliveryAddress,
  hasHandover,
  hasIdentity,
  hasSellerContact,
  isOnboardingExempt,
  isSellerOnboardingExempt,
  onboardingState,
  sellerOnboardingState,
} from "~/shared/onboarding";
import { payoutDetailsComplete } from "~/shared/payout-details";
import { kycStatusFor, KYC_REQUIRED } from "~/shared/didit";

const address = {
  deliveryName: "Kai",
  deliveryPhone: "0123456789",
  deliveryAddress1: "12 Jalan Satu",
  deliveryPostcode: "47100",
  deliveryCity: "Puchong",
  deliveryState: "sgr",
};

describe("identity", () => {
  it("accepts the value Didit's Approved actually maps to", () => {
    const stored = kycStatusFor("Approved");
    assert.equal(stored, "verified");
    assert.equal(hasIdentity({ kycStatus: stored }), true);
  });

  it("rejects the value that was wrongly hard-coded", () => {
    assert.equal(hasIdentity({ kycStatus: "approved" }), false);
  });

  it("rejects everything that isn't a pass", () => {
    for (const s of ["none", "in_progress", "pending_review", "declined", undefined]) {
      assert.equal(hasIdentity({ kycStatus: s as string }), false, `${s} must not pass`);
    }
  });

  it("is switched on", () => {
    assert.equal(KYC_REQUIRED, true, "the gate is meant to be enforced");
  });
});

describe("delivery address", () => {
  it("needs everything a courier quote needs", () => {
    assert.equal(hasDeliveryAddress(address), true);
  });

  it("does not demand a unit line", () => {
    assert.equal(hasDeliveryAddress({ ...address, deliveryAddress2: "" }), true);
  });

  it("rejects a missing field", () => {
    for (const k of Object.keys(address)) {
      const partial = { ...address, [k]: "" };
      assert.equal(hasDeliveryAddress(partial), false, `${k} should be required`);
    }
  });

  it("rejects whitespace as a value", () => {
    assert.equal(hasDeliveryAddress({ ...address, deliveryCity: "   " }), false);
  });

  it("rejects an empty profile", () => {
    assert.equal(hasDeliveryAddress(null), false);
    assert.equal(hasDeliveryAddress({}), false);
  });
});

describe("buyer onboarding state", () => {
  it("is complete on email plus an address", () => {
    const s = onboardingState(address, true);
    assert.equal(s.complete, true);
    assert.equal(s.current, null);
    assert.equal(s.percent, 100);
  });

  it("never asks a buyer for identity", () => {
    // Spending money is the low-risk direction; the ID check belongs to
    // selling, where money flows the other way.
    const s = onboardingState({ ...address, kycStatus: "none" }, true);
    assert.equal(s.complete, true);
    assert.ok(!s.remaining.includes("identity" as never));
  });

  it("asks for the email first", () => {
    const s = onboardingState(address, false);
    assert.equal(s.current, "email");
  });

  it("asks for the address once the email is done", () => {
    const s = onboardingState({}, true);
    assert.deepEqual(s.remaining, ["address"]);
  });

  it("reports a brand-new account as nothing done", () => {
    const s = onboardingState({}, false);
    assert.equal(s.remaining.length, ONBOARDING_STEPS.length);
    assert.equal(s.percent, 0);
    assert.equal(s.complete, false);
  });

  it("never trusts a profile flag for email — only the token", () => {
    // Passing emailVerified: false must win even if the document claims it.
    const s = onboardingState({ ...address, emailVerified: true } as never, false);
    assert.ok(s.remaining.includes("email"));
  });
});

describe("what stays reachable while setup is unfinished", () => {
  it("lets you finish, and lets you leave", () => {
    for (const p of ["/onboarding", "/login"]) {
      assert.equal(isOnboardingExempt(p), true, `${p} must stay open`);
    }
  });

  it("keeps marketing and legal pages open", () => {
    for (const p of ["/landing", "/privacy-policy", "/terms"]) {
      assert.equal(isOnboardingExempt(p), true, `${p} must stay open`);
    }
  });

  it("blocks the marketplace itself", () => {
    for (const p of ["/", "/cart", "/seller", "/seller/pos", "/orders/abc", "/collection"]) {
      assert.equal(isOnboardingExempt(p), false, `${p} must be gated`);
    }
  });

  it("matches on segment boundaries, not prefixes", () => {
    // "/logins-are-fun" must not be exempt just because it starts with /login.
    assert.equal(isOnboardingExempt("/login"), true);
    assert.equal(isOnboardingExempt("/login/reset"), true);
    assert.equal(isOnboardingExempt("/loginsomething"), false);
  });
});

// ── Selling ───────────────────────────────────────────────────────────

const seller = {
  kycStatus: "verified",
  phone: "0123456789",
  pickupAddress1: "12 Jalan Satu",
  pickupPostcode: "47100",
  pickupCity: "Puchong",
  pickupState: "sgr",
  bankCode: "MBBEMYKL",
  bankAccountNumber: "1234567890",
  bankAccountHolder: "Kai Tan",
  identityNumber: "900101101234",
  handoverPreference: "dropoff",
};

describe("seller onboarding", () => {
  it("is complete when all four are done", () => {
    const s = sellerOnboardingState(seller);
    assert.equal(s.complete, true);
    assert.equal(s.current, null);
    assert.equal(s.percent, 100);
  });

  it("asks for identity first — before any money can move", () => {
    const s = sellerOnboardingState({ ...seller, kycStatus: "none" });
    assert.equal(s.current, "identity");
  });

  it("requires identity to sell, unlike buying", () => {
    // One profile carrying both sides' details — a delivery address for
    // buying, pickup and bank for selling — and no verified identity.
    const noId = { ...address, ...seller, kycStatus: "none" };
    assert.equal(onboardingState(noId, true).complete, true, "should be able to buy");
    assert.equal(sellerOnboardingState(noId).complete, false, "must not be able to sell");
  });

  it("reports nothing done for a fresh seller", () => {
    const s = sellerOnboardingState({});
    assert.equal(s.remaining.length, SELLER_STEPS.length);
    assert.equal(s.percent, 0);
  });

  it("accepts either phone field as contact", () => {
    const viaWhatsapp = { ...seller, phone: "", whatsappNumber: "0123456789" };
    assert.equal(hasSellerContact(viaWhatsapp), true);
    assert.equal(hasSellerContact({ ...seller, phone: "", whatsappNumber: "" }), false);
  });

  it("needs every part of the pickup address", () => {
    for (const k of ["pickupAddress1", "pickupPostcode", "pickupCity", "pickupState"]) {
      assert.equal(hasSellerContact({ ...seller, [k]: "" }), false, `${k} required`);
    }
  });

  it("agrees with payoutDetailsComplete, which is the authority at payout time", () => {
    // Two implementations of "can we pay this person". If they ever diverge,
    // onboarding would wave someone through that the payout route refuses.
    assert.equal(hasBankDetails(seller), payoutDetailsComplete(seller as never));
    for (const k of ["bankCode", "bankAccountNumber", "bankAccountHolder", "identityNumber"]) {
      const partial = { ...seller, [k]: "" };
      assert.equal(
        hasBankDetails(partial),
        payoutDetailsComplete(partial as never),
        `disagreed with ${k} missing`,
      );
    }
  });

  it("only accepts a handover option the quoting code understands", () => {
    assert.equal(hasHandover({ handoverPreference: "dropoff" }), true);
    assert.equal(hasHandover({ handoverPreference: "pickup" }), true);
    assert.equal(hasHandover({ handoverPreference: "whenever" }), false);
    assert.equal(hasHandover({}), false);
  });
});

describe("what stays reachable while seller setup is unfinished", () => {
  it("lets a seller reach the flow and the forms that fix it", () => {
    for (const p of ["/seller/onboarding", "/seller/settings", "/seller/verify"]) {
      assert.equal(isSellerOnboardingExempt(p), true, `${p} must stay open`);
    }
  });

  it("gates the parts that take money or ship things", () => {
    for (const p of ["/seller", "/seller/pos", "/seller/listings/new", "/seller/funds"]) {
      assert.equal(isSellerOnboardingExempt(p), false, `${p} must be gated`);
    }
  });
});

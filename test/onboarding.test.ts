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
  hasDeliveryAddress,
  hasIdentity,
  isOnboardingExempt,
  onboardingState,
} from "~/shared/onboarding";
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

describe("onboarding state", () => {
  const verified = { ...address, kycStatus: "verified" };

  it("is complete only when all three are done", () => {
    const s = onboardingState(verified, true);
    assert.equal(s.complete, true);
    assert.equal(s.current, null);
    assert.equal(s.percent, 100);
  });

  it("asks for the email first", () => {
    const s = onboardingState(verified, false);
    assert.equal(s.current, "email");
  });

  it("asks for the address before identity", () => {
    const s = onboardingState({ kycStatus: "none" }, true);
    assert.deepEqual(s.remaining, ["address", "identity"]);
    assert.equal(s.current, "address");
  });

  it("asks for identity last", () => {
    const s = onboardingState(address, true);
    assert.deepEqual(s.remaining, ["identity"]);
  });

  it("reports a brand-new account as nothing done", () => {
    const s = onboardingState({}, false);
    assert.equal(s.remaining.length, ONBOARDING_STEPS.length);
    assert.equal(s.percent, 0);
    assert.equal(s.complete, false);
  });

  it("never trusts a profile flag for email — only the token", () => {
    // Passing emailVerified: false must win even if the document claims it.
    const s = onboardingState({ ...verified, emailVerified: true } as never, false);
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

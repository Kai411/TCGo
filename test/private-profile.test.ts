// Personal data stays off the publicly readable profile document.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  legacyPrivateFields,
  mergeProfile,
  PRIVATE_FIELDS,
  splitProfileWrite,
} from "~/shared/private-profile";

describe("splitting a profile write", () => {
  it("sends IC, bank, contact and address fields to the private document", () => {
    const { pub, priv } = splitProfileWrite({
      customName: "Ash",
      identityNumber: "900101101234",
      bankAccountNumber: "1234567890",
      pickupAddress1: "1 Jalan Satu",
      handoverPreference: "dropoff",
    });
    assert.deepEqual(pub, { customName: "Ash", handoverPreference: "dropoff" });
    assert.deepEqual(priv, {
      identityNumber: "900101101234",
      bankAccountNumber: "1234567890",
      pickupAddress1: "1 Jalan Satu",
    });
  });

  it("leaves a public hasContact flag in place of the number", () => {
    assert.equal(splitProfileWrite({ phone: "0123456789" }).pub.hasContact, true);
    assert.equal(splitProfileWrite({ phone: "", whatsappNumber: "" }).pub.hasContact, false);
    // One blank field doesn't prove the other is blank too.
    assert.equal("hasContact" in splitProfileWrite({ phone: "" }).pub, false);
  });
});

describe("reading a profile", () => {
  it("prefers the private copy over a legacy public one", () => {
    const merged = mergeProfile(
      { customName: "Ash", phone: "old" },
      { phone: "new", bankAccountNumber: "1" },
    );
    assert.deepEqual(merged, { customName: "Ash", phone: "new", bankAccountNumber: "1" });
  });

  it("still reads a profile that hasn't been migrated", () => {
    assert.deepEqual(mergeProfile({ phone: "old" }, null), { phone: "old" });
  });

  it("finds the legacy fields left on a public document", () => {
    assert.deepEqual(legacyPrivateFields({ customName: "Ash", phone: "1", tier: "free" }), { phone: "1" });
  });
});

describe("firestore.rules", () => {
  it("lists exactly the same private fields as the app", () => {
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const fn = rules.slice(rules.indexOf("function privateProfileFields()"));
    const body = fn.slice(0, fn.indexOf("];"));
    const inRules = [...body.matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(inRules, [...PRIVATE_FIELDS].sort());
  });
});

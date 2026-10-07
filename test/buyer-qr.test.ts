// The code a buyer shows at a counter.
//
// The scanner reads whatever is in front of it — inventory labels, the shop's
// own DuitNow standee, a boarding pass — so the parser's job is as much about
// what it REFUSES as what it accepts.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BUYER_QR_PREFIX,
  buyerQrPayload,
  isPlausibleEmail,
  normaliseEmail,
  parseBuyerQr,
} from "~/shared/buyer-qr";

const UID = "aBcD1234EfGh5678IjKl9012MnOp";

describe("the payload", () => {
  it("round-trips a uid", () => {
    assert.equal(parseBuyerQr(buyerQrPayload(UID)), UID);
  });

  it("uses the same scheme as the inventory labels", () => {
    // pages/seller/labels.vue writes tcgo:inv:<id>; a different shape here
    // would mean the scanner could not tell the two apart by prefix.
    assert.ok(BUYER_QR_PREFIX.startsWith("tcgo:"));
    assert.ok(buyerQrPayload(UID).startsWith("tcgo:"));
  });

  it("carries the uid and nothing else", () => {
    // An email in a QR is leaked permanently the first time it's photographed.
    const payload = buyerQrPayload(UID);
    assert.ok(!payload.includes("@"));
    assert.equal(payload, `${BUYER_QR_PREFIX}${UID}`);
  });
});

describe("what the scanner refuses", () => {
  it("ignores an inventory label", () => {
    assert.equal(parseBuyerQr("tcgo:inv:abc123def"), null);
  });

  it("ignores anything foreign", () => {
    for (const junk of [
      "https://example.com",
      "00020101021226580014A00000061501234",  // a DuitNow payload
      "",
      "   ",
      "tcgo:",
      "tcgo:u:",
      "tcgo:u:   ",
    ]) {
      assert.equal(parseBuyerQr(junk), null, `should refuse ${JSON.stringify(junk)}`);
    }
  });

  it("refuses a uid with characters a uid cannot have", () => {
    assert.equal(parseBuyerQr("tcgo:u:../../etc/passwd"), null);
    assert.equal(parseBuyerQr("tcgo:u:abc def"), null);
    assert.equal(parseBuyerQr("tcgo:u:<script>alert(1)</script>"), null);
  });

  it("refuses something too short to be a uid", () => {
    assert.equal(parseBuyerQr("tcgo:u:abc"), null);
  });

  it("survives a non-string", () => {
    assert.equal(parseBuyerQr(null), null);
    assert.equal(parseBuyerQr(undefined), null);
    assert.equal(parseBuyerQr(42 as never), null);
  });

  it("tolerates surrounding whitespace from the decoder", () => {
    assert.equal(parseBuyerQr(`  ${buyerQrPayload(UID)}  `), UID);
  });
});

describe("the email a receipt goes to", () => {
  it("accepts ordinary addresses", () => {
    for (const ok of ["a@b.co", "kai.tan+pos@gmail.com", "shop_01@sub.domain.my"]) {
      assert.equal(isPlausibleEmail(ok), true, ok);
    }
  });

  it("rejects what obviously isn't one", () => {
    for (const bad of ["", "   ", "nope", "a@b", "a b@c.com", "@b.com", "a@.com"]) {
      assert.equal(isPlausibleEmail(bad), false, JSON.stringify(bad));
    }
    assert.equal(isPlausibleEmail(null), false);
    assert.equal(isPlausibleEmail(undefined), false);
  });

  it("lowercases and trims, so the same person is one address", () => {
    assert.equal(normaliseEmail("  Kai.Tan@Gmail.COM "), "kai.tan@gmail.com");
  });
});

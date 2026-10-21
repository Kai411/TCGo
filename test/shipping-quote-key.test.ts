// When an order needs a fresh courier quote before payment.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { needsShippingQuote, shippingQuoteKey } from "~/shared/shipping";

const penang = { postcode: "10200", state: "png" };
const kl = { postcode: "50450", state: "kul" };

describe("needsShippingQuote", () => {
  it("quotes an auction win that has never been quoted", () => {
    assert.equal(needsShippingQuote({ deliveryAddress: penang }), true);
  });

  it("keeps a cart order's checkout quote", () => {
    assert.equal(needsShippingQuote({ shippingQuoted: true, deliveryAddress: kl }), false);
  });

  it("keeps a payment-time quote for the same address", () => {
    assert.equal(
      needsShippingQuote({
        shippingQuoted: true,
        shippingQuotedFor: shippingQuoteKey(penang),
        deliveryAddress: { postcode: " 10200 ", state: "PNG" },
      }),
      false,
    );
  });

  it("re-quotes when the address changed after quoting", () => {
    assert.equal(
      needsShippingQuote({
        shippingQuoted: true,
        shippingQuotedFor: shippingQuoteKey(penang),
        deliveryAddress: kl,
      }),
      true,
    );
  });
});

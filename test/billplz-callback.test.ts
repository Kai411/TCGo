// The Billplz payment callback checks (security review C1: a signed redirect
// payload plus unsigned plain `paid=true` used to settle an order).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  amountMatches,
  checkBillForOrder,
  signBillplzCallback,
  verifyBillplzCallback,
} from "~/server/utils/billplz-callback";

const KEY = "S-test-signature-key";

const callback = (overrides: Record<string, string> = {}) => {
  const params: Record<string, string> = {
    id: "zq0tm2wc",
    collection_id: "yhx5t1pp",
    paid: "true",
    state: "paid",
    amount: "12345",
    paid_amount: "12345",
    paid_at: "2026-11-12 20:00:00 +0800",
    ...overrides,
  };
  return { ...params, x_signature: signBillplzCallback(params, KEY) };
};

// The redirect's own scheme: billplz[...] keys, parts `billplz<key><value>`.
const signRedirect = (params: Record<string, string>) => {
  const parts = Object.entries(params).map(([k, v]) => `billplz${k}${v}`);
  parts.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  return crypto.createHmac("sha256", KEY).update(parts.join("|")).digest("hex");
};

describe("signBillplzCallback", () => {
  it("joins sorted <key><value> parts the way Billplz documents", () => {
    // Billplz's X-Signature docs: paid_amount… and paid_at… sort before paid….
    const params = {
      amount: "200",
      collection_id: "inbmmepb",
      due_at: "2020-12-31",
      email: "api@billplz.com",
      id: "8X0Iyzaw",
      mobile: "",
      name: "MICHAEL API V3",
      paid_amount: "0",
      paid_at: "",
      paid: "false",
      state: "due",
      url: "https://www.billplz.com/bills/8X0Iyzaw",
    };
    const source =
      "amount200|collection_idinbmmepb|due_at2020-12-31|emailapi@billplz.com|id8X0Iyzaw|mobile|nameMICHAEL API V3|paid_amount0|paid_at|paidfalse|statedue|urlhttps://www.billplz.com/bills/8X0Iyzaw";
    const expected = crypto.createHmac("sha256", KEY).update(source).digest("hex");
    assert.equal(signBillplzCallback(params, KEY), expected);
  });
});

describe("verifyBillplzCallback", () => {
  it("accepts a correctly signed callback and drops the signature", () => {
    const r = verifyBillplzCallback(callback(), KEY);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.params.id, "zq0tm2wc");
      assert.equal(r.params.paid, "true");
      assert.equal("x_signature" in r.params, false);
    }
  });

  it("refuses when the key is missing", () => {
    assert.equal(verifyBillplzCallback(callback(), "").ok, false);
  });

  it("refuses a tampered field", () => {
    const body = { ...callback({ paid: "false", state: "due" }), paid: "true" };
    assert.equal(verifyBillplzCallback(body, KEY).ok, false);
  });

  it("refuses a lowered amount under the old signature", () => {
    const body = { ...callback(), amount: "1", paid_amount: "1" };
    assert.equal(verifyBillplzCallback(body, KEY).ok, false);
  });

  it("refuses an added unsigned field", () => {
    const body = { ...callback(), extra: "x" };
    assert.equal(verifyBillplzCallback(body, KEY).ok, false);
  });

  it("refuses the C1 bypass: signed redirect plus unsigned plain paid=true", () => {
    const redirect = { id: "zq0tm2wc", paid: "false", paid_at: "" };
    const body: Record<string, string> = {
      "billplz[id]": redirect.id,
      "billplz[paid]": redirect.paid,
      "billplz[paid_at]": redirect.paid_at,
      "billplz[x_signature]": signRedirect(redirect),
      id: "zq0tm2wc",
      paid: "true",
      amount: "12345",
    };
    assert.equal(verifyBillplzCallback(body, KEY).ok, false);
  });

  it("refuses a genuine redirect payload on its own", () => {
    const redirect = { id: "zq0tm2wc", paid: "true", paid_at: "x" };
    const body = {
      "billplz[id]": redirect.id,
      "billplz[paid]": redirect.paid,
      "billplz[paid_at]": redirect.paid_at,
      "billplz[x_signature]": signRedirect(redirect),
    };
    assert.equal(verifyBillplzCallback(body, KEY).ok, false);
  });

  it("refuses missing, short or non-hex signatures without throwing", () => {
    const { x_signature, ...unsigned } = callback();
    assert.equal(verifyBillplzCallback(unsigned, KEY).ok, false);
    assert.equal(verifyBillplzCallback({ ...unsigned, x_signature: "abc" }, KEY).ok, false);
    assert.equal(verifyBillplzCallback({ ...unsigned, x_signature: "z".repeat(64) }, KEY).ok, false);
    assert.equal(verifyBillplzCallback({ ...unsigned, x_signature: "0".repeat(64) }, KEY).ok, false);
    assert.equal(verifyBillplzCallback({ ...unsigned, x_signature }, KEY).ok, true);
  });

  it("refuses non-string fields and non-object bodies", () => {
    assert.equal(verifyBillplzCallback({ ...callback(), paid: ["true", "true"] }, KEY).ok, false);
    assert.equal(verifyBillplzCallback(null, KEY).ok, false);
    assert.equal(verifyBillplzCallback("id=1", KEY).ok, false);
    assert.equal(verifyBillplzCallback([callback()], KEY).ok, false);
  });

  it("refuses a signed callback with no bill id", () => {
    assert.equal(verifyBillplzCallback(callback({ id: "" }), KEY).ok, false);
  });
});

describe("checkBillForOrder", () => {
  const expect = { billId: "zq0tm2wc", orderId: "order1", collectionId: "yhx5t1pp" };
  const bill = {
    id: "zq0tm2wc",
    collection_id: "yhx5t1pp",
    paid: true,
    state: "paid",
    amount: 12345,
    paid_amount: 12345,
    reference_1: "order1",
  };

  it("passes a paid bill and returns what Billplz collected", () => {
    assert.deepEqual(checkBillForOrder(bill, expect), { ok: true, paidSen: 12345 });
  });

  it("uses paid_amount over amount", () => {
    const r = checkBillForOrder({ ...bill, paid_amount: 100 }, expect);
    assert.deepEqual(r, { ok: true, paidSen: 100 });
  });

  it("fails a bill Billplz says is unpaid, whatever the callback said", () => {
    assert.equal(checkBillForOrder({ ...bill, paid: false, state: "due" }, expect).ok, false);
    assert.equal(checkBillForOrder({ ...bill, state: "deleted" }, expect).ok, false);
    assert.equal(checkBillForOrder({ ...bill, paid_amount: 0, amount: 0 }, expect).ok, false);
  });

  it("fails a bill that isn't this one, ours, or this order's", () => {
    assert.equal(checkBillForOrder(null, expect).ok, false);
    assert.equal(checkBillForOrder({ ...bill, id: "other" }, expect).ok, false);
    assert.equal(checkBillForOrder({ ...bill, collection_id: "other" }, expect).ok, false);
    assert.equal(checkBillForOrder({ ...bill, reference_1: "order2" }, expect).ok, false);
  });

  it("skips the collection check when none is configured", () => {
    const r = checkBillForOrder({ ...bill, collection_id: "x" }, { ...expect, collectionId: undefined });
    assert.equal(r.ok, true);
  });
});

describe("amountMatches", () => {
  it("settles only on an exact, recorded amount", () => {
    assert.equal(amountMatches(12345, 12345), true);
    assert.equal(amountMatches(12345, 12344), false);
    assert.equal(amountMatches(0, 12345), false);
    assert.equal(amountMatches(null, 12345), false);
    assert.equal(amountMatches(undefined, 0), false);
  });
});

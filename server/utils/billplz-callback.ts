// Pure checks for the Billplz payment callback (server/api/billplz/webhook).
// No Nuxt globals in here, so the test runner can import it as is.
//
// Why this is stricter than it looks like it needs to be: the old check
// signed only the `billplz[...]` keys whenever any were present, while the
// handler read plain keys first. Posting a genuinely signed redirect payload
// (say, a cancelled payment's billplz[paid]=false) alongside unsigned plain
// `id` / `paid=true` / `amount` passed the signature and settled the order.
// So now:
//   1. Only the server-to-server callback shape is accepted: plain keys,
//      nothing bracketed. The browser redirect never posts here.
//   2. Every field the handler reads comes out of the verified set.
//   3. The bill is re-read from Billplz and its own paid / amount are what
//      settle the order (see checkBillForOrder), so even a valid signature
//      can't settle a bill Billplz says is unpaid.

import crypto from "node:crypto";

export type CallbackCheck =
  | { ok: true; params: Record<string, string> }
  | { ok: false; reason: string };

/** Billplz's callback signature: HMAC-SHA256 over sorted `<key><value>` parts joined with `|`. */
export const signBillplzCallback = (
  params: Record<string, string>,
  xSignatureKey: string,
): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === "x_signature") continue;
    parts.push(`${key}${value ?? ""}`);
  }
  // Sort the *concatenated* strings, not the keys. Billplz's own example puts
  // `paid_amount…|paid_at…|paidtrue` — key order would give paid, paid_amount,
  // paid_at. Compared on code units so `_` (0x5F) sorts before `t` (0x74).
  parts.sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return crypto.createHmac("sha256", xSignatureKey).update(parts.join("|")).digest("hex");
};

/**
 * Verifies a callback body and returns only the fields it vouches for.
 * Fails closed on: no key, any non-string value, any bracketed key, a missing
 * or malformed signature, or a missing bill id.
 */
export const verifyBillplzCallback = (
  body: unknown,
  xSignatureKey: string,
): CallbackCheck => {
  if (!xSignatureKey) return { ok: false, reason: "no signature key" };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "body is not a form" };
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    // A repeated form key arrives as an array; a JSON body could carry
    // anything. Billplz sends flat strings, so nothing else is trusted.
    if (typeof value !== "string") return { ok: false, reason: `non-string field ${key}` };
    if (key.includes("[")) return { ok: false, reason: "redirect-style keys are not accepted" };
    params[key] = value;
  }
  const provided = params.x_signature ?? "";
  if (!/^[0-9a-f]{64}$/i.test(provided)) return { ok: false, reason: "missing signature" };
  if (!params.id) return { ok: false, reason: "missing bill id" };

  const expected = Buffer.from(signBillplzCallback(params, xSignatureKey), "hex");
  const given = Buffer.from(provided, "hex");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad signature" };
  }
  const { x_signature: _sig, ...signed } = params;
  return { ok: true, params: signed };
};

/** The bill as Billplz's GET /v3/bills/:id returns it (the fields we use). */
export interface BillplzBill {
  id?: string;
  collection_id?: string;
  paid?: boolean | string;
  state?: string;
  amount?: number | string;
  paid_amount?: number | string;
  paid_at?: string | null;
  reference_1?: string | null;
}

export type BillCheck =
  | { ok: true; paidSen: number }
  | { ok: false; code: "bill_mismatch" | "not_paid"; reason: string };

/**
 * Is this bill really ours and really paid? Checks the bill Billplz returned
 * against the bill id from the callback, our collection, and the order it
 * was created for. The amount is checked separately by the handler (against
 * `billplzAmountSen`) so a mismatch can be flagged on the order.
 */
export const checkBillForOrder = (
  bill: BillplzBill | null | undefined,
  expect: { billId: string; orderId: string; collectionId?: string },
): BillCheck => {
  if (!bill || String(bill.id ?? "") !== expect.billId) {
    return { ok: false, code: "bill_mismatch", reason: "Billplz returned a different bill" };
  }
  if (expect.collectionId && String(bill.collection_id ?? "") !== expect.collectionId) {
    return { ok: false, code: "bill_mismatch", reason: "bill is not in TCGo's collection" };
  }
  // create-bill stamps reference_1 with the order id; a bill carrying another
  // order's id must never settle this one.
  if (bill.reference_1 && bill.reference_1 !== expect.orderId) {
    return { ok: false, code: "bill_mismatch", reason: "bill belongs to another order" };
  }
  const paid = bill.paid === true || bill.paid === "true";
  if (!paid || String(bill.state ?? "") !== "paid") {
    return { ok: false, code: "not_paid", reason: `bill state is ${bill.state ?? "unknown"}` };
  }
  const paidSen = Number(bill.paid_amount ?? bill.amount);
  if (!Number.isInteger(paidSen) || paidSen <= 0) {
    return { ok: false, code: "not_paid", reason: "bill has no paid amount" };
  }
  return { ok: true, paidSen };
};

/**
 * The amount check. Settles only when we recorded what the bill was priced at
 * and Billplz collected exactly that. An order with no recorded amount is not
 * "nothing to compare", it is a mismatch.
 */
export const amountMatches = (expectedSen: unknown, paidSen: number): boolean => {
  const expected = Number(expectedSen);
  return Number.isInteger(expected) && expected > 0 && expected === paidSen;
};

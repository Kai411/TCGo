// Billplz helpers (FPX order payments).
//
// Auth is HTTP Basic with the API key as the username and an empty password.
// Sandbox and production are separate accounts/hosts — toggle with
// NUXT_BILLPLZ_SANDBOX=true.

import crypto from "node:crypto";

// Sandbox only when the flag is explicitly "true" (or "1"). Anything else —
// "false", empty, unset — means production. (A bare `if (config.billplzSandbox)`
// would treat the string "false" as truthy and wrongly pick sandbox.)
export const isBillplzSandbox = () => {
  const v = String(useRuntimeConfig().billplzSandbox ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
};

export const billplzBaseUrl = () =>
  isBillplzSandbox()
    ? "https://www.billplz-sandbox.com/api"
    : "https://www.billplz.com/api";

export const billplzAuthHeader = () => {
  const config = useRuntimeConfig();
  const key = config.billplzApiKey as string;
  if (!key) throw createError({ statusCode: 500, message: "Billplz not configured" });
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
};

// ── Seller payouts: V5 Payment Orders ─────────────────────────────────
//
// Bills live on /api/v3. Payouts live on /api/v5 as "Payment Orders".
//
// This previously targeted /api/v4/mass_payment_instruction{,_collection}s,
// which does not exist on either environment — every call 404'd with an HTML
// error page rather than a JSON API error, so no payout ever reached Billplz.
// Billplz's disbursement product is the V5 Payment Order API.
//
// V5 differs from v3/v4 in two ways that matter:
//   1. every request carries `epoch` (UNIX seconds) and a `checksum`
//   2. the checksum is HMAC-SHA512 over the signed values concatenated in the
//      documented order with NO separator, keyed by the X-Signature key
//      (verified against the sandbox — see PAYMENT_ORDER_CHECKSUM_FIELDS).
import { createHmac } from "node:crypto";

const signatureKey = (): string => {
  const key = useRuntimeConfig().billplzXSignatureKey as string;
  if (!key) {
    throw createError({
      statusCode: 500,
      message: "Billplz X-Signature key not configured (payouts need it to sign requests)",
    });
  }
  return key;
};

/**
 * HMAC-SHA512 of the ordered values, concatenated without a separator.
 * Optional values that are absent contribute nothing — matching how Billplz
 * treats an omitted callback_url.
 */
const checksumOf = (values: (string | number | undefined | null)[]): string =>
  createHmac("sha512", signatureKey())
    .update(values.filter((v) => v !== undefined && v !== null && v !== "").join(""))
    .digest("hex");

const billplzForm = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const res = await fetch(`${billplzBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: billplzAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[billplz]", path, res.status, text);
    // A 404 here is almost always a wrong path, and Billplz answers those with
    // an HTML page — surfacing 300 chars of markup helps nobody.
    const isHtml = /^\s*<!doctype html|^\s*<html/i.test(text);
    throw createError({
      statusCode: 502,
      message: isHtml
        ? `Billplz error (${res.status}): endpoint not found at ${path}`
        : `Billplz error (${res.status}): ${text.slice(0, 300)}`,
    });
  }
  return JSON.parse(text) as T;
};

export interface MassPaymentInstruction {
  id: string;
  status: string;
  total?: number;
  reference_id?: string | null;
  recipient_name?: string;
}

/**
 * Billplz rejects non-ASCII in `name` and `description` with
 * "Description contains invalid charaters" (their typo). The payout
 * description used to be built with a "·" separator, so every real payout
 * would have been rejected — on production as well as sandbox.
 *
 * Transliterates the punctuation we actually emit, then strips anything still
 * outside printable ASCII rather than trusting callers to remember.
 */
export const asciiSafe = (value: string, max: number): string =>
  value
    .replace(/[\u2013\u2014]/g, "-")   // en/em dash
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes
    .replace(/[\u00B7\u2022]/g, "-")   // middle dot, bullet
    .replace(/\u2026/g, "...")          // ellipsis
    .replace(/[^\x20-\x7E]/g, "")      // anything else non-printable-ASCII
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Signed fields, in Billplz's documented order. */
const COLLECTION_CHECKSUM_FIELDS = "[title, callback_url*, epoch]";
const PAYMENT_ORDER_CHECKSUM_FIELDS =
  "[payment_order_collection_id, bank_account_number, total, epoch]";

// A collection groups payment orders — one per payout batch, so the Billplz
// dashboard mirrors our ledger one-to-one.
export const createMassPaymentCollection = async (title: string) => {
  const epoch = Math.floor(Date.now() / 1000);
  return await billplzForm<{ id: string; title: string }>(
    "/v5/payment_order_collections",
    {
      title,
      epoch: String(epoch),
      // COLLECTION_CHECKSUM_FIELDS — callback_url omitted, so it contributes
      // nothing to the signed string.
      checksum: checksumOf([title, epoch]),
    },
  );
};

export const createMassPaymentInstruction = async (input: {
  collectionId: string;
  bankCode: string;
  bankAccountNumber: string;
  /** Accepted for call-site compatibility; V5 has no identity_number field. */
  identityNumber?: string;
  name: string;
  description: string;
  /** Ringgit, converted to sen here. */
  amount: number;
  email?: string;
}) => {
  const epoch = Math.floor(Date.now() / 1000);
  const total = String(Math.round(input.amount * 100));

  const params: Record<string, string> = {
    payment_order_collection_id: input.collectionId,
    bank_code: input.bankCode,
    bank_account_number: input.bankAccountNumber,
    name: asciiSafe(input.name, 100),
    description: asciiSafe(input.description, 200),
    total,
    epoch: String(epoch),
    // PAYMENT_ORDER_CHECKSUM_FIELDS
    checksum: checksumOf([input.collectionId, input.bankAccountNumber, total, epoch]),
  };
  if (input.email) {
    params.email = input.email;
    params.notification = "true";
  }
  try {
    return await billplzForm<MassPaymentInstruction>("/v5/payment_orders", params);
  } catch (e: any) {
    // Turn Billplz's bare refusal into something an admin can act on.
    if (/payment order limit/i.test(String(e?.message ?? ""))) {
      const remaining = await getPaymentOrderLimit().catch(() => 0);
      throw createError({
        statusCode: 502,
        message:
          `Billplz Payment Order Limit is RM ${(remaining / 100).toFixed(2)} but this payout needs RM ${input.amount.toFixed(2)}. ` +
          `Raise the limit in the Billplz dashboard (Payment Orders → limit), then retry.`,
      });
    }
    throw e;
  }
};

/**
 * Remaining Payment Order allowance, in sen.
 *
 * Billplz caps how much an account may disburse; a fresh account (sandbox
 * included) starts at 0 and every payment order is refused with
 * "You do not have enough Payment Order Limit" until it's raised in the
 * dashboard. Reading it lets us say *why* rather than pass that through raw.
 *
 * Note the singular path — /payment_order_limits (plural) 404s.
 */
export const getPaymentOrderLimit = async (): Promise<number> => {
  const epoch = Math.floor(Date.now() / 1000);
  const qs = new URLSearchParams({
    epoch: String(epoch),
    checksum: checksumOf([epoch]),
  });
  const res = await fetch(`${billplzBaseUrl()}/v5/payment_order_limit?${qs}`, {
    headers: { Authorization: billplzAuthHeader() },
  });
  if (!res.ok) return 0;
  const json = JSON.parse(await res.text()) as { total?: number };
  return Number(json.total ?? 0);
};

export const getMassPaymentInstruction = async (id: string) => {
  const epoch = Math.floor(Date.now() / 1000);
  const qs = new URLSearchParams({
    epoch: String(epoch),
    checksum: checksumOf([id, epoch]), // [payment_order_id, epoch]
  });
  const res = await fetch(`${billplzBaseUrl()}/v5/payment_orders/${id}?${qs}`, {
    headers: { Authorization: billplzAuthHeader() },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[billplz] get payment order", res.status, text);
    throw createError({ statusCode: 502, message: "Couldn't read payout status" });
  }
  return JSON.parse(text) as MassPaymentInstruction;
};

// V5 payment-order lifecycle: processing → enquiring → executing → reviewing
// → completed, or refunded if the transfer bounces back.
export const mapInstructionStatus = (
  raw: string | undefined,
): "processing" | "paid" | "failed" => {
  const s = String(raw || "").toLowerCase();
  if (["completed", "processed", "success", "successful", "paid"].includes(s)) return "paid";
  if (
    ["rejected", "failed", "cancelled", "canceled", "returned", "refunded"].includes(s)
  )
    return "failed";
  // processing / enquiring / executing / reviewing are all still in flight.
  return "processing";
};

export const verifyBillplzSignature = (
  params: Record<string, string>,
  xSignatureKey: string,
): boolean => {
  const provided = params["billplz[x_signature]"] ?? params["x_signature"] ?? "";
  if (!provided) return false;

  // Billplz signs the two payloads differently, and getting this wrong fails
  // closed — the callback is rejected and a paid order never settles.
  //
  //   callback (POST to callback_url): plain keys, source part is `<key><value>`
  //     amount100|collection_idyhx5t1pp|idzq0tm2wc|paid_at...|paidtrue|statepaid
  //
  //   redirect (browser return):       billplz[...] keys, part is `billplz<key><value>`
  //     billplzidzq0tm2wc|billplzpaid_at...|billplzpaidtrue
  const bracketed = Object.keys(params).some((k) => /^billplz\[.+\]$/.test(k));

  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(params)) {
    if (bracketed) {
      const m = rawKey.match(/^billplz\[(.+)\]$/);
      if (!m || m[1] === "x_signature") continue;
      parts.push(`billplz${m[1]}${value ?? ""}`);
    } else {
      if (rawKey === "x_signature") continue;
      parts.push(`${rawKey}${value ?? ""}`);
    }
  }

  // Sort the *concatenated* strings, not the keys. Billplz's own example puts
  // `paid_amount…|paid_at…|paidtrue` — key order would give paid, paid_amount,
  // paid_at. Compared on code units so `_` (0x5F) sorts before `t` (0x74).
  parts.sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const digest = crypto
    .createHmac("sha256", xSignatureKey)
    .update(parts.join("|"))
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
  } catch {
    return false;
  }
};

// ── Bills ─────────────────────────────────────────────────────────────

// Void an unpaid (due) bill. Billplz refuses once the bill has been paid —
// callers use that refusal as the signal to stop (e.g. a merge must not
// absorb an order the buyer just paid). Throws on any non-2xx.
export const billplzDeleteBill = async (billId: string): Promise<void> => {
  const res = await fetch(`${billplzBaseUrl()}/v3/bills/${billId}`, {
    method: "DELETE",
    headers: { Authorization: billplzAuthHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Billplz bill ${billId} not deleted (${res.status}): ${text}`);
  }
};

// Read a bill's state ("due" | "paid" | "deleted" | "hidden"). Used to decide
// whether a failed delete means "already paid" (abort) or "already gone"
// (safe to continue).
export const billplzBillState = async (billId: string): Promise<string> => {
  const res = await fetch(`${billplzBaseUrl()}/v3/bills/${billId}`, {
    headers: { Authorization: billplzAuthHeader() },
  });
  if (!res.ok) return "unknown";
  const data = (await res.json().catch(() => null)) as { state?: string } | null;
  return String(data?.state || "unknown");
};

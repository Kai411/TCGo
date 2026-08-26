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

// ── Mass Payment (seller payouts) ─────────────────────────────────────
// Bills live on /api/v3; mass payment instructions live on /api/v4.

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
    throw createError({
      statusCode: 502,
      message: `Billplz error (${res.status}): ${text.slice(0, 300)}`,
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

// A collection groups instructions — we create one per payout batch so the
// Billplz dashboard mirrors our ledger one-to-one.
export const createMassPaymentCollection = async (title: string) =>
  await billplzForm<{ id: string; title: string }>(
    "/v4/mass_payment_instruction_collections",
    { title },
  );

export const createMassPaymentInstruction = async (input: {
  collectionId: string;
  bankCode: string;
  bankAccountNumber: string;
  identityNumber: string;
  name: string;
  description: string;
  /** Ringgit, converted to sen here. */
  amount: number;
  email?: string;
}) => {
  const params: Record<string, string> = {
    mass_payment_instruction_collection_id: input.collectionId,
    bank_code: input.bankCode,
    bank_account_number: input.bankAccountNumber,
    identity_number: input.identityNumber,
    name: input.name,
    description: input.description.slice(0, 120),
    total: String(Math.round(input.amount * 100)),
  };
  if (input.email) {
    params.email = input.email;
    params.notification = "email";
  }
  return await billplzForm<MassPaymentInstruction>(
    "/v4/mass_payment_instructions",
    params,
  );
};

export const getMassPaymentInstruction = async (id: string) => {
  const res = await fetch(`${billplzBaseUrl()}/v4/mass_payment_instructions/${id}`, {
    headers: { Authorization: billplzAuthHeader() },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[billplz] get instruction", res.status, text);
    throw createError({ statusCode: 502, message: "Couldn't read payout status" });
  }
  return JSON.parse(text) as MassPaymentInstruction;
};

// Billplz's instruction statuses aren't a stable closed set across accounts, so
// map the ones we know and treat anything unrecognised as still in flight —
// never as success. A payout only reaches "paid" on an explicit success value.
export const mapInstructionStatus = (
  raw: string | undefined,
): "processing" | "paid" | "failed" => {
  const s = String(raw || "").toLowerCase();
  if (["completed", "processed", "success", "successful", "paid"].includes(s)) return "paid";
  if (["rejected", "failed", "cancelled", "canceled", "returned"].includes(s)) return "failed";
  return "processing";
};

// Verify Billplz's X-Signature on callback payloads.
// Source string: every `billplz[...]` param except x_signature, formatted as
// `billplz<key><value>`, sorted case-insensitively, joined with "|", then
// HMAC-SHA256 with the X Signature Key.
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

// HMAC helpers on WebCrypto, so the same code runs in the Worker and in
// Node's test runner (both have globalThis.crypto.subtle).

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const hmacHex = async (key: string, message: string): Promise<string> => {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
};

/** Constant-time compare of two hex strings. */
export const sameHex = (a: string, b: string): boolean => {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// ── Calls from Netlify ────────────────────────────────────────────────
// Netlify signs `${timestamp}.${rawBody}` with the shared secret. The Worker
// refuses anything unsigned, wrongly signed, or more than a minute old, so a
// captured request can't be replayed later.

export const REQUEST_MAX_AGE_MS = 60_000;

export const signRequest = (secret: string, timestamp: number, body: string) =>
  hmacHex(secret, `${timestamp}.${body}`);

export const verifyRequest = async (
  secret: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  body: string,
  now: number,
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  if (!secret || secret.length < 32) return { ok: false, reason: "worker secret not configured" };
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || !signatureHeader) return { ok: false, reason: "unsigned" };
  if (Math.abs(now - ts) > REQUEST_MAX_AGE_MS) return { ok: false, reason: "stale" };
  const expected = await signRequest(secret, ts, body);
  return sameHex(expected, signatureHeader) ? { ok: true } : { ok: false, reason: "bad signature" };
};

// ── Billplz callback signature ────────────────────────────────────────
// Same algorithm as server/utils/billplz-callback.ts (signBillplzCallback):
// HMAC-SHA256 over the sorted `<key><value>` strings joined with `|`. The
// Worker checks it itself so a leaked Netlify secret alone can't record a
// payment Billplz never sent.

export const billplzSignature = (params: Record<string, string>, key: string) => {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === "x_signature") continue;
    parts.push(`${k}${v ?? ""}`);
  }
  parts.sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return hmacHex(key, parts.join("|"));
};

export const verifyBillplzParams = async (
  params: unknown,
  key: string,
): Promise<{ ok: true; params: Record<string, string> } | { ok: false; reason: string }> => {
  if (!key) return { ok: false, reason: "billplz key not configured" };
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return { ok: false, reason: "callback is not an object" };
  }
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (typeof v !== "string") return { ok: false, reason: `non-string field ${k}` };
    if (k.includes("[")) return { ok: false, reason: "redirect-style keys are not accepted" };
    flat[k] = v;
  }
  const given = flat.x_signature ?? "";
  if (!/^[0-9a-f]{64}$/i.test(given)) return { ok: false, reason: "missing signature" };
  if (!flat.id) return { ok: false, reason: "missing bill id" };
  const expected = await billplzSignature(flat, key);
  if (!sameHex(expected, given.toLowerCase())) return { ok: false, reason: "bad billplz signature" };
  return { ok: true, params: flat };
};

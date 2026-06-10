// Billplz helpers (FPX order payments).
//
// Auth is HTTP Basic with the API key as the username and an empty password.
// Sandbox and production are separate accounts/hosts — toggle with
// NUXT_BILLPLZ_SANDBOX=true.

import crypto from "node:crypto";

export const billplzBaseUrl = () => {
  const config = useRuntimeConfig();
  return config.billplzSandbox
    ? "https://www.billplz-sandbox.com/api"
    : "https://www.billplz.com/api";
};

export const billplzAuthHeader = () => {
  const config = useRuntimeConfig();
  const key = config.billplzApiKey as string;
  if (!key) throw createError({ statusCode: 500, message: "Billplz not configured" });
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
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
  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(params)) {
    const m = rawKey.match(/^billplz\[(.+)\]$/);
    if (!m || m[1] === "x_signature") continue;
    parts.push(`billplz${m[1]}${value ?? ""}`);
  }
  parts.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
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

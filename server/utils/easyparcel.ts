// EasyParcel Developer Hub client (api.easyparcel.com, OAuth 2.0).
//
// The Hub uses the authorization-code flow: an admin connects once via
// /api/easyparcel/connect (browser login → callback), and the resulting
// access + refresh tokens persist in Firestore (appSettings/easyparcel).
// Access tokens are JWTs (~10h); we refresh them with the stored refresh
// token when they near expiry.
//
// Endpoints (from EasyParcel's published Postman collection):
//   POST /open_api/{version}/shipment/quotations    — rate check
//   POST /open_api/{version}/shipment/submit_orders — book + auto-pay → AWB
//   GET  /open_api/{version}/wallet                 — credit balance

import { getAdminFirestore } from "~/server/utils/firebase-admin";

export const EP_BASE = "https://api.easyparcel.com";

const TOKENS_DOC = ["appSettings", "easyparcel"] as const;
// Refresh when fewer than 10 minutes of validity remain.
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

interface StoredTokens {
  accessToken: string;
  accessTokenExpMs: number;
  refreshToken: string;
  updatedAt: number;
}

let memo: StoredTokens | null = null;

export const epClientCreds = () => {
  const config = useRuntimeConfig();
  const clientId = config.easyparcelClientId as string;
  const clientSecret = config.easyparcelClientSecret as string;
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: "EasyParcel not configured" });
  }
  return { clientId, clientSecret };
};

export const epApiVersion = () =>
  (useRuntimeConfig().easyparcelApiVersion as string) || "2025-09";

// Decode a JWT's exp claim (ms). Falls back to now+9h if unparseable.
const jwtExpMs = (token: string): number => {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    if (payload?.exp) return payload.exp * 1000;
  } catch {}
  return Date.now() + 9 * 60 * 60 * 1000;
};

export const epSaveTokens = async (accessToken: string, refreshToken: string) => {
  const tokens: StoredTokens = {
    accessToken,
    accessTokenExpMs: jwtExpMs(accessToken),
    refreshToken,
    updatedAt: Date.now(),
  };
  memo = tokens;
  const db = getAdminFirestore();
  await db.collection(TOKENS_DOC[0]).doc(TOKENS_DOC[1]).set(tokens);
};

const loadTokens = async (): Promise<StoredTokens | null> => {
  if (memo) return memo;
  const db = getAdminFirestore();
  const snap = await db.collection(TOKENS_DOC[0]).doc(TOKENS_DOC[1]).get();
  if (!snap.exists) return null;
  memo = snap.data() as StoredTokens;
  return memo;
};

// Exchange at the token endpoint. Client auth goes in a Basic header
// (client_authentication=header per EasyParcel's own Postman config).
export const epTokenRequest = async (
  params: Record<string, string>,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const { clientId, clientSecret } = epClientCreds();
  const res = await fetch(`${EP_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data: any = await res.json().catch(() => null);
  const accessToken =
    data?.access_token ?? data?.data?.access_token ?? data?.token ?? null;
  const refreshToken =
    data?.refresh_token ?? data?.data?.refresh_token ?? "";
  if (!res.ok || !accessToken) {
    console.error("[easyparcel] token request failed:", res.status, JSON.stringify(data)?.slice(0, 400));
    throw createError({
      statusCode: 502,
      message: data?.msg || "EasyParcel token exchange failed",
    });
  }
  return { accessToken, refreshToken };
};

export const epAccessToken = async (): Promise<string> => {
  const stored = await loadTokens();
  if (!stored) {
    throw createError({
      statusCode: 409,
      message:
        "EasyParcel not connected — open /api/easyparcel/connect in a browser as the platform admin first.",
    });
  }
  if (stored.accessTokenExpMs - Date.now() > REFRESH_MARGIN_MS) {
    return stored.accessToken;
  }
  // Refresh (rotating refresh tokens are persisted back).
  const { accessToken, refreshToken } = await epTokenRequest({
    grant_type: "refresh_token",
    refresh_token: stored.refreshToken,
  });
  await epSaveTokens(accessToken, refreshToken || stored.refreshToken);
  return accessToken;
};

export const epPost = async (path: string, body: unknown): Promise<any> => {
  const token = await epAccessToken();
  const res = await fetch(`${EP_BASE}/open_api/${epApiVersion()}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || (data?.status_code && data.status_code >= 400)) {
    console.error(`[easyparcel] ${path} failed:`, res.status, JSON.stringify(data)?.slice(0, 500));
    throw createError({
      statusCode: 502,
      message: data?.message || data?.msg || "Shipping provider error",
    });
  }
  return data;
};

// Legacy EasyParcel state codes (stored on profiles/orders) → ISO 3166-2:MY
// subdivision codes the Hub API expects.
const LEGACY_TO_ISO: Record<string, string> = {
  jhr: "MY-01",
  kdh: "MY-02",
  ktn: "MY-03",
  mlk: "MY-04",
  nsn: "MY-05",
  phg: "MY-06",
  png: "MY-07",
  prk: "MY-08",
  pls: "MY-09",
  sgr: "MY-10",
  trg: "MY-11",
  sbh: "MY-12",
  srw: "MY-13",
  kul: "MY-14",
  lbn: "MY-15",
  pjy: "MY-16",
};

export const toSubdivision = (stateCode: string | undefined): string =>
  LEGACY_TO_ISO[(stateCode || "").toLowerCase()] || stateCode || "";

// Split a MY phone into the Hub's country-code + national-number shape.
export const epPhone = (raw: string | undefined): string => {
  let p = (raw || "").replace(/[^0-9]/g, "");
  if (p.startsWith("60")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
};

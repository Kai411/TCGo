// eBay Browse API: application token and item search.
//
// The keyset comes from Netlify environment variables (NUXT_EBAY_APP_ID and
// NUXT_EBAY_CERT_ID); it is never stored anywhere else. Unset = the feature
// is off and the card page shows no eBay section.

import { EBAY_CARD_CATEGORY, EBAY_MARKETPLACE } from "~/shared/ebay";

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-scoped, like the FX rate: survives across requests in a warm
// function. One token per scope; a token lasts about two hours, so renew five
// minutes early.
const tokenCache = new Map<string, TokenCache>();

const BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope";
// Marketplace Insights (sold items). eBay only grants it to keysets it has
// approved; others get invalid_scope here.
const INSIGHTS_SCOPE =
  "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights";

export const ebayKeys = () => {
  const config = useRuntimeConfig();
  const appId = String(config.ebayAppId ?? "").trim();
  const certId = String(config.ebayCertId ?? "").trim();
  return appId && certId ? { appId, certId } : null;
};

const appToken = async (scope: string) => {
  const keys = ebayKeys();
  if (!keys) throw new Error("eBay keys are not set");
  const cached = tokenCache.get(scope);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const res = await $fetch<{ access_token: string; expires_in: number }>(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keys.appId}:${keys.certId}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope,
      }).toString(),
      timeout: 6000,
    },
  ).catch((err) => {
    throw new EbayCallError("token", err);
  });
  tokenCache.set(scope, {
    token: res.access_token,
    expiresAt: Date.now() + Math.max(60, (res.expires_in ?? 7200) - 300) * 1000,
  });
  return res.access_token;
};

// Active fixed-price listings in eBay's trading card singles category, in
// eBay's own Best Match order (the Buy API terms don't allow re-sorting).
export const searchEbayCards = async (query: string, limit: number) => {
  const token = await appToken(BROWSE_SCOPE);
  const res = await $fetch<{ total?: number; itemSummaries?: unknown[] }>(
    "https://api.ebay.com/buy/browse/v1/item_summary/search",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE,
      },
      query: {
        q: query,
        category_ids: EBAY_CARD_CATEGORY,
        filter: "buyingOptions:{FIXED_PRICE}",
        limit,
      },
      timeout: 6000,
    },
  ).catch((err) => {
    throw new EbayCallError("search", err);
  });
  return { total: res.total ?? 0, items: res.itemSummaries ?? [] };
};

// Recent sales (eBay keeps the last 90 days) in the same category.
export const searchEbaySales = async (query: string, limit: number) => {
  const token = await appToken(INSIGHTS_SCOPE);
  const res = await $fetch<{ total?: number; itemSales?: unknown[] }>(
    "https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE,
      },
      query: { q: query, category_ids: EBAY_CARD_CATEGORY, limit },
      timeout: 6000,
    },
  ).catch((err) => {
    throw new EbayCallError("search", err);
  });
  return { total: res.total ?? 0, items: res.itemSales ?? [] };
};

// What to log and report when eBay refuses: status and eBay's own error
// codes and messages, never the request (its headers hold the keys/token).
export class EbayCallError extends Error {
  constructor(
    readonly stage: "token" | "search",
    readonly inner: any,
  ) {
    super(`eBay ${stage} call failed`);
  }
}

export const ebayErrorSummary = (err: any) => {
  const stage: "token" | "search" =
    err instanceof EbayCallError ? err.stage : "search";
  const inner = err instanceof EbayCallError ? err.inner : err;
  const data = inner?.data;
  let reason: string;
  if (Array.isArray(data?.errors)) {
    reason = data.errors
      .map((e: any) => `${e?.errorId ?? ""} ${e?.message ?? ""}`.trim())
      .join("; ");
  } else if (typeof data?.error === "string") {
    // OAuth errors: { error: "invalid_client", error_description: "..." }
    reason = [data.error, data.error_description].filter(Boolean).join(": ");
  } else {
    reason = String(inner?.statusMessage ?? inner?.message ?? "unknown").slice(0, 200);
  }
  return {
    stage,
    status: inner?.statusCode ?? inner?.status ?? null,
    reason: reason.slice(0, 300),
  };
};

// Drop the cached token after an auth failure so the next call gets a new one.
export const forgetEbayToken = () => {
  tokenCache.clear();
};

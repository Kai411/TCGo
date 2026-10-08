// Active eBay listings for one card, for the card price page.
//
// GET /api/ebay/listings?name=Charizard%20ex&number=199/165&language=English
//
// Off ({ enabled: false }) until NUXT_EBAY_APP_ID and NUXT_EBAY_CERT_ID are
// set. Results are kept for an hour per search, in memory and at the CDN, so
// a card viewed all day costs a handful of the 5,000 daily Browse calls, and
// what's shown stays well inside eBay's six-hour freshness limit. Failures
// come back as ok: false so the page can hide the section quietly.

import {
  EBAY_LISTING_LIMIT,
  ebayQuery,
  ebaySearchUrl,
  toEbayListing,
  type EbayListingsResponse,
} from "~/shared/ebay";

const TTL_MS = 60 * 60 * 1000;
const FAIL_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { at: number; ttl: number; body: EbayListingsResponse }>();

const remember = (key: string, ttl: number, body: EbayListingsResponse) => {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), ttl, body });
};

export default defineEventHandler(async (event): Promise<EbayListingsResponse> => {
  if (!ebayKeys()) return { enabled: false };

  const params = getQuery(event);
  const query = ebayQuery({
    name: String(params.name ?? "").slice(0, 200),
    number: String(params.number ?? "").slice(0, 40),
    language: String(params.language ?? "").slice(0, 40),
  });
  if (!query) {
    throw createError({ statusCode: 400, statusMessage: "Card name required" });
  }

  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < hit.ttl) {
    setResponseHeader(event, "Cache-Control", "public, max-age=300");
    return hit.body;
  }

  const base = {
    enabled: true as const,
    query,
    searchUrl: ebaySearchUrl(query),
    fetchedAt: Date.now(),
  };

  try {
    const [{ total, items }, fx] = await Promise.all([
      searchEbayCards(query, EBAY_LISTING_LIMIT),
      $fetch<{ rate: number }>("/api/fx/usd-myr"),
    ]);
    const body: EbayListingsResponse = {
      ...base,
      ok: true,
      total,
      items: items
        .map((raw) => toEbayListing(raw, fx.rate))
        .filter((item) => item !== null),
    };
    remember(query, TTL_MS, body);
    setResponseHeader(event, "Cache-Control", "public, max-age=300");
    setResponseHeader(event, "Netlify-CDN-Cache-Control", "public, s-maxage=3600");
    return body;
  } catch (err) {
    const summary = ebayErrorSummary(err);
    if (summary.status === 401) forgetEbayToken();
    console.error("[ebay] listings search failed:", summary);
    const body: EbayListingsResponse = { ...base, ok: false, total: 0, items: [] };
    remember(query, FAIL_TTL_MS, body);
    return body;
  }
});

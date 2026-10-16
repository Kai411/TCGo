// eBay listings for the card price page: building the search and shaping
// eBay's Browse API results. Pure functions so they can be tested without a
// network; the token and the call itself live in server/utils/ebay.ts.
//
// What the keyset can and can't do (checked against eBay's docs, 2026-10):
// the Browse API's item_summary/search gives *active* listings with an
// application token. Sold prices sit in the Marketplace Insights API, which
// is limited release, and the old Finding API is gone. So these are asking
// prices, and the page has to say so.
//
// Sold mode (2026-10-16): the page asks for Marketplace Insights sales first
// and falls back to active listings when the keyset isn't approved for it
// (eBay refuses the token with invalid_scope). The sales are shown, never
// averaged into TCGo's market price: the licence (§8.5, §8.1) needs eBay's
// written consent to build pricing tools or average selling prices from them.
//
// eBay's API License Agreement shapes the rest: listing data shown may be at
// most 6 hours behind eBay (we keep it about an hour and show when it was
// checked), it must stay visually apart from non-eBay content (its own
// section), and it may not be used to model prices with other data (it never
// feeds TCGo's market price).

// Toys & Hobbies > Collectible Card Games > CCG Individual Cards.
export const EBAY_CARD_CATEGORY = "183454";
export const EBAY_MARKETPLACE = "EBAY_US";
export const EBAY_LISTING_LIMIT = 6;

export type EbayMode = "sold" | "active";
export const ebayMode = (value: unknown): EbayMode =>
  value === "active" ? "active" : "sold";

export interface EbayCardQueryInput {
  name: string;
  number?: string | null;
  language?: string | null;
}

export interface EbayListing {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  condition: string | null;
  seller: string | null;
  price: { value: number; currency: string };
  // Null when eBay quotes something other than USD; the page then shows the
  // original price only.
  myr: number | null;
  // Sold mode only: when it last sold (ISO date).
  soldAt?: string | null;
}

export type EbayListingsResponse =
  | { enabled: false }
  | {
      enabled: true;
      mode: EbayMode;
      ok: boolean;
      query: string;
      searchUrl: string;
      fetchedAt: number;
      total: number;
      items: EbayListing[];
      // Only when ok is false: which eBay call failed and eBay's own reason,
      // so the problem can be read from the endpoint without the logs.
      error?: { stage: "token" | "search"; status: number | null; reason: string };
    };

// eBay caps `q` at 100 characters.
const MAX_QUERY = 100;

// "Pikachu - 2006 (Jason Klaczynski)" → "Pikachu": eBay titles rarely carry
// the catalogue's extra qualifier, and every extra word narrows the match.
const baseName = (name: string) => name.split(" - ")[0];

const clean = (text: string) =>
  text
    .replace(/[()[\]{}"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const ebayQuery = ({ name, number, language }: EbayCardQueryInput) => {
  const parts = [clean(baseName(name ?? ""))];
  const printed = clean(number ?? "");
  if (printed && !parts[0].includes(printed)) parts.push(printed);
  if (/japan/i.test(language ?? "") && !/japan/i.test(parts[0])) {
    parts.push("Japanese");
  }
  return parts.filter(Boolean).join(" ").slice(0, MAX_QUERY).trim();
};

export const ebaySearchUrl = (query: string, mode: EbayMode = "active") =>
  `https://www.ebay.com/sch/i.html?${new URLSearchParams({
    _nkw: query,
    _sacat: EBAY_CARD_CATEGORY,
    ...(mode === "sold" ? { LH_Sold: "1", LH_Complete: "1" } : {}),
  })}`;

// eBay listing photos, served through Netlify's Image CDN like card art
// (see shared/card-image.ts). Linked straight from i.ebayimg.com every photo
// showed as a broken image on staging; fetched by our own edge, eBay's
// cross-site and hotlink rules don't come into it. The host
// must stay in netlify.toml's [images] remote_images allowlist.
export const EBAY_IMAGE_HOST = "i.ebayimg.com";

export const ebayImageUrl = (src: string | null, width: number) => {
  if (!src) return null;
  let host = "";
  try {
    host = new URL(src).hostname;
  } catch {
    return null;
  }
  if (host !== EBAY_IMAGE_HOST || import.meta.dev) return src;
  const params = new URLSearchParams({
    url: src,
    w: String(Math.round(width * 2)),
    fm: "webp",
    q: "78",
  });
  return `/.netlify/images?${params.toString()}`;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const httpsUrl = (value: unknown) => {
  const url = text(value);
  return url && /^https:\/\//.test(url) ? url : null;
};

// Shapes one Browse API `itemSummary`. Returns null for anything the page
// couldn't show honestly (no price, no link).
export const toEbayListing = (
  raw: any,
  usdMyr: number,
): EbayListing | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.itemId);
  const title = text(raw.title);
  const url = httpsUrl(raw.itemWebUrl);
  const value = Number(raw.price?.value);
  const currency = text(raw.price?.currency);
  if (!id || !title || !url || !currency || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return {
    id,
    title,
    url,
    imageUrl:
      httpsUrl(raw.thumbnailImages?.[0]?.imageUrl) ?? httpsUrl(raw.image?.imageUrl),
    condition: text(raw.condition),
    seller: text(raw.seller?.username),
    price: { value, currency },
    myr:
      currency === "USD" && usdMyr > 0
        ? Math.round(value * usdMyr * 100) / 100
        : null,
  };
};

// eBay item ids look like "v1|123456789012|0"; the middle part is the listing
// number eBay's own pages use.
const itemPageUrl = (itemId: string) => {
  const legacy = itemId.split("|")[1] ?? "";
  return /^\d+$/.test(legacy) ? `https://www.ebay.com/itm/${legacy}` : null;
};

// Shapes one Marketplace Insights `itemSale`. Same rules as toEbayListing,
// with the last sold price and date in place of the asking price.
export const toEbaySale = (raw: any, usdMyr: number): EbayListing | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.itemId);
  const listing = toEbayListing(
    {
      ...raw,
      price: raw.lastSoldPrice,
      itemWebUrl: raw.itemWebUrl ?? (id ? itemPageUrl(id) : null),
    },
    usdMyr,
  );
  if (!listing) return null;
  const soldAt = text(raw.lastSoldDate);
  return {
    ...listing,
    soldAt: soldAt && Number.isFinite(Date.parse(soldAt)) ? soldAt : null,
  };
};

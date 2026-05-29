// Read access to the TCGo catalog hosted in Supabase.
//
// Two entry points:
//   - searchCatalog(query)            : fuzzy name search for the
//                                       add-to-collection / scanner suggestion UI.
//   - lookupByNameAndNumber(name, n)  : "did the scanner read a real card?"
//                                       Returns exact-ish matches with prices.
//
// Both return rows that include the joined card_prices.prices JSONB so a
// single round-trip gives us the current market price too.

// ── Smart query parsing ───────────────────────────────────────────────
//
// Buyer-friendly natural input like:
//   "pikachu 151"           → name="pikachu", set hint="151"
//   "pikachu ir"            → name="pikachu", rarity="Illustration Rare"
//   "pikachu obsidian sir"  → name="pikachu", set hint="obsidian",
//                              rarity="Special Illustration Rare"
//
// Strategy: the leftmost token(s) form the name; trailing tokens that
// match a known rarity abbreviation are lifted out; everything else
// becomes a free-text set hint (joined with spaces). Filters caught
// here override the user's explicit dropdown filters so smart-typing
// always wins — the UI surfaces what got parsed via chips.

// Order matters — multi-char keys are checked before single-char so
// "SIR" doesn't get consumed as "S" + "IR".
const RARITY_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/^sir$/i, "Special Illustration Rare"],
  [/^ir$/i, "Illustration Rare"],
  [/^sr$/i, "Secret Rare"],
  [/^ur$/i, "Ultra Rare"],
  [/^hr$/i, "Hyper Rare"],
  [/^dr$/i, "Double Rare"],
  [/^ar$/i, "Art Rare"],
  [/^rh$/i, "Reverse Holo"],
  [/^holo$/i, "Holo Rare"],
  [/^promo$/i, "Promo"],
  [/^ace$/i, "ACE SPEC Rare"],
];

const matchRarity = (token: string): string | null => {
  for (const [pattern, full] of RARITY_ABBREVIATIONS) {
    if (pattern.test(token)) return full;
  }
  return null;
};

export interface ParsedQuery {
  name: string;
  setHint: string | null;
  rarityHint: string | null;
}

export const parseSmartQuery = (input: string): ParsedQuery => {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { name: "", setHint: null, rarityHint: null };

  // First token is always part of the name. Walk forward consuming further
  // tokens into the name until we hit a "filter-looking" token (rarity
  // abbreviation or numeric-only set hint). After that, leftover tokens
  // populate the set hint.
  let nameParts: string[] = [tokens[0]];
  let rarityHint: string | null = null;
  const setParts: string[] = [];

  let nameClosed = false;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const rarity = matchRarity(token);
    if (rarity) {
      rarityHint = rarity;
      nameClosed = true;
      continue;
    }
    // Pure numeric token → likely a set hint ("151", "164" etc).
    if (/^\d+$/.test(token)) {
      setParts.push(token);
      nameClosed = true;
      continue;
    }
    if (!nameClosed) {
      // Could still be a multi-word card name ("charizard ex", "rayquaza vmax")
      // — only treat as set if we've already seen a filter token.
      nameParts.push(token);
    } else {
      setParts.push(token);
    }
  }

  return {
    name: nameParts.join(" "),
    setHint: setParts.length ? setParts.join(" ") : null,
    rarityHint,
  };
};

// USD → MYR conversion. TCGPlayer publishes prices in USD; we multiply by a
// live rate fetched from /api/fx/usd-myr (cached server-side for 12h). Until
// that resolves — and if the feed ever fails — we fall back to this static
// ballpark so prices still render.
const USD_MYR_FALLBACK = 4.7;

// Module-level so the rate is shared across every useCardCatalog() call and
// fetched at most once per session.
let usdMyrRate = USD_MYR_FALLBACK;
let ratePromise: Promise<void> | null = null;

// Fetch the live rate once. Subsequent calls reuse the same in-flight/settled
// promise, so callers can `await ensureRate()` cheaply before pricing rows.
const ensureRate = (): Promise<void> => {
  if (ratePromise) return ratePromise;
  ratePromise = (async () => {
    try {
      const res = await $fetch<{ rate: number }>("/api/fx/usd-myr");
      if (res?.rate && res.rate > 0) usdMyrRate = res.rate;
    } catch {
      // Keep the fallback rate.
    }
  })();
  return ratePromise;
};

// Convert a USD figure to MYR, keeping 2 decimal places (cents).
const toMyr = (usd: number) => Math.round(usd * usdMyrRate * 100) / 100;

// TCGPlayer publishes per-subtype prices. We prefer Holofoil → Normal →
// Reverse Holofoil; for a sealed product the only key is usually "Normal".
const SUBTYPE_PREFERENCE = [
  "Holofoil",
  "Normal",
  "Reverse Holofoil",
  "1st Edition Holofoil",
  "1st Edition Normal",
  "Unlimited Holofoil",
];

export interface CatalogPrice {
  // Current market price, MYR.
  market: number;
  // Sub-type used for the price ("Holofoil" / "Normal" / ...).
  subtype: string;
  // Range for buyer guidance — low/high in MYR.
  low: number;
  high: number;
}

export type CatalogSort = "best" | "name" | "price_asc" | "price_desc";

// What we return to callers: the catalog row + a derived MYR price.
export interface CatalogMatch {
  productId: number;
  name: string;
  setName: string;          // group_name in the DB
  number: string | null;    // "125/197" (printed number)
  rarity: string | null;
  imageUrl: string | null;
  language: string;
  price: CatalogPrice | null;
}

// Pull the best market price out of the card_prices.prices JSONB and
// convert to MYR. Returns null if nothing usable was published.
const pickPrice = (prices: Record<string, any> | null | undefined): CatalogPrice | null => {
  if (!prices || typeof prices !== "object") return null;
  for (const subtype of SUBTYPE_PREFERENCE) {
    const block = prices[subtype];
    if (!block) continue;
    const market = block.market ?? block.mid ?? null;
    if (market == null) continue;
    return {
      market: toMyr(market),
      subtype,
      low: toMyr(block.low ?? market),
      high: toMyr(block.high ?? market),
    };
  }
  // Fallback: any subtype with a usable market value.
  for (const [subtype, block] of Object.entries(prices)) {
    const b = block as any;
    if (!b) continue;
    const market = b.market ?? b.mid ?? null;
    if (market == null) continue;
    return {
      market: toMyr(market),
      subtype,
      low: toMyr(b.low ?? market),
      high: toMyr(b.high ?? market),
    };
  }
  return null;
};

// TCGPlayer's CDN serves the same product image at multiple widths by
// swapping a `_<width>w` token in the URL (e.g. `_200w.jpg` → `_400w.jpg`).
// TCGCSV stores the small thumbnail variant; we upgrade to 400w here so
// every consumer renders at 2× resolution without re-seeding.
const upgradeImageRes = (url: string | null | undefined): string | null => {
  if (!url) return null;
  return url.replace(/_200w(\.\w+)(\?.*)?$/i, "_400w$1$2");
};

// Lift a Supabase row (with embedded card_prices) into the public shape.
const rowToMatch = (row: any): CatalogMatch => ({
  productId: row.product_id,
  name: row.name,
  setName: row.group_name ?? "",
  number: row.number ?? null,
  rarity: row.rarity ?? null,
  imageUrl: upgradeImageRes(row.image_url),
  language: row.language ?? "EN",
  // PostgREST embed: card_prices may come back as an array (one-to-many
  // shape) or a single object depending on the inferred relationship.
  price: pickPrice(
    Array.isArray(row.card_prices) ? row.card_prices[0]?.prices : row.card_prices?.prices,
  ),
});

// Columns we always need. The card_prices embed pulls the current prices
// JSONB so we never need a second round-trip just for a price tag.
const SELECT_COLUMNS =
  "product_id, name, group_name, number, rarity, image_url, language, card_prices(prices)";

export const useCardCatalog = () => {
  // Catch missing env vars at composable boundary so pages that *also*
  // happen to render scanner/collection components don't crash entirely
  // when Supabase isn't configured yet. Methods below return empty results
  // and log a single warning.
  let supabase: ReturnType<typeof useSupabase> | null = null;
  try {
    supabase = useSupabase();
  } catch (err) {
    console.warn(
      "[useCardCatalog] disabled — Supabase env vars not set (NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY). " +
        "Add them to .env and restart the dev server.",
    );
  }

  // Fuzzy name search via the `search_catalog` Postgres RPC. Returns the
  // matched page plus the total count so the caller knows whether to
  // render a "load more" button. Filters and sort are optional — defaults
  // give the original prefix → similarity → alphabetical ordering.
  const searchCatalog = async (
    query: string,
    opts: {
      limit?: number;
      page?: number;
      language?: "EN" | "JP" | "ALL";
      setMatch?: string | null;
      rarityMatch?: string | null;
      sort?: CatalogSort;
    } = {},
  ): Promise<{ results: CatalogMatch[]; total: number }> => {
    if (!supabase) return { results: [], total: 0 };
    const trimmed = query.trim();
    const setMatch = opts.setMatch?.trim() || null;
    const rarityMatch = opts.rarityMatch?.trim() || null;
    // RPC requires either a usable name OR at least one filter.
    if (trimmed.length < 2 && !setMatch && !rarityMatch) {
      return { results: [], total: 0 };
    }

    // Fetch the FX rate concurrently with the query.
    const fxReady = ensureRate();

    const { data, error } = await supabase.rpc("search_catalog", {
      q: trimmed,
      page: opts.page ?? 0,
      page_size: opts.limit ?? 28,
      lang: opts.language ?? "EN",
      set_match: setMatch,
      rarity_match: rarityMatch,
      sort_by: opts.sort ?? "best",
    });

    if (error) {
      console.error("[useCardCatalog] searchCatalog error:", error.message);
      return { results: [], total: 0 };
    }

    await fxReady;
    const rows = (data ?? []) as Array<any>;
    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
    const results: CatalogMatch[] = rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      setName: row.group_name ?? "",
      number: row.number ?? null,
      rarity: row.rarity ?? null,
      imageUrl: upgradeImageRes(row.image_url),
      language: row.language ?? "EN",
      price: pickPrice(row.prices),
    }));
    return { results, total };
  };

  // Dropdown helpers — cached at composable level so we only hit Supabase
  // once per session per language.
  const listSets = async (
    language: "EN" | "JP" | "ALL" = "EN",
  ): Promise<Array<{ name: string; count: number }>> => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("list_sets", { lang: language });
    if (error) {
      console.error("[useCardCatalog] listSets error:", error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      name: r.group_name,
      count: Number(r.card_count),
    }));
  };

  const listRarities = async (
    language: "EN" | "JP" | "ALL" = "EN",
  ): Promise<Array<{ name: string; count: number }>> => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("list_rarities", { lang: language });
    if (error) {
      console.error("[useCardCatalog] listRarities error:", error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      name: r.rarity,
      count: Number(r.card_count),
    }));
  };

  // Used by the scanner. Tries to narrow by printed number first (e.g.
  // "125/197" → match either "125/197" or "125"). Falls back to name-only
  // if the number is empty or the number-constrained query returns nothing.
  const lookupByNameAndNumber = async (
    name: string,
    number: string,
    opts: { language?: "EN" | "JP" } = {},
  ): Promise<{ exact: CatalogMatch[]; suggestions: CatalogMatch[] }> => {
    if (!supabase) return { exact: [], suggestions: [] };
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return { exact: [], suggestions: [] };

    // Fetch the FX rate concurrently with the lookup.
    const fxReady = ensureRate();

    const numericOnly = number?.includes("/") ? number.split("/")[0].trim() : number?.trim();

    // Step 1: exact-ish match (name ILIKE + matching number form).
    if (numericOnly) {
      let q = supabase
        .from("cards_catalog")
        .select(SELECT_COLUMNS)
        .ilike("name", `${trimmedName}%`)
        .or(`number.eq.${number},number.like.${numericOnly}/%,number.eq.${numericOnly}`)
        .limit(8);

      if (opts.language) q = q.eq("language", opts.language);

      const { data, error } = await q;
      if (error) {
        console.error("[useCardCatalog] exact lookup error:", error.message);
      } else if (data && data.length > 0) {
        await fxReady;
        return { exact: data.map(rowToMatch), suggestions: [] };
      }
    }

    // Step 2: name-only fallback — show suggestions in the scanner.
    let fallback = supabase
      .from("cards_catalog")
      .select(SELECT_COLUMNS)
      .ilike("name", `${trimmedName}%`)
      .order("name", { ascending: true })
      .limit(12);

    if (opts.language) fallback = fallback.eq("language", opts.language);

    const { data: fbData, error: fbErr } = await fallback;
    if (fbErr) {
      console.error("[useCardCatalog] suggestion lookup error:", fbErr.message);
      return { exact: [], suggestions: [] };
    }
    await fxReady;
    return { exact: [], suggestions: (fbData ?? []).map(rowToMatch) };
  };

  // Detail-page lookup — fetch a single catalog row + its current price.
  const getCardWithPrice = async (productId: number): Promise<CatalogMatch | null> => {
    if (!supabase) return null;
    const fxReady = ensureRate();
    const { data, error } = await supabase
      .from("cards_catalog")
      .select(SELECT_COLUMNS)
      .eq("product_id", productId)
      .single();
    if (error || !data) return null;
    await fxReady;
    return rowToMatch(data);
  };

  // Batch fetch for the collection page — caller passes the productIds in
  // their pivot doc, we return full catalog + current price for each. Order
  // matches the input array so the caller can render in their preferred
  // order (typically most-recent-first).
  const getCardsByIds = async (productIds: number[]): Promise<CatalogMatch[]> => {
    if (!supabase) return [];
    if (productIds.length === 0) return [];
    await ensureRate();
    // PostgREST .in() supports a few thousand IDs per call, but chunking
    // keeps URLs short and stays well under any proxy limits.
    const CHUNK = 200;
    const all: CatalogMatch[] = [];
    for (let i = 0; i < productIds.length; i += CHUNK) {
      const chunk = productIds.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("cards_catalog")
        .select(SELECT_COLUMNS)
        .in("product_id", chunk);
      if (error) {
        console.error("[useCardCatalog] getCardsByIds error:", error.message);
        continue;
      }
      for (const row of data ?? []) all.push(rowToMatch(row));
    }
    // Re-order to match the caller's input.
    const byId = new Map(all.map((m) => [m.productId, m]));
    return productIds.map((id) => byId.get(id)).filter(Boolean) as CatalogMatch[];
  };

  return {
    searchCatalog,
    lookupByNameAndNumber,
    getCardWithPrice,
    getCardsByIds,
    listSets,
    listRarities,
  };
};

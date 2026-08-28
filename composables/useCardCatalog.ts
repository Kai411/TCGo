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

/**
 * One day of the capped 365-entry series kept in card_prices.history, which a
 * daily cron prepends via the snapshot_prices_today() RPC. `market` is USD as
 * stored; callers get MYR from getPriceHistory().
 */
export interface PricePoint {
  date: string; // YYYY-MM-DD
  market: number; // MYR once returned by getPriceHistory
}

export interface PriceTrend {
  points: PricePoint[];
  /** Percentage change across the returned window; null if not computable. */
  changePct: number | null;
  first: number;
  last: number;
  min: number;
  max: number;
  requestedDays: number;
  oldestAvailableDate: string;
  latestAvailableDate: string;
  availableSpanDays: number;
  snapshotCount: number;
  hasFullCoverage: boolean;
}

export interface CollectionPriceTrend {
  trend: PriceTrend | null;
  trackedCards: number;
  historyCards: number;
  totalCards: number;
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

const DAY_MS = 86_400_000;

const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

const historyPoints = (raw: unknown): PricePoint[] => {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, number>();
  for (const point of raw) {
    if (!point || typeof point !== "object") continue;
    const date = String((point as any).date ?? "");
    const rawMarket = (point as any).market;
    const market = rawMarket == null ? Number.NaN : toMyr(Number(rawMarket));
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(dayTime(date)) ||
      !Number.isFinite(market)
    ) {
      continue;
    }
    byDate.set(date, market);
  }
  return [...byDate.entries()]
    .map(([date, market]) => ({ date, market }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/** Build chart statistics using a real calendar window, not a point count. */
export const buildPriceTrend = (
  sourcePoints: PricePoint[],
  requestedDays = 90,
): PriceTrend | null => {
  const byDate = new Map<string, number>();
  for (const point of sourcePoints) {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
      Number.isFinite(dayTime(point.date)) &&
      Number.isFinite(point.market)
    ) {
      byDate.set(point.date, point.market);
    }
  }
  const allPoints = [...byDate.entries()]
    .map(([date, market]) => ({ date, market }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!allPoints.length) return null;
  const oldestAvailableDate = allPoints[0]!.date;
  const latestAvailableDate = allPoints[allPoints.length - 1]!.date;
  const oldestTime = dayTime(oldestAvailableDate);
  const latestTime = dayTime(latestAvailableDate);
  const safeDays = Math.max(1, Math.floor(requestedDays));
  const cutoff = latestTime - (safeDays - 1) * DAY_MS;
  const points = allPoints.filter((point) => dayTime(point.date) >= cutoff);
  if (!points.length) return null;

  const first = points[0]!.market;
  const last = points[points.length - 1]!.market;
  const values = points.map((point) => point.market);

  return {
    points,
    changePct: first > 0 ? ((last - first) / first) * 100 : null,
    first,
    last,
    min: Math.min(...values),
    max: Math.max(...values),
    requestedDays: safeDays,
    oldestAvailableDate,
    latestAvailableDate,
    availableSpanDays: Math.max(1, Math.floor((latestTime - oldestTime) / DAY_MS) + 1),
    snapshotCount: allPoints.length,
    hasFullCoverage: oldestTime <= cutoff,
  };
};

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

  /**
   * Suggestions for a catalogue detail page. Same-name printings come first,
   * followed by cards from the same exact set, with rarity and live pricing as
   * secondary signals. This stays entirely within the existing catalogue.
   */
  const getRelatedCards = async (
    card: CatalogMatch,
    limit = 5,
  ): Promise<CatalogMatch[]> => {
    if (!supabase || limit <= 0) return [];

    const [sameName, sameSet] = await Promise.all([
      searchCatalog(card.name, {
        limit: Math.max(12, limit * 2),
        language: card.language === "JP" ? "JP" : "EN",
        sort: "best",
      }),
      searchCatalog("", {
        limit: Math.max(24, limit * 4),
        language: card.language === "JP" ? "JP" : "EN",
        setMatch: card.setName,
        sort: "price_desc",
      }),
    ]);

    const candidates = new Map<number, CatalogMatch>();
    for (const candidate of [...sameName.results, ...sameSet.results]) {
      if (candidate.productId === card.productId) continue;
      // The RPC's set filter is a substring match. Keep only exact-set rows so
      // similarly named sets never leak into the recommendation rail.
      const isSameName = candidate.name.toLowerCase() === card.name.toLowerCase();
      const isSameSet = candidate.setName === card.setName;
      if (!isSameName && !isSameSet) continue;
      candidates.set(candidate.productId, candidate);
    }

    return [...candidates.values()]
      .sort((a, b) => {
        const aName = a.name.toLowerCase() === card.name.toLowerCase() ? 1 : 0;
        const bName = b.name.toLowerCase() === card.name.toLowerCase() ? 1 : 0;
        if (aName !== bName) return bName - aName;
        const aRarity = a.rarity && a.rarity === card.rarity ? 1 : 0;
        const bRarity = b.rarity && b.rarity === card.rarity ? 1 : 0;
        if (aRarity !== bRarity) return bRarity - aRarity;
        return (b.price?.market ?? 0) - (a.price?.market ?? 0);
      })
      .slice(0, limit);
  };

  /** Fetch oldest-first history series for many products, converted to MYR. */
  const getPriceHistories = async (
    productIds: number[],
  ): Promise<Map<number, PricePoint[]>> => {
    const histories = new Map<number, PricePoint[]>();
    if (!supabase || productIds.length === 0) return histories;
    await ensureRate();

    const uniqueIds = [...new Set(productIds)];
    const CHUNK = 200;
    for (let i = 0; i < uniqueIds.length; i += CHUNK) {
      const chunk = uniqueIds.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("card_prices")
        .select("product_id, history")
        .in("product_id", chunk);
      if (error) {
        console.error("[useCardCatalog] getPriceHistories error:", error.message);
        continue;
      }
      for (const row of data ?? []) {
        histories.set(Number((row as any).product_id), historyPoints((row as any).history));
      }
    }
    return histories;
  };

  /**
   * Historical raw-market value of the current basket. The same set of cards
   * is used for every point, so cards with shorter histories cannot create a
   * fake jump merely by entering the dataset midway through the chart.
   */
  const getCollectionPriceTrend = async (
    productIds: number[],
    days = 30,
  ): Promise<CollectionPriceTrend> => {
    const uniqueIds = [...new Set(productIds)];
    const histories = await getPriceHistories(uniqueIds);
    const usable = uniqueIds
      .map((productId) => ({ productId, points: histories.get(productId) ?? [] }))
      .filter((item) => item.points.length >= 2);

    if (!usable.length) {
      return {
        trend: null,
        trackedCards: 0,
        historyCards: 0,
        totalCards: uniqueIds.length,
      };
    }

    const latestTime = Math.max(
      ...usable.map((item) => dayTime(item.points[item.points.length - 1]!.date)),
    );
    const cutoff = latestTime - (Math.max(1, days) - 1) * DAY_MS;
    let tracked = usable.filter((item) => dayTime(item.points[0]!.date) <= cutoff);

    // If no card has a complete requested window yet, still show the honest
    // shared partial history instead of inventing earlier values.
    let startTime = cutoff;
    if (!tracked.length) {
      tracked = usable;
      startTime = Math.max(...tracked.map((item) => dayTime(item.points[0]!.date)));
    }

    // Aggregate only dates actually observed for every tracked card. Carrying
    // an old value forward would disguise stale or missing snapshots as fresh
    // market data and can create a misleading collection total.
    const valuesByCard = tracked.map(
      (item) => new Map(item.points.map((point) => [point.date, point.market])),
    );
    const eventDates = [...valuesByCard[0]!.keys()]
      .filter((date) => {
        const time = dayTime(date);
        return (
          time >= startTime &&
          time <= latestTime &&
          valuesByCard.every((values) => values.has(date))
        );
      })
      .sort();

    const aggregatePoints: PricePoint[] = eventDates.map((date) => ({
      date,
      market: valuesByCard.reduce((sum, values) => sum + values.get(date)!, 0),
    }));

    return {
      trend: buildPriceTrend(aggregatePoints, days),
      trackedCards: tracked.length,
      historyCards: usable.length,
      totalCards: uniqueIds.length,
    };
  };

  // Reconcile a single row (name + optional number + optional set hint) to
  // the best catalog match. Used by the import flows. Strategy:
  //   1. If a number is given, try exact name+number; bias suggestions by set.
  //   2. Otherwise (or no match) fall back to name (+ set) fuzzy search.
  // `language` narrows to a print language (the JP catalog uses English
  // product names, so translated names from the scanner match it directly).
  // Returns null when nothing usable matches.
  const matchRow = async (
    name: string,
    number?: string | null,
    setHint?: string | null,
    language?: "EN" | "JP",
  ): Promise<CatalogMatch | null> => {
    const trimmed = (name || "").trim();
    if (trimmed.length < 2) return null;
    const set = setHint?.trim() || null;

    if (number && number.trim()) {
      const { exact, suggestions } = await lookupByNameAndNumber(trimmed, number, {
        language,
      });
      if (exact.length) return exact[0];
      if (suggestions.length) {
        if (set) {
          const biased = suggestions.find((m) =>
            m.setName.toLowerCase().includes(set.toLowerCase()),
          );
          if (biased) return biased;
        }
        return suggestions[0];
      }
    }

    const { results } = await searchCatalog(trimmed, {
      limit: 5,
      setMatch: set,
      sort: "best",
      ...(language ? { language } : {}),
    });
    return results[0] ?? null;
  };

  /**
   * Real price history for one product, newest-first in the DB and returned
   * oldest-first for charting. Nothing is synthesised: if the daily snapshot
   * hasn't run for this card yet the series is short or empty, and callers
   * must render that honestly rather than draw a flat line.
   */
  const getPriceHistory = async (
    productId: number,
    days = 90,
  ): Promise<PriceTrend | null> => {
    if (!supabase) return null;

    const fxReady = ensureRate();
    const { data, error } = await supabase
      .from("card_prices")
      .select("history")
      .eq("product_id", productId)
      .maybeSingle();

    if (error) {
      console.error("[useCardCatalog] getPriceHistory error:", error.message);
      return null;
    }
    await fxReady;

    return buildPriceTrend(historyPoints((data as any)?.history), days);
  };

  return {
    searchCatalog,
    getPriceHistory,
    getPriceHistories,
    getCollectionPriceTrend,
    getRelatedCards,
    lookupByNameAndNumber,
    getCardWithPrice,
    getCardsByIds,
    listSets,
    listRarities,
    matchRow,
  };
};

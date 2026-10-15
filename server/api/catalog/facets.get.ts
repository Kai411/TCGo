// The catalogue's set and rarity lists, served and cached by the server.
//
// WHY NOT STRAIGHT FROM THE BROWSER
// list_sets / list_rarities aggregate all ~63k catalogue rows. Called with the
// public anon key they hit Supabase's short anon statement timeout and fail
// with 57014 "canceling statement due to statement timeout". The search parser
// needs these lists to know that "151" or "ssp" is a set, so when they failed
// silently, "charizard 151" quietly became a search for a Charizard numbered
// 151 and found nothing. The service role has a longer timeout, and the lists
// only change when the nightly seed runs, so they are fetched here once and
// held for hours.
//
//   GET /api/catalog/facets?kind=sets|rarities&lang=EN|JP|ALL

const TTL_MS = 6 * 60 * 60 * 1000;

type Kind = "sets" | "rarities";
type Lang = "EN" | "JP" | "ALL";
interface Facet {
  name: string;
  count: number;
}

const cache = new Map<string, { at: number; data: Facet[] }>();
const inflight = new Map<string, Promise<Facet[]>>();

const fetchFacets = async (kind: Kind, lang: Lang): Promise<Facet[]> => {
  const config = useRuntimeConfig();
  const url =
    (config.supabaseUrl as string) ||
    (config.public.supabaseUrl as string) ||
    process.env.NUXT_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const key =
    (config.supabaseServiceKey as string) ||
    process.env.NUXT_SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";
  if (!url || !key) throw new Error("Supabase service credentials are not configured");

  const fn = kind === "sets" ? "list_sets" : "list_rarities";
  const rows = await $fetch<any[]>(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    body: { lang },
    timeout: 30_000,
  });
  return (rows ?? []).map((r) => ({
    name: kind === "sets" ? r.group_name : r.rarity,
    count: Number(r.card_count),
  }));
};

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const kind: Kind = q.kind === "rarities" ? "rarities" : "sets";
  const lang: Lang = q.lang === "JP" ? "JP" : q.lang === "ALL" ? "ALL" : "EN";
  const cacheKey = `${kind}:${lang}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    setHeader(event, "Cache-Control", "public, max-age=3600");
    return hit.data;
  }

  // One upstream call per key, however many visitors arrive at once.
  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = fetchFacets(kind, lang).finally(() => inflight.delete(cacheKey));
    inflight.set(cacheKey, pending);
  }

  try {
    const data = await pending;
    // Never cache an empty list: that is a failure shape, and caching it would
    // switch set and rarity parsing off for six hours.
    if (data.length) cache.set(cacheKey, { at: Date.now(), data });
    setHeader(event, "Cache-Control", "public, max-age=3600");
    return data;
  } catch (e: any) {
    // Stale beats empty: an old set list still parses "151" correctly.
    if (hit) return hit.data;
    throw createError({
      statusCode: 502,
      message: `Couldn't load catalogue ${kind}: ${e?.message || e}`,
    });
  }
});

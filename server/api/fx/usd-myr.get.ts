// Live USD → MYR exchange rate for the card price guide.
//
// Cached in-memory on the server for 12h so we make at most ~2 upstream
// calls per day regardless of traffic. Falls back to the last good cached
// value, then to a static constant, so the endpoint never hard-fails.
//
// Provider: open.er-api.com — free, no API key, includes MYR. Response:
//   { result: "success", base_code: "USD", rates: { MYR: 4.42, ... } }

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FALLBACK_RATE = 4.7; // static ballpark if the feed is unreachable

interface RateCache {
  rate: number;
  fetchedAt: number;
}

// Module-scoped — persists across requests within a warm server instance.
let cache: RateCache | null = null;

export default defineEventHandler(async () => {
  const now = Date.now();

  // Fresh cache hit.
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return { rate: cache.rate, fetchedAt: cache.fetchedAt, source: "cache" };
  }

  try {
    const data = await $fetch<{
      result: string;
      rates: Record<string, number>;
    }>("https://open.er-api.com/v6/latest/USD", {
      timeout: 5000,
    });

    const rate = data?.rates?.MYR;
    if (data?.result === "success" && typeof rate === "number" && rate > 0) {
      cache = { rate, fetchedAt: now };
      return { rate, fetchedAt: now, source: "live" };
    }
    throw new Error("MYR rate missing from response");
  } catch {
    // Serve a stale cached value if we have one — better than a wrong static.
    if (cache) {
      return {
        rate: cache.rate,
        fetchedAt: cache.fetchedAt,
        source: "stale",
      };
    }
    // No cache yet and the feed failed — fall back to the constant.
    return { rate: FALLBACK_RATE, fetchedAt: now, source: "fallback" };
  }
});

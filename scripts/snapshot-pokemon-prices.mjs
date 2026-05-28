// Daily Pokémon price snapshot from TCGCSV → Supabase `card_prices`.
//
// Pipeline:
//   1. Load every product_id we already know about (cards_catalog).
//   2. For each TCGCSV group, fetch /prices, aggregate per product_id
//      (TCGCSV returns one row per sub-type), filter to known products.
//   3. Upsert into card_prices (replacing the `prices` JSONB; `history`
//      stays untouched on conflict).
//   4. Call snapshot_prices_today() RPC — Postgres prepends today's
//      market value to each row's history array and trims to 365 entries.
//
// Run locally:
//   node scripts/snapshot-pokemon-prices.mjs
//
// In CI (GitHub Actions cron) the same script runs unchanged with the
// same two env vars. Idempotent — safe to run multiple times per day.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env");
  process.exit(1);
}

const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer";
const POKEMON_CATEGORY_ID = 3;
const UPSERT_BATCH_SIZE = 500;
const CATALOG_PAGE_SIZE = 10000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "tcgo-snapshot/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return fetchJson(url, attempt + 1);
  }
}

async function loadKnownProductIds() {
  const ids = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("cards_catalog")
      .select("product_id")
      .range(from, from + CATALOG_PAGE_SIZE - 1);
    if (error) throw new Error(`cards_catalog read failed: ${error.message}`);
    for (const row of data) ids.add(row.product_id);
    if (data.length < CATALOG_PAGE_SIZE) break;
    from += CATALOG_PAGE_SIZE;
  }
  return ids;
}

async function fetchGroups() {
  const url = `${TCGCSV_BASE}/${POKEMON_CATEGORY_ID}/groups`;
  const payload = await fetchJson(url);
  const groups = payload?.results ?? payload;
  if (!Array.isArray(groups)) throw new Error(`Unexpected groups shape from ${url}`);
  return groups;
}

async function fetchPrices(groupId) {
  const url = `${TCGCSV_BASE}/${POKEMON_CATEGORY_ID}/${groupId}/prices`;
  const payload = await fetchJson(url);
  const prices = payload?.results ?? payload;
  return Array.isArray(prices) ? prices : [];
}

// TCGCSV returns one row per (productId, subTypeName). Collapse them so the
// shape matches what we store: { product_id, prices: { Normal: {...}, Holofoil: {...} } }
function aggregatePrices(priceRows) {
  const map = new Map();
  for (const row of priceRows) {
    if (!row?.productId || !row?.subTypeName) continue;
    if (!map.has(row.productId)) {
      map.set(row.productId, { product_id: row.productId, prices: {} });
    }
    map.get(row.productId).prices[row.subTypeName] = {
      market: row.marketPrice ?? null,
      low: row.lowPrice ?? null,
      mid: row.midPrice ?? null,
      high: row.highPrice ?? null,
      directLow: row.directLowPrice ?? null,
    };
  }
  return [...map.values()];
}

async function upsertBatched(rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    // We intentionally do NOT send `history` here — upsert only touches the
    // columns we provide, so existing history is preserved across runs.
    const { error } = await supabase
      .from("card_prices")
      .upsert(batch, { onConflict: "product_id" });
    if (error) throw new Error(error.message);
  }
}

async function main() {
  const startedAt = Date.now();

  console.log("Loading known product_ids from cards_catalog…");
  const knownIds = await loadKnownProductIds();
  console.log(`Found ${knownIds.size.toLocaleString()} catalog rows.`);

  console.log("Fetching Pokémon groups from TCGCSV…");
  const groups = await fetchGroups();
  console.log(`Found ${groups.length} groups.\n`);

  let totalUpserted = 0;
  let totalOrphaned = 0;
  const failures = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const tag = `[${i + 1}/${groups.length}] ${group.groupId} ${group.name}`;
    try {
      const rawPrices = await fetchPrices(group.groupId);
      if (!rawPrices.length) {
        console.log(`${tag} — (empty)`);
        continue;
      }
      const aggregated = aggregatePrices(rawPrices);
      const valid = aggregated.filter((r) => knownIds.has(r.product_id));
      const skipped = aggregated.length - valid.length;
      totalOrphaned += skipped;

      if (valid.length === 0) {
        console.log(`${tag} — 0 known products (skipped ${skipped} orphans)`);
        continue;
      }
      await upsertBatched(valid);
      totalUpserted += valid.length;
      console.log(
        `${tag} — ${valid.length} ✓${skipped ? ` (${skipped} orphans)` : ""}`,
      );
    } catch (err) {
      failures.push({ group, error: err.message });
      console.log(`${tag} — ERROR: ${err.message}`);
    }
  }

  console.log(
    `\nUpserted ${totalUpserted.toLocaleString()} price records.${
      totalOrphaned ? ` ${totalOrphaned} orphans skipped — re-run seed if new sets dropped.` : ""
    }`,
  );

  console.log("Snapshotting today's history entry via Postgres…");
  const { data: rowsSnapshotted, error: rpcErr } = await supabase.rpc(
    "snapshot_prices_today",
  );
  if (rpcErr) {
    console.error(`History snapshot failed: ${rpcErr.message}`);
    process.exit(1);
  }
  console.log(`Snapshotted ${rowsSnapshotted?.toLocaleString?.() ?? rowsSnapshotted} rows into history.`);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s.`);

  if (failures.length) {
    console.log(`\n${failures.length} groups failed:`);
    for (const f of failures) console.log(`  - ${f.group.groupId} ${f.group.name}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});

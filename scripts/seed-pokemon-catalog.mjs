// Seed the Supabase `cards_catalog` table from TCGCSV's Pokémon dataset.
//
// Usage:
//   1. Run `supabase/schema.sql` against your Supabase project once.
//   2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.
//   3. node scripts/seed-pokemon-catalog.mjs
//
// The script is idempotent — it upserts on product_id, so re-running picks
// up new sets and edits without duplicating rows. Run again whenever new
// sets release. Prices are NOT touched here; that's a separate cron.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer";
const POKEMON_CATEGORY_ID = 3;
const UPSERT_BATCH_SIZE = 500;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Fetch JSON with retry — TCGCSV is usually fine but transient flakes happen.
async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "tcgo-seed/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return fetchJson(url, attempt + 1);
  }
}

// TCGCSV stuffs every per-card attribute into an array of
// { name, displayName, value } entries. Lift the ones we want into columns.
function extractField(extendedData, name) {
  if (!Array.isArray(extendedData)) return null;
  const entry = extendedData.find((e) => e?.name === name);
  return entry?.value ?? null;
}

// JP sets in TCGCSV are flagged by name/abbreviation containing Japanese
// hints. This is best-effort — adjust if you need finer control.
function detectLanguage(group) {
  const text = `${group.name || ""} ${group.abbreviation || ""}`.toLowerCase();
  if (/japan|japanese|\bjp\b|ポケモン/.test(text)) return "JP";
  return "EN";
}

async function fetchGroups() {
  const url = `${TCGCSV_BASE}/${POKEMON_CATEGORY_ID}/groups`;
  const payload = await fetchJson(url);
  // TCGCSV envelope: { totalItems, success, errors, results: [...] }
  const groups = payload?.results ?? payload;
  if (!Array.isArray(groups)) {
    throw new Error(`Unexpected groups response shape from ${url}`);
  }
  return groups;
}

async function fetchProducts(groupId) {
  const url = `${TCGCSV_BASE}/${POKEMON_CATEGORY_ID}/${groupId}/products`;
  const payload = await fetchJson(url);
  const products = payload?.results ?? payload;
  return Array.isArray(products) ? products : [];
}

function buildRow(product, group, language) {
  return {
    product_id: product.productId,
    name: product.name,
    clean_name: product.cleanName ?? null,
    image_url: product.imageUrl ?? null,
    category_id: product.categoryId ?? POKEMON_CATEGORY_ID,
    group_id: product.groupId ?? group.groupId,
    group_name: group.name ?? null,
    url: product.url ?? null,
    rarity: extractField(product.extendedData, "Rarity"),
    number: extractField(product.extendedData, "Number"),
    card_type: extractField(product.extendedData, "Card Type"),
    stage: extractField(product.extendedData, "Stage"),
    hp: extractField(product.extendedData, "HP"),
    language,
    extended_data: product.extendedData ?? [],
    modified_on: product.modifiedOn ?? null,
  };
}

async function upsertBatched(rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("cards_catalog")
      .upsert(batch, { onConflict: "product_id" });
    if (error) throw new Error(error.message);
  }
}

async function main() {
  const startedAt = Date.now();
  console.log("Fetching Pokémon groups from TCGCSV…");
  const groups = await fetchGroups();
  console.log(`Found ${groups.length} groups (sets).`);

  let totalProducts = 0;
  const failures = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const tag = `[${i + 1}/${groups.length}] ${group.groupId} ${group.name}`;
    try {
      const products = await fetchProducts(group.groupId);
      if (!products.length) {
        console.log(`${tag} — (empty)`);
        continue;
      }
      const language = detectLanguage(group);
      const rows = products.map((p) => buildRow(p, group, language));
      await upsertBatched(rows);
      totalProducts += rows.length;
      console.log(`${tag} — ${rows.length} ${language === "JP" ? "JP" : "EN"} ✓`);
    } catch (err) {
      failures.push({ group, error: err.message });
      console.log(`${tag} — ERROR: ${err.message}`);
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\nDone in ${seconds}s. ${totalProducts} products upserted across ${groups.length - failures.length} groups.`,
  );
  if (failures.length) {
    console.log(`\n${failures.length} groups failed:`);
    for (const f of failures) {
      console.log(`  - ${f.group.groupId} ${f.group.name}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});

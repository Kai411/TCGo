// Seed the Supabase `cards_catalog` table from TCGCSV's Pokémon datasets:
// category 3 (Pokemon, EN-first) and category 85 (Pokemon Japan).
//
// Usage:
//   1. Run `supabase/schema.sql` against your Supabase project once.
//   2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.
//   3. node scripts/seed-pokemon-catalog.mjs
//
// The script is idempotent — it upserts on product_id (TCGPlayer ids are
// globally unique across categories), so re-running picks up new sets and
// edits without duplicating rows. Run again whenever new sets release.
// Prices are NOT touched here; that's the snapshot cron's job.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const TCGCSV_BASE = "https://tcgcsv.com/tcgplayer";
// Each category seeds with its own language rule: category 85 is entirely
// Japanese; category 3 is EN with a name heuristic for stray JP groups.
const CATEGORIES = [
  { id: 3, label: "Pokemon (EN)", language: null }, // null → heuristic
  { id: 85, label: "Pokemon Japan", language: "JP" },
];
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

// Heuristic for category 3 only — JP-named groups that predate the
// dedicated Pokemon Japan category.
function detectLanguage(group) {
  const text = `${group.name || ""} ${group.abbreviation || ""}`.toLowerCase();
  if (/japan|japanese|\bjp\b|ポケモン/.test(text)) return "JP";
  return "EN";
}

async function fetchGroups(categoryId) {
  const url = `${TCGCSV_BASE}/${categoryId}/groups`;
  const payload = await fetchJson(url);
  // TCGCSV envelope: { totalItems, success, errors, results: [...] }
  const groups = payload?.results ?? payload;
  if (!Array.isArray(groups)) {
    throw new Error(`Unexpected groups response shape from ${url}`);
  }
  return groups;
}

async function fetchProducts(categoryId, groupId) {
  const url = `${TCGCSV_BASE}/${categoryId}/${groupId}/products`;
  const payload = await fetchJson(url);
  const products = payload?.results ?? payload;
  return Array.isArray(products) ? products : [];
}

function buildRow(product, group, categoryId, language) {
  return {
    product_id: product.productId,
    name: product.name,
    clean_name: product.cleanName ?? null,
    image_url: product.imageUrl ?? null,
    category_id: product.categoryId ?? categoryId,
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

async function seedCategory(category) {
  console.log(`\n=== ${category.label} (category ${category.id}) ===`);
  const groups = await fetchGroups(category.id);
  console.log(`Found ${groups.length} groups (sets).`);

  let totalProducts = 0;
  const failures = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const tag = `[${i + 1}/${groups.length}] ${group.groupId} ${group.name}`;
    try {
      const products = await fetchProducts(category.id, group.groupId);
      if (!products.length) {
        console.log(`${tag} — (empty)`);
        continue;
      }
      const language = category.language ?? detectLanguage(group);
      const rows = products.map((p) => buildRow(p, group, category.id, language));
      await upsertBatched(rows);
      totalProducts += rows.length;
      console.log(`${tag} — ${rows.length} ${language} ✓`);
    } catch (err) {
      failures.push({ group, error: err.message });
      console.log(`${tag} — ERROR: ${err.message}`);
    }
  }
  return { totalProducts, failures, groupCount: groups.length };
}

async function main() {
  const startedAt = Date.now();
  let grandTotal = 0;
  const allFailures = [];

  for (const category of CATEGORIES) {
    const { totalProducts, failures } = await seedCategory(category);
    grandTotal += totalProducts;
    allFailures.push(...failures);
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${seconds}s. ${grandTotal} products upserted.`);
  if (allFailures.length) {
    console.log(`\n${allFailures.length} groups failed:`);
    for (const f of allFailures) {
      console.log(`  - ${f.group.groupId} ${f.group.name}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});

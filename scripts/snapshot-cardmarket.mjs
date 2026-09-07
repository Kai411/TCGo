// Second-opinion prices from Cardmarket, via pokemontcg.io, into
// `card_price_sources`.
//
// WHY THERE IS A SECOND SOURCE AT ALL
// TCGPlayer publishes a market price derived from recent sales, so a card that
// barely trades has none — 34 of 61 Gold Stars are unpriced, including the
// EX Deoxys Rayquaza ★, which Cardmarket puts around EUR 2420. Scarce cards
// are exactly the ones a seller most needs a number for.
//
// STORED SEPARATELY, DELIBERATELY
// It is a European market in euros; TCGPlayer is American in dollars. They are
// different markets, not two readings of one number, so they never share a
// row. See the schema comment on card_price_sources.
//
// Usage:
//   1. Run supabase/schema.sql once so card_price_sources exists.
//   2. node scripts/snapshot-cardmarket.mjs            # dry run
//      node scripts/snapshot-cardmarket.mjs --yes      # write
//      node scripts/snapshot-cardmarket.mjs --yes --set ex8
//
// The upstream API is genuinely flaky — 500s and 502s on perfectly good
// queries, recovering on the next attempt — so every call retries. Without
// that it reports an empty set as confidently as a real one, which reads as
// "the card isn't there" when it is.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const API = "https://api.pokemontcg.io/v2";
const SOURCE = "cardmarket";
const CURRENCY = "EUR";
const confirmed = process.argv.includes("--yes");
const onlySet = process.argv[process.argv.indexOf("--set") + 1];
const REQUEST_SPACING_MS = 120;

let lastRequestAt = 0;
const pace = async () => {
  const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
};

async function api(path, attempt = 1) {
  await pace();
  const headers = { Accept: "application/json" };
  // A key raises the rate limit; the endpoint works without one.
  if (env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = env.POKEMONTCG_API_KEY;
  try {
    const res = await fetch(`${API}${path}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return api(path, attempt + 1);
  }
}

// ── Matching ────────────────────────────────────────────────────────
//
// There is no shared id: pokemontcg.io exposes a proxy URL rather than the
// TCGPlayer product id, so the join is on set, number and name.
//
// Their set names drop the prefix ours carry — "Deoxys" against our "EX
// Deoxys" — so containment either way is the test. Numbers are "107" against
// our "107/107". A card that matches more than one of ours is SKIPPED rather
// than guessed: attaching a European price to the wrong printing is worse
// than leaving the card unpriced, which is the state it was already in.

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const numKey = (v) => {
  const head = String(v ?? "").trim().split("/")[0] ?? "";
  const digits = head.replace(/^0+/, "");
  return digits.toLowerCase();
};

const setsOverlap = (ours, theirs) => {
  const a = norm(ours);
  const b = norm(theirs);
  if (!a || !b) return false;
  // Ours often carries a code prefix: "SV08: Surging Sparks".
  const tail = a.includes(":") ? norm(a.split(":").pop()) : a;
  return tail.includes(b) || b.includes(tail);
};

async function loadOurCards() {
  // English only: the source is an English-language catalogue.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cards_catalog")
      .select("product_id, name, number, group_name")
      .eq("language", "EN")
      .order("product_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const main = async () => {
  console.log("Loading our English catalogue…");
  const ours = await loadOurCards();
  console.log(`  ${ours.length} cards.`);

  // name+number → candidates, so a match is a lookup rather than a scan.
  const index = new Map();
  for (const c of ours) {
    const key = `${norm(c.name)}::${numKey(c.number)}`;
    (index.get(key) ?? index.set(key, []).get(key)).push(c);
  }

  const sets = (await api("/sets?pageSize=250")).data ?? [];
  const wanted = onlySet ? sets.filter((s) => s.id === onlySet) : sets;
  console.log(`Fetching ${wanted.length} set(s) from the second source.\n`);

  const rows = [];
  let seen = 0, ambiguous = 0, unmatched = 0;

  for (const set of wanted) {
    let cards = [];
    try {
      cards = (await api(`/cards?q=${encodeURIComponent(`set.id:${set.id}`)}&pageSize=250`)).data ?? [];
    } catch (err) {
      console.log(`  ${set.id.padEnd(10)} FAILED: ${err.message}`);
      continue;
    }
    let matched = 0;
    for (const card of cards) {
      const price = card.cardmarket?.prices;
      const market = price?.trendPrice ?? price?.averageSellPrice ?? null;
      if (market == null) continue;
      seen += 1;

      const key = `${norm(card.name)}::${numKey(card.number)}`;
      const candidates = (index.get(key) ?? []).filter((c) =>
        setsOverlap(c.group_name, set.name),
      );
      if (!candidates.length) { unmatched += 1; continue; }
      if (candidates.length > 1) { ambiguous += 1; continue; }

      matched += 1;
      rows.push({
        product_id: candidates[0].product_id,
        source: SOURCE,
        currency: CURRENCY,
        market,
        low: price.lowPrice ?? null,
        high: price.avg30 ?? price.averageSellPrice ?? null,
        raw: price,
        fetched_at: new Date().toISOString(),
      });
    }
    console.log(`  ${set.id.padEnd(10)} ${String(cards.length).padStart(4)} cards, ${String(matched).padStart(4)} matched  ${set.name}`);
  }

  console.log(`\n${rows.length} priced match(es). ${ambiguous} ambiguous, ${unmatched} not in our catalogue, ${seen} priced upstream.`);
  if (!rows.length) { console.log("Nothing to write."); return; }

  if (!confirmed) {
    console.log("\nSample:");
    for (const r of rows.slice(0, 5)) {
      const c = ours.find((x) => x.product_id === r.product_id);
      console.log(`  ${c?.name} (${c?.group_name}) -> ${r.market} ${CURRENCY}`);
    }
    console.log("\nDry run. Re-run with --yes to write.");
    return;
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("card_price_sources")
      .upsert(rows.slice(i, i + 500), { onConflict: "product_id,source" });
    if (error) {
      // The table is created by supabase/schema.sql, which is run by hand.
      if (/does not exist|schema cache/i.test(error.message)) {
        console.error("\ncard_price_sources is missing — run supabase/schema.sql first.");
        process.exit(1);
      }
      throw new Error(error.message);
    }
  }
  console.log(`Wrote ${rows.length} row(s).`);
};

main().catch((err) => { console.error("\nFatal:", err.message); process.exit(1); });

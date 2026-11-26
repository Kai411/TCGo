// Cardmarket prices for JAPANESE cards, via TCGdex, into `card_price_sources`.
//
// The English script (snapshot-cardmarket.mjs) reads pokemontcg.io, which has
// no Japanese sets. TCGdex (api.tcgdex.net, free, no key) does carry
// Cardmarket prices for Japanese printings; kai confirmed on SV2a-006
// (Charizard ex, 151) on 2026-11-26.
//
// ONLY CARDS TCGPLAYER DOESN'T PRICE
// The second price is shown only when TCGPlayer has none (kai's rule: never
// averaged), so this only fetches Japanese cards with no TCGPlayer market
// price. TCGdex needs one request per card for prices; asking for all ~25k
// Japanese cards every night would be slow and pointless.
//
// MATCHING
// TCGdex names are Japanese and ours are English, so names can't be
// compared. The join is set code + card number: our group names carry the
// code ("SV2a: Pokemon Card 151"), TCGdex set ids are that code ("SV2a"), and
// "006/165" matches localId "006". Groups without a code prefix, and two of
// ours sharing one set+number, are skipped rather than guessed.
//
// Usage (reads SUPABASE_URL / SUPABASE_SERVICE_KEY from .env):
//   node scripts/snapshot-cardmarket-ja.mjs              # dry run
//   node scripts/snapshot-cardmarket-ja.mjs --yes        # write
//   node scripts/snapshot-cardmarket-ja.mjs --set SV2a   # one set
// Nightly: .github/workflows/snapshot-cardmarket.yml, job snapshot-ja.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env");
  process.exit(1);
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const API = "https://api.tcgdex.net/v2/ja";
const SOURCE = "cardmarket";
const CURRENCY = "EUR";
const confirmed = process.argv.includes("--yes");
const setFlag = process.argv.indexOf("--set");
const onlySet = setFlag === -1 ? undefined : process.argv[setFlag + 1];
const REQUEST_SPACING_MS = 150;
const CONCURRENCY = 4;
const BUDGET_MS = Number(env.CARDMARKET_BUDGET_MINUTES ?? 50) * 60_000;

let lastRequestAt = 0;
const pace = async () => {
  const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
  lastRequestAt = Math.max(Date.now(), lastRequestAt + REQUEST_SPACING_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
};

// null on 404 (no such set/card upstream); throws after retries otherwise.
async function api(path, attempt = 1) {
  await pace();
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 5) throw err;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
    return api(path, attempt + 1);
  }
}

// "SV2a: Pokemon Card 151" -> "SV2a"; null when the group has no code.
const setCode = (groupName) => {
  const m = /^\s*([A-Za-z0-9-]+)\s*:/.exec(String(groupName ?? ""));
  return m ? m[1] : null;
};
// "006/165" -> "6"; leading zeros dropped, lowercased.
const numKey = (v) => {
  const head = String(v ?? "").trim().split("/")[0] ?? "";
  return head.replace(/^0+/, "").toLowerCase();
};

// A TCGPlayer price exists when any sub-type block has market or mid, the
// same test the app uses (pickPrice in composables/useCardCatalog.ts).
const hasTcgPrice = (prices) =>
  Object.values(prices ?? {}).some((b) => b && (b.market != null || b.mid != null));

async function loadUnpricedJapanese() {
  const cards = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cards_catalog")
      .select("product_id, number, group_name")
      .eq("language", "JP")
      .not("number", "is", null)
      .order("product_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    cards.push(...data);
    if (data.length < 1000) break;
  }
  const priced = new Set();
  const ids = cards.map((c) => c.product_id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabase
      .from("card_prices")
      .select("product_id, prices")
      .in("product_id", ids.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) if (hasTcgPrice(row.prices)) priced.add(row.product_id);
  }
  return { total: cards.length, unpriced: cards.filter((c) => !priced.has(c.product_id)) };
}

const main = async () => {
  console.log("Loading our Japanese catalogue…");
  const { total, unpriced } = await loadUnpricedJapanese();
  console.log(`  ${total} numbered cards, ${unpriced.length} without a TCGPlayer price.`);

  // code -> numKey -> [our cards]
  const bySet = new Map();
  let noCode = 0;
  for (const c of unpriced) {
    const code = setCode(c.group_name);
    if (!code) { noCode += 1; continue; }
    if (onlySet && code.toLowerCase() !== onlySet.toLowerCase()) continue;
    const byNum = bySet.get(code) ?? bySet.set(code, new Map()).get(code);
    const k = numKey(c.number);
    (byNum.get(k) ?? byNum.set(k, []).get(k)).push(c);
  }
  console.log(`  ${bySet.size} set(s) to look up; ${noCode} card(s) skipped (group has no set code).\n`);
  if (!bySet.size) { console.error("Nothing to look up."); process.exit(1); }

  let written = 0, found = 0, ambiguous = 0, missing = 0, noPrice = 0, failed = 0, skippedSets = 0;
  const sample = [];
  const startedAt = Date.now();

  const writeRows = async (rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("card_price_sources")
        .upsert(rows.slice(i, i + 500), { onConflict: "product_id,source" });
      if (error) throw new Error(error.message);
    }
    written += rows.length;
  };

  const processSet = async (code, byNum) => {
    let set;
    try {
      set = await api(`/sets/${encodeURIComponent(code)}`);
    } catch (err) {
      failed += 1;
      console.log(`  ${code.padEnd(8)} FAILED: ${err.message}`);
      return;
    }
    if (!set) { missing += [...byNum.values()].reduce((n, a) => n + a.length, 0); console.log(`  ${code.padEnd(8)} not on TCGdex`); return; }

    const upstream = new Map((set.cards ?? []).map((c) => [numKey(c.localId), c.id]));
    const rows = [];
    for (const [k, ours] of byNum) {
      if (ours.length > 1) { ambiguous += ours.length; continue; }
      const id = upstream.get(k);
      if (!id) { missing += 1; continue; }
      let card;
      try { card = await api(`/cards/${encodeURIComponent(id)}`); } catch { failed += 1; continue; }
      const cm = card?.pricing?.cardmarket;
      const market = cm?.trend || cm?.avg || null;
      if (!market) { noPrice += 1; continue; }
      found += 1;
      rows.push({
        product_id: ours[0].product_id,
        source: SOURCE,
        currency: CURRENCY,
        market,
        low: cm.low ?? null,
        high: cm.avg30 ?? cm.avg ?? null,
        raw: { via: "tcgdex", id, ...cm },
        fetched_at: new Date().toISOString(),
      });
      if (sample.length < 5) sample.push(`${ours[0].group_name} #${ours[0].number} -> ${id} ${market} ${CURRENCY}`);
    }
    if (confirmed && rows.length) await writeRows(rows);
    console.log(`  ${code.padEnd(8)} ${String(byNum.size).padStart(4)} unpriced, ${String(rows.length).padStart(4)} priced  ${set.name ?? ""}`);
  };

  const queue = [...bySet.entries()];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      if (Date.now() - startedAt > BUDGET_MS) { skippedSets = queue.length; queue.length = 0; break; }
      const [code, byNum] = queue.shift();
      await processSet(code, byNum);
    }
  }));

  console.log(`\n${found} priced. ${noPrice} with no Cardmarket price, ${missing} not found upstream, ${ambiguous} ambiguous, ${failed} failed.`);
  if (skippedSets) console.log(`${skippedSets} set(s) not reached within the time budget.`);
  if (!found) { console.error("Nothing to write."); process.exit(1); }
  if (!confirmed) {
    console.log("\nSample:");
    for (const s of sample) console.log(`  ${s}`);
    console.log("\nDry run. Re-run with --yes to write.");
    return;
  }
  console.log(`Wrote ${written} row(s).`);
};

main().catch((err) => { console.error("\nFatal:", err.message); process.exit(1); });

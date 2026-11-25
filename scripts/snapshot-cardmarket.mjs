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
//   2. Nightly: .github/workflows/snapshot-cardmarket.yml runs it with --yes.
//      By hand (reads SUPABASE_URL / SUPABASE_SERVICE_KEY from .env):
//      node scripts/snapshot-cardmarket.mjs            # dry run
//      node scripts/snapshot-cardmarket.mjs --yes      # write
//      node scripts/snapshot-cardmarket.mjs --yes --set ex8
//
// The upstream API is genuinely flaky — 500s and 502s on perfectly good
// queries, recovering on the next attempt — so every call retries. Without
// that it reports an empty set as confidently as a real one, which reads as
// "the card isn't there" when it is.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Env comes from .env locally (dotenv) or from the workflow's secrets in
// GitHub Actions, same as snapshot-pokemon-prices.mjs. This used to read .env
// by hand, which is why it could only ever run on a laptop.
const env = process.env;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env");
  process.exit(1);
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const API = "https://api.pokemontcg.io/v2";
const SOURCE = "cardmarket";
const CURRENCY = "EUR";
const confirmed = process.argv.includes("--yes");
// indexOf is -1 without --set, and argv[-1 + 1] is the node binary's path,
// which then "matched" no set at all. Only read the value when the flag is there.
const setFlag = process.argv.indexOf("--set");
const onlySet = setFlag === -1 ? undefined : process.argv[setFlag + 1];
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
    // The upstream can hang rather than fail; a stuck request must not stall
    // the whole run.
    const res = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Six tries over ~20s: kai's first full run saw base3/base4 still
    // returning 500 after four quick ones.
    if (attempt >= 6) throw err;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
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

// "4/102" -> "102"; "" when the number has no printed total.
const denom = (v) => {
  const tail = String(v ?? "").split("/")[1] ?? "";
  return tail.trim().replace(/^0+/, "");
};

// Sets whose names share no words between the two catalogues, mostly the
// promo series ("Wizards Black Star Promos" upstream is "WoTC Promo" on
// TCGPlayer). Keyed by upstream set id; each value is text our group name
// must contain. Best-effort from TCGPlayer's naming: a wrong alias matches
// nothing rather than the wrong card, because name + number must agree too.
// Add to this when a dry run shows a set at 0 matched.
const SET_ALIASES = {
  basep: ["wotc promo"],
  np: ["nintendo promo"],
  dpp: ["diamond and pearl promo", "dp promo"],
  hsp: ["hgss promo"],
  bwp: ["black and white promo", "bw promo"],
  xyp: ["xy promo"],
  smp: ["sm promo"],
  swshp: ["swsh: sword & shield promo", "swsh promo"],
  svp: ["sv: scarlet & violet promo", "sv promo"],
};

const setsOverlap = (ours, theirs, theirId) => {
  const a = norm(ours);
  const b = norm(theirs);
  if (!a || !b) return false;
  if ((SET_ALIASES[theirId] ?? []).some((alias) => a.includes(alias))) return true;
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
  if (!wanted.length) {
    console.error(onlySet ? `No set with id "${onlySet}" upstream.` : "The second source returned no sets.");
    process.exit(1);
  }
  console.log(`Fetching ${wanted.length} set(s) from the second source.\n`);

  const rows = [];
  let seen = 0, ambiguous = 0, unmatched = 0, failedSets = 0, written = 0, skippedSets = 0;

  // Rows are written set by set on --yes, so a run cut short by the job's
  // time limit keeps everything it already fetched. The first scheduled run
  // (2026-11-20) was cancelled at 30 minutes having written nothing.
  const writeRows = async (batch) => {
    for (let i = 0; i < batch.length; i += 500) {
      const { error } = await supabase
        .from("card_price_sources")
        .upsert(batch.slice(i, i + 500), { onConflict: "product_id,source" });
      if (error) {
        // The table is created by supabase/schema.sql, which is run by hand.
        if (/does not exist|schema cache/i.test(error.message)) {
          console.error("\ncard_price_sources is missing — run supabase/schema.sql first.");
          process.exit(1);
        }
        throw new Error(error.message);
      }
    }
    written += batch.length;
  };

  // Stop starting new sets after this long, so the job ends on its own with
  // a summary instead of being killed by the workflow's timeout-minutes.
  const startedAt = Date.now();
  const BUDGET_MS = Number(env.CARDMARKET_BUDGET_MINUTES ?? 50) * 60_000;

  const processSet = async (set) => {
    // Pages of 250: a set bigger than that (with its secret rares) would
    // otherwise silently lose its last cards, which are the scarce ones.
    // `select` trims each card to the three fields used here; the full card
    // objects (attacks, images, TCGPlayer block) are most of the payload and
    // most of the time.
    let cards = [];
    try {
      for (let page = 1; ; page += 1) {
        const res = await api(`/cards?q=${encodeURIComponent(`set.id:${set.id}`)}&select=name,number,cardmarket&pageSize=250&page=${page}`);
        const batch = res.data ?? [];
        cards.push(...batch);
        if (batch.length < 250 || cards.length >= (res.totalCount ?? 0)) break;
      }
    } catch (err) {
      failedSets += 1;
      console.log(`  ${set.id.padEnd(10)} FAILED: ${err.message}`);
      return;
    }
    const setRows = [];
    for (const card of cards) {
      const price = card.cardmarket?.prices;
      const market = price?.trendPrice ?? price?.averageSellPrice ?? null;
      if (market == null) continue;
      seen += 1;

      const key = `${norm(card.name)}::${numKey(card.number)}`;
      let candidates = (index.get(key) ?? []).filter((c) =>
        setsOverlap(c.group_name, set.name, set.id),
      );
      if (!candidates.length) { unmatched += 1; continue; }
      // "Base" overlaps Base Set, Base Set 2 and Base Set (Shadowless), so a
      // name+number like Charizard 4 has several candidates. Our numbers
      // carry the set's printed size ("4/102"); keep the ones that agree with
      // upstream's printedTotal. Still more than one (Shadowless is /102 too)
      // means genuinely ambiguous, and stays skipped.
      if (candidates.length > 1 && set.printedTotal) {
        const sized = candidates.filter((c) => denom(c.number) === String(set.printedTotal));
        if (sized.length) candidates = sized;
      }
      if (candidates.length > 1) { ambiguous += 1; continue; }
      // One upsert can't touch the same row twice, so two upstream cards
      // landing on one of ours would fail the whole set's write. Skip it.
      if (setRows.some((r) => r.product_id === candidates[0].product_id)) { ambiguous += 1; continue; }

      setRows.push({
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
    rows.push(...setRows);
    if (confirmed && setRows.length) await writeRows(setRows);
    console.log(`  ${set.id.padEnd(10)} ${String(cards.length).padStart(4)} cards, ${String(setRows.length).padStart(4)} matched  ${set.name}`);
    // On a dry run, show what a set that matched nothing looks like upstream
    // and which of our groups hold the same card, so an alias can be added.
    if (!confirmed && !setRows.length && cards.length) {
      for (const card of cards.slice(0, 2)) {
        const same = (index.get(`${norm(card.name)}::${numKey(card.number)}`) ?? [])
          .map((c) => `${c.group_name} #${c.number}`).slice(0, 3);
        console.log(`             e.g. ${card.name} #${card.number} -> ours: ${same.join("; ") || "none with this name+number"}`);
      }
    }
  };

  // A few sets in flight at once: each request mostly waits on the upstream,
  // which can take tens of seconds to answer, so one at a time spent the
  // whole half hour waiting. pace() still spaces the requests themselves.
  const CONCURRENCY = 4;
  const queue = [...wanted];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      if (Date.now() - startedAt > BUDGET_MS) { skippedSets = queue.length; queue.length = 0; break; }
      await processSet(queue.shift());
    }
  }));

  console.log(`\n${rows.length} priced match(es). ${ambiguous} ambiguous, ${unmatched} not in our catalogue, ${seen} priced upstream.`);
  if (failedSets) console.log(`${failedSets} of ${wanted.length} set(s) failed to fetch.`);
  if (skippedSets) console.log(`${skippedSets} set(s) not reached within the time budget; they keep their previous prices.`);
  // Writing nothing is a failure, not a quiet success: an empty table is
  // exactly what this script exists to prevent, so make the run go red.
  if (!rows.length) { console.error("Nothing to write."); process.exit(1); }

  if (!confirmed) {
    console.log("\nSample:");
    for (const r of rows.slice(0, 5)) {
      const c = ours.find((x) => x.product_id === r.product_id);
      console.log(`  ${c?.name} (${c?.group_name}) -> ${r.market} ${CURRENCY}`);
    }
    console.log("\nDry run. Re-run with --yes to write.");
    return;
  }
  console.log(`Wrote ${written} row(s).`);
};

main().catch((err) => { console.error("\nFatal:", err.message); process.exit(1); });

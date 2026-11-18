// One-off: fill card_prices.history back to February 2024 from TCGCSV's
// daily price archive (TCGPlayer's own prices, one immutable file per day).
//
// What it writes: for every card already in card_prices, one point per day
// for the last 365 days and one point per week (Mondays) before that, back to
// the archive's first Monday (2024-02-12). Same market price the nightly
// snapshot uses (Holofoil → Normal → Reverse Holofoil, USD).
//
// Safe to re-run:
//   - Dates a card already has are never touched (merge_price_history in
//     supabase/schema.sql only adds missing dates), so nightly rows win.
//   - Archives are cached in .cache/tcgcsv-archive and never downloaded twice
//     (TCGCSV asks for exactly that), one download per second at most.
//
// Needs, once, in Supabase > SQL editor: the merge_price_history function and
// the new snapshot_prices_range from supabase/schema.sql. Without the new
// snapshot function the nightly run would trim everything past 365 days again.
//
// Run (from the repo folder, with SUPABASE_URL and SUPABASE_SERVICE_KEY in .env):
//   node scripts/backfill-price-history.mjs                      dry run, no writes
//   node scripts/backfill-price-history.mjs --product 12345 --yes  one card only
//   node scripts/backfill-price-history.mjs --yes                writes everything
// Options: --from YYYY-MM-DD, --to YYYY-MM-DD (default: two days ago).

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import sevenZip from "7zip-bin";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  marketByProduct,
  planDates,
  pointsFor,
  priceRowsFrom,
  toDate,
} from "./lib/price-history.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const WRITE = flag("--yes");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const today = toDate(Date.now());
const from = option("--from");
const to = option("--to") ?? toDate(Date.now() - 2 * 86_400_000);
const onlyProduct = option("--product") ? Number(option("--product")) : null;
for (const [name, value] of [["--from", from], ["--to", to]]) {
  if (value !== undefined && !DATE_RE.test(value)) {
    console.error(`${name} must be YYYY-MM-DD`);
    process.exit(1);
  }
}
if (onlyProduct !== null && !Number.isInteger(onlyProduct)) {
  console.error("--product must be a TCGPlayer product id (a number)");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const ARCHIVE_URL = (date) => `https://tcgcsv.com/archive/tcgplayer/prices-${date}.ppmd.7z`;
const CACHE_DIR = join(process.cwd(), ".cache", "tcgcsv-archive");
// Pokemon (EN) and Pokemon Japan, as in snapshot-pokemon-prices.mjs.
const CATEGORY_IDS = ["3", "85"];
const PAGE_SIZE = 1000;
// Each row carries up to ~450 points; 100 rows keeps one call well under a
// couple of MB and inside PostgREST's statement timeout.
const WRITE_BATCH = 100;
const DOWNLOAD_SPACING_MS = 1000;
const USER_AGENT = "tcgo-price-backfill/1.0";

const sevenZa = sevenZip.path7za;
// The npm package ships the Linux/macOS binary without its execute bit.
if (process.platform !== "win32") {
  try {
    chmodSync(sevenZa, 0o755);
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastDownloadAt = 0;

/** Path of the cached archive, or null if TCGCSV has no archive that day. */
async function archiveFor(date) {
  const file = join(CACHE_DIR, `prices-${date}.ppmd.7z`);
  if (existsSync(file)) return file;
  if (existsSync(`${file}.missing`)) return null;
  for (let attempt = 1; ; attempt++) {
    const wait = lastDownloadAt + DOWNLOAD_SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastDownloadAt = Date.now();
    try {
      const res = await fetch(ARCHIVE_URL(date), { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 404) {
        writeFileSync(`${file}.missing`, "");
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      // Write then rename, so a cut-off download is never mistaken for a
      // cached one on the next run.
      writeFileSync(`${file}.part`, body);
      renameSync(`${file}.part`, file);
      return file;
    } catch (err) {
      if (attempt >= 3) throw new Error(`download ${date} failed: ${err.message}`);
      await sleep(5000 * attempt);
    }
  }
}

/** Every `<category>/<group>/prices` file for our categories, parsed. */
function readArchive(file) {
  const out = mkdtempSync(join(tmpdir(), "tcgcsv-"));
  try {
    execFileSync(sevenZa, ["x", file, `-o${out}`, "-y", "-bso0", "-bsp0"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const rows = [];
    // The archive holds <date>/<categoryId>/<groupId>/prices; find the date
    // folder rather than assume its name.
    for (const root of readdirSync(out)) {
      for (const category of CATEGORY_IDS) {
        const categoryDir = join(out, root, category);
        if (!existsSync(categoryDir)) continue;
        for (const group of readdirSync(categoryDir)) {
          const pricesFile = join(categoryDir, group, "prices");
          if (!existsSync(pricesFile)) continue;
          try {
            rows.push(...priceRowsFrom(JSON.parse(readFileSync(pricesFile, "utf8"))));
          } catch {
            // One unreadable group shouldn't sink the whole day.
          }
        }
      }
    }
    return rows;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

async function loadPricedIds() {
  if (onlyProduct !== null) {
    const { data, error } = await supabase
      .from("card_prices")
      .select("product_id")
      .eq("product_id", onlyProduct)
      .maybeSingle();
    if (error) throw new Error(`card_prices read failed: ${error.message}`);
    return new Set(data ? [Number(data.product_id)] : []);
  }
  const ids = new Set();
  for (let fromRow = 0; ; fromRow += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("card_prices")
      .select("product_id")
      .order("product_id")
      .range(fromRow, fromRow + PAGE_SIZE - 1);
    if (error) throw new Error(`card_prices read failed: ${error.message}`);
    for (const row of data) ids.add(Number(row.product_id));
    if (data.length < PAGE_SIZE) break;
  }
  return ids;
}

async function writeBatch(batch) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc("merge_price_history", { payload: batch });
    if (!error) return data ?? 0;
    if (/merge_price_history/.test(error.message) && /not find|does not exist/i.test(error.message)) {
      throw new Error(
        "merge_price_history is missing in Supabase. Paste the SQL from the PR into Supabase > SQL editor first.",
      );
    }
    if (attempt >= 3) throw new Error(error.message);
    await sleep(3000 * attempt);
  }
}

async function main() {
  const startedAt = Date.now();
  mkdirSync(CACHE_DIR, { recursive: true });

  const dates = planDates({ from, to, today });
  if (!dates.length) {
    console.log("No dates to fetch in that range.");
    return;
  }
  console.log(
    `${WRITE ? "WRITE" : "DRY RUN"}: ${dates.length} archive days, ${dates[0]} to ${dates[dates.length - 1]}` +
      " (daily for the last year, Mondays before that).",
  );

  console.log("Loading cards from card_prices…");
  const ids = await loadPricedIds();
  console.log(`${ids.size.toLocaleString()} cards.`);
  if (!ids.size) return;

  // One column per day for each card; NaN = no price that day.
  const series = new Map();
  const missing = [];
  for (let d = 0; d < dates.length; d++) {
    const date = dates[d];
    const file = await archiveFor(date);
    if (!file) {
      missing.push(date);
      console.log(`[${d + 1}/${dates.length}] ${date}: no archive`);
      continue;
    }
    const markets = marketByProduct(readArchive(file));
    let matched = 0;
    for (const [productId, market] of markets) {
      if (!ids.has(productId)) continue;
      let column = series.get(productId);
      if (!column) {
        column = new Float64Array(dates.length).fill(Number.NaN);
        series.set(productId, column);
      }
      column[d] = market;
      matched++;
    }
    console.log(`[${d + 1}/${dates.length}] ${date}: ${matched.toLocaleString()} cards priced`);
  }

  let totalPoints = 0;
  for (const column of series.values()) {
    for (const v of column) if (Number.isFinite(v)) totalPoints++;
  }
  console.log(
    `\n${series.size.toLocaleString()} of ${ids.size.toLocaleString()} cards have archive prices, ` +
      `${totalPoints.toLocaleString()} points in all.` +
      (missing.length ? ` ${missing.length} days had no archive: ${missing.join(", ")}.` : ""),
  );
  const sample = [...series.entries()].slice(0, 3);
  for (const [productId, column] of sample) {
    const points = pointsFor(dates, column);
    const oldest = points[points.length - 1];
    console.log(
      `  e.g. ${productId}: ${points.length} points, newest ${points[0].date} $${points[0].market}, oldest ${oldest.date} $${oldest.market}`,
    );
  }

  if (!WRITE) {
    console.log(
      "\nDry run: nothing written. Dates a card already has are kept as they are.\n" +
        "Run again with --yes to write (archives are cached, so no second download).",
    );
    return;
  }

  console.log("\nWriting (only adds dates each card doesn't have yet)…");
  const entries = [...series.entries()];
  let updated = 0;
  for (let i = 0; i < entries.length; i += WRITE_BATCH) {
    const batch = entries
      .slice(i, i + WRITE_BATCH)
      .map(([product_id, column]) => ({ product_id, history: pointsFor(dates, column) }));
    updated += await writeBatch(batch);
    const done = Math.min(i + WRITE_BATCH, entries.length);
    if (done % 5000 < WRITE_BATCH || done === entries.length) {
      console.log(`  ${done.toLocaleString()} / ${entries.length.toLocaleString()} cards sent`);
    }
  }
  console.log(`\n${updated.toLocaleString()} cards gained history.`);
  console.log(`Done in ${((Date.now() - startedAt) / 60000).toFixed(1)} min.`);
}

main().catch((err) => {
  console.error("\nFatal:", err.message ?? err);
  console.error("Safe to run again: cached archives are reused and existing dates are kept.");
  process.exit(1);
});

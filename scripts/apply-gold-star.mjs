// Bring existing rows up to what the seed now writes.
//
// The rule itself lives in lib/gold-star.mjs and runs on every seed, so this
// is a one-off catch-up for rows already in the table — not a second source of
// truth. Sharing the module is the point: a targeted UPDATE that reimplemented
// the rule would drift from the seed the first time either changed.
//
//   node scripts/apply-gold-star.mjs          # dry run
//   node scripts/apply-gold-star.mjs --yes    # apply

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { applyGoldStar, isGoldStar, GOLD_STAR_RARITY } from "./lib/gold-star.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
const confirmed = process.argv.includes("--yes");

// Every row whose name ends in the subset marker. Filtered again in JS by the
// shared rule, so Prism Star and anything else the pattern catches loosely is
// excluded by the same logic the seed uses.
const { data, error } = await supabase
  .from("cards_catalog")
  .select("product_id, name, rarity, language, group_name")
  .or("name.ilike.* Star,name.ilike.* Star (*")
  .limit(2000);
if (error) { console.error("Query failed:", error.message); process.exit(1); }

const changes = [];
for (const row of data) {
  if (!isGoldStar(row.name)) continue;
  const next = applyGoldStar(row);
  if (next.name === row.name && next.rarity === row.rarity) continue;
  changes.push({ ...row, newName: next.name, newRarity: next.rarity });
}

console.log(`Scanned ${data.length} row(s) ending in " Star".`);
console.log(`${changes.length} Gold Star card(s) to update.\n`);
const byRarity = {};
for (const c of changes) byRarity[c.rarity ?? "(none)"] = (byRarity[c.rarity ?? "(none)"] || 0) + 1;
console.log("current rarities being replaced:", JSON.stringify(byRarity));
console.log(`all becoming: ${GOLD_STAR_RARITY}\n`);
for (const c of changes.slice(0, 8)) {
  console.log(`  [${c.language}] ${c.name}  ->  ${c.newName}`);
}
if (changes.length > 8) console.log(`  …and ${changes.length - 8} more`);

const skipped = data.filter((r) => !isGoldStar(r.name));
if (skipped.length) {
  console.log(`\nLeft alone (${skipped.length}), e.g.:`);
  for (const r of skipped.slice(0, 4)) console.log(`  ${r.name} — ${r.rarity}`);
}

if (!changes.length) { console.log("\nNothing to do."); process.exit(0); }
if (!confirmed) {
  console.log("\nDry run. Re-run with --yes to apply.");
  process.exit(0);
}

let done = 0;
for (const c of changes) {
  const { error: e } = await supabase
    .from("cards_catalog")
    .update({ name: c.newName, rarity: c.newRarity })
    .eq("product_id", c.product_id);
  if (e) { console.error(`  ${c.product_id} failed: ${e.message}`); continue; }
  done += 1;
}
console.log(`\nUpdated ${done} of ${changes.length}.`);

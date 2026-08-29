// Dev utility: fill the marketplace with mock listings for UI testing.
//
// Cards come from the real Supabase catalogue — genuine names, sets, numbers,
// images and market prices — so the grid, filters and price displays are
// exercised against data shaped like production rather than lorem ipsum.
// Only the *listing* is fabricated: who is selling it, at what price, in what
// condition.
//
// Every document is written with `mock: true`, which is what --clean keys off.
// Nothing else in the app reads that field, so real listings can never be
// caught by the cleanup.
//
//   node scripts/seed-mock-listings.mjs            # dry run
//   node scripts/seed-mock-listings.mjs --yes      # write 100
//   node scripts/seed-mock-listings.mjs --yes -n 250
//   node scripts/seed-mock-listings.mjs --clean    # delete every mock listing

import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

if (!getApps().length) {
  initializeApp({
    credential: cert(
      JSON.parse(Buffer.from(env.NUXT_FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")),
    ),
  });
}
const db = getFirestore();

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const clean = args.includes("--clean");
const nIdx = args.indexOf("-n");
const WANT = nIdx >= 0 ? Math.max(1, Number(args[nIdx + 1])) : 100;

// ── Cleanup ───────────────────────────────────────────────────────────
if (clean) {
  const snap = await db.collection("cards").where("mock", "==", true).get();
  if (!snap.size) {
    console.log("No mock listings to remove.");
    process.exit(0);
  }
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
  console.log(`Deleted ${snap.size} mock listing(s). Real listings untouched.`);
  process.exit(0);
}

// ── Sellers: real users, so profile links resolve ─────────────────────
const users = (await db.collection("users").get()).docs
  .map((d) => ({ uid: d.id, ...d.data() }))
  .filter((u) => u.customName || u.displayName);
if (!users.length) {
  console.error("No users with a name — mock listings need a seller.");
  process.exit(1);
}

// ── Cards: pull a random slice of the real catalogue ──────────────────
const SUPA = env.NUXT_PUBLIC_SUPABASE_URL;
const KEY = env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const countRes = await fetch(
  `${SUPA}/rest/v1/cards_catalog?select=product_id&limit=1`,
  { headers: { ...H, Prefer: "count=exact" } },
);
const total = Number((countRes.headers.get("content-range") || "").split("/")[1] || 0);
if (!total) {
  console.error("Could not read catalogue size from Supabase.");
  process.exit(1);
}

// Many small windows rather than a few big ones. The catalogue is ordered by
// set, so pulling 100 rows from two random offsets returns two contiguous
// blocks — a marketplace where every card is from the same two sets, which
// tests the set filter poorly and looks obviously fake.
const picked = new Map();
const CHUNK = 8;
let guard = 0;
while (picked.size < WANT && guard < 400) {
  guard++;
  const offset = Math.floor(Math.random() * Math.max(1, total - CHUNK));
  const res = await fetch(
    `${SUPA}/rest/v1/cards_catalog?select=product_id,name,group_name,number,rarity,image_url,language,card_prices(prices)` +
      `&language=eq.EN&image_url=not.is.null&limit=${CHUNK}&offset=${offset}`,
    { headers: H },
  );
  if (!res.ok) continue;
  for (const row of await res.json()) {
    if (picked.size >= WANT) break;
    if (!row.image_url || !row.name) continue;
    if (picked.has(row.product_id)) continue;
    picked.set(row.product_id, row);
  }
}

const rows = [...picked.values()].slice(0, WANT);
if (rows.length < WANT) {
  console.log(`Note: catalogue yielded ${rows.length} usable cards (wanted ${WANT}).`);
}

// ── Shape the listings ────────────────────────────────────────────────
const CONDITIONS = [
  "Mint (M)", "Near Mint (NM)", "Near Mint (NM)", "Near Mint (NM)",
  "Lightly Played (LP)", "Lightly Played (LP)", "Moderately Played (MP)",
  "Heavily Played (HP)", "Damaged (DMG)",
];
const GRADERS = ["PSA", "CGC", "TAG", "Beckett"];
const USD_MYR = 4.7;

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const upgradeImage = (u) => (u || "").replace(/_200w(\.\w+)(\?.*)?$/i, "_400w$1$2");

const marketMyr = (row) => {
  const p = Array.isArray(row.card_prices) ? row.card_prices[0]?.prices : row.card_prices?.prices;
  if (!p) return null;
  for (const k of ["Holofoil", "Normal", "Reverse Holofoil"]) {
    const m = p[k]?.market ?? p[k]?.mid;
    if (m != null) return round2(Number(m) * USD_MYR);
  }
  for (const v of Object.values(p)) {
    const m = v?.market ?? v?.mid;
    if (m != null) return round2(Number(m) * USD_MYR);
  }
  return null;
};

const now = Date.now();
const DAY = 86_400_000;

const listings = rows.map((row, i) => {
  const seller = pick(users);
  const graded = Math.random() < 0.18;
  const condition = graded ? "" : pick(CONDITIONS);
  const base = marketMyr(row) ?? round2(8 + Math.random() * 120);
  // Sellers price around the market, not exactly on it.
  const price = round2(Math.max(1, base * (0.75 + Math.random() * 0.55)));

  return {
    cardName: row.name,
    cardSet: row.group_name ?? "",
    cardNumber: row.number ?? "",
    productType: graded ? "Graded" : "Ungraded",
    condition,
    gradingProvider: graded ? pick(GRADERS) : "",
    grade: graded ? String(pick([8, 9, 9, 10])) : "",
    customGradingProvider: "",
    description: "",
    price,
    imageUrl: upgradeImage(row.image_url),
    imageUrls: [upgradeImage(row.image_url)],
    seller: seller.customName || seller.displayName,
    sellerUid: seller.uid,
    // Spread over the last ~45 days so "Newest" sorting has something to do.
    createdAt: now - Math.floor(Math.random() * 45 * DAY),
    sold: false,
    status: "active",
    interestedCount: 0,
    favouriteCount: 0,
    viewCount: Math.floor(Math.random() * 80),
    language: row.language ?? "EN",
    tcgType: "Pokemon",
    productId: row.product_id,
    rarity: row.rarity ?? "",
    quantity: 1,
    negotiable: Math.random() < 0.3,
    pickupAvailable: Math.random() < 0.25,
    // The cleanup key. Nothing else in the app reads this.
    mock: true,
  };
});

const prices = listings.map((l) => l.price).sort((a, b) => a - b);
console.log(`Prepared ${listings.length} mock listing(s)`);
console.log(`  sellers      : ${new Set(listings.map((l) => l.sellerUid)).size} of ${users.length} users`);
console.log(`  distinct sets: ${new Set(listings.map((l) => l.cardSet)).size}`);
console.log(`  distinct cards: ${new Set(listings.map((l) => l.productId)).size}`);
console.log(`  graded       : ${listings.filter((l) => l.productType === "Graded").length}`);
console.log(`  price range  : RM ${prices[0]?.toFixed(2)} – RM ${prices[prices.length - 1]?.toFixed(2)}`);
console.log(`  sample       : ${listings.slice(0, 3).map((l) => `${l.cardName} (RM ${l.price})`).join(", ")}`);

if (!confirmed) {
  console.log("\nDry run. Re-run with --yes to write them.");
  process.exit(0);
}

for (let i = 0; i < listings.length; i += 400) {
  const batch = db.batch();
  for (const l of listings.slice(i, i + 400)) {
    batch.set(db.collection("cards").doc(), l);
  }
  await batch.commit();
}
console.log(`\nWrote ${listings.length} mock listing(s). Remove them with --clean.`);

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
//   node scripts/seed-mock-listings.mjs               # dry run
//   node scripts/seed-mock-listings.mjs --yes         # 100 listings + 20 auctions
//   node scripts/seed-mock-listings.mjs --yes -n 250 -a 40
//   node scripts/seed-mock-listings.mjs --clean       # delete every mock doc

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
const aIdx = args.indexOf("-a");
const WANT_AUCTIONS = aIdx >= 0 ? Math.max(0, Number(args[aIdx + 1])) : 20;

// ── Cleanup ───────────────────────────────────────────────────────────
if (clean) {
  let removed = 0;
  for (const name of ["cards", "auctions"]) {
    const snap = await db.collection(name).where("mock", "==", true).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    if (snap.size) console.log(`Deleted ${snap.size} mock doc(s) from ${name}.`);
    removed += snap.size;
  }
  console.log(removed ? "Real listings and auctions untouched." : "Nothing to remove.");
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

// Retried: this one request gates the whole run, and it fails intermittently
// — a transient 5xx here aborted the script with a message that read like
// misconfiguration.
const readTotal = async () => {
  let lastStatus = "no response";
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(
        `${SUPA}/rest/v1/cards_catalog?select=product_id&limit=1`,
        { headers: { ...H, Prefer: "count=exact" } },
      );
      lastStatus = `HTTP ${res.status}`;
      const n = Number((res.headers.get("content-range") || "").split("/")[1] || 0);
      if (n) return { total: n, status: lastStatus };
    } catch (err) {
      lastStatus = err.message;
    }
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }
  return { total: 0, status: lastStatus };
};

const { total, status: countStatus } = await readTotal();
if (!total) {
  console.error(`Could not read catalogue size from Supabase (${countStatus}).`);
  console.error("Checked NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

// Many small windows rather than a few big ones. The catalogue is ordered by
// set, so pulling 100 rows from two random offsets returns two contiguous
// blocks — a marketplace where every card is from the same two sets, which
// tests the set filter poorly and looks obviously fake.
const picked = new Map();
// A balance the two failure modes pull against: the catalogue is ordered by
// set, so a big window returns one contiguous block — 40 gave 100 cards from
// only 4 sets, which tests the set filter poorly and looks fake. Small windows
// give variety but cost a round trip each, and once code cards and sealed
// products are excluded a window of 8 yields so few usable rows that a run
// took minutes. 16 lands between: roughly a dozen sets, in seconds.
const CHUNK = 16;
let guard = 0;
while (picked.size < WANT && guard < 120) {
  guard++;
  const offset = Math.floor(Math.random() * Math.max(1, total - CHUNK));
  const res = await fetch(
    `${SUPA}/rest/v1/cards_catalog?select=product_id,name,group_name,number,rarity,image_url,language,card_prices(prices)` +
      `&language=eq.EN&image_url=not.is.null` +
      // Code Cards are the redemption slips in a booster pack — 1263 of them,
      // no image worth showing and nobody sells them. Sealed products are not
      // single cards either. Left in, they dominated a random sample and the
      // mock marketplace read as a pile of junk.
      `&rarity=not.in.(Code Card)&name=not.ilike.*Code Card*` +
      `&name=not.ilike.*Booster Box*&name=not.ilike.*Booster Pack*` +
      `&name=not.ilike.*Elite Trainer*&name=not.ilike.*Collection Box*` +
      `&limit=${CHUNK}&offset=${offset}`,
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

// ── Auctions ──────────────────────────────────────────────────────────
//
// Built from the same catalogue rows as the listings, so the auction grid is
// exercised against real card names, images and prices too.
//
// Deliberately spread across states rather than all "ends in 3 days": a live
// auction ending in minutes, one ending in a week, and a handful already ended
// are what actually shake out countdown formatting, the ending-soon sort and
// the settled-auction views. Bids are recorded as currentPrice above starting
// price so the UI has a spread to render; the RTDB bid ledger is not
// fabricated, so bid *history* stays empty.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const auctions = Array.from({ length: WANT_AUCTIONS }, (_, i) => {
  const row = pick(rows);
  const seller = pick(users);
  const graded = Math.random() < 0.35;
  const market = marketMyr(row) ?? round2(8 + Math.random() * 120);
  const startingPrice = Math.max(1, Math.round(market * (0.4 + Math.random() * 0.3)));
  // Roughly two thirds live, the rest already finished.
  const live = i % 3 !== 0;
  const endsAt = live
    ? now + pick([25 * MINUTE, 6 * HOUR, 2 * DAY, 5 * DAY, 7 * DAY])
    : now - pick([2 * HOUR, 1 * DAY, 4 * DAY]);
  const bidCount = Math.floor(Math.random() * 12);
  const currentPrice =
    bidCount === 0
      ? startingPrice
      : Math.round(startingPrice * (1 + bidCount * (0.04 + Math.random() * 0.06)));

  return {
    title: `${row.name}${graded ? " (Graded)" : ""}`,
    description: "",
    cardName: row.name,
    cardSet: row.group_name ?? "",
    cardNumber: row.number ?? "",
    productType: graded ? "Graded" : "Ungraded",
    condition: graded ? "" : pick(CONDITIONS),
    gradingProvider: graded ? pick(GRADERS) : "",
    grade: graded ? String(pick([8, 9, 9, 10])) : "",
    customGradingProvider: "",
    imageUrl: upgradeImage(row.image_url),
    imageUrls: [upgradeImage(row.image_url)],
    shippingWM: 8,
    shippingEM: 12,
    startingPrice,
    currentPrice,
    minIncrement: Math.max(1, Math.round(startingPrice * 0.05)),
    seller: seller.customName || seller.displayName,
    sellerUid: seller.uid,
    endsAt,
    createdAt: now - Math.floor(Math.random() * 20 * DAY),
    isPrivate: false,
    language: row.language ?? "EN",
    tcgType: "Pokemon",
    rarity: row.rarity ?? "",
    productId: row.product_id,
    quantity: 1,
    // Ended auctions are left unsettled on purpose: settlement is what
    // /api/auctions/settle does, and faking its output would hide whether that
    // route actually works.
    status: live ? "active" : "ended",
    viewCount: Math.floor(Math.random() * 200),
    bidCount,
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
console.log(`Prepared ${auctions.length} mock auction(s)`);
console.log(`  live         : ${auctions.filter((a) => a.status === "active").length}`);
console.log(`  ended        : ${auctions.filter((a) => a.status === "ended").length}`);
console.log(`  with bids    : ${auctions.filter((a) => a.bidCount > 0).length}`);
console.log(`  ending <1h   : ${auctions.filter((a) => a.status === "active" && a.endsAt - now < 60 * 60 * 1000).length}`);

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
for (let i = 0; i < auctions.length; i += 400) {
  const batch = db.batch();
  for (const a of auctions.slice(i, i + 400)) {
    batch.set(db.collection("auctions").doc(), a);
  }
  await batch.commit();
}
console.log(
  `\nWrote ${listings.length} mock listing(s) and ${auctions.length} mock auction(s).` +
    ` Remove them with --clean.`,
);

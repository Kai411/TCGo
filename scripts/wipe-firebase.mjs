// Clear the marketplace back to an empty state, keeping the catalogue.
//
//   node scripts/wipe-firebase.mjs              # dry run — prints, deletes nothing
//   node scripts/wipe-firebase.mjs --yes        # do it
//   node scripts/wipe-firebase.mjs --yes --include-staff   # also drop admin logins
//
// WHAT IS NOT TOUCHED
// ───────────────────
// The card catalogue and price history live in SUPABASE (cards_catalog,
// card_prices) — see scripts/seed-pokemon-catalog.mjs. This script only ever
// opens Firestore and Firebase Auth, so the catalogue cannot be harmed by it
// even by accident. That matters because Firestore's `cards` collection is
// seller LISTINGS, not the catalogue, despite the name.
//
// Staff logins are kept by default. There is no bootstrap route that creates
// the first staff account — server/api/mc/staff/create.post.ts requires an
// existing staff session — so deleting them locks the admin area permanently
// with no way back in code. --include-staff overrides that, for someone who
// has read this paragraph.
//
// FIREBASE AUTH IS CLEARED TOO
// Deleting only the `users` documents would leave the Auth records behind,
// and every email address would stay taken: you could not re-register with
// your own address on the fresh install this is meant to produce.
//
// A JSON backup is written before anything is deleted. It is not a restore
// path — there is no import script — but it is the difference between "we
// wiped it" and "we wiped it and cannot even say what was there".
//
// CLOSE EVERY OPEN TAB FIRST.
// A Firebase ID token stays cryptographically valid for up to an hour after
// the account behind it is deleted, so a browser left open on the app keeps
// writing as that user — useProfile auto-creates a profile document on auth,
// and one reappeared four seconds into the first real run of this script.
// Harmless, but it leaves an orphan profile with no Auth account behind it.
// --sweep-orphans clears any that appear; re-run it after the tabs are shut.

import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

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
const auth = getAuth();

const confirmed = process.argv.includes("--yes");
const includeStaff = process.argv.includes("--include-staff");
const sweepOnly = process.argv.includes("--sweep-orphans");

// ── Orphan sweep ─────────────────────────────────────────────────────
// A profile whose Auth account no longer exists. Left behind by a browser
// still holding a valid token during the wipe; see the note at the top.
if (sweepOnly) {
  const snap = await db.collection("users").get();
  let removed = 0;
  for (const d of snap.docs) {
    const exists = await auth
      .getUser(d.id)
      .then(() => true)
      .catch(() => false);
    if (exists) continue;
    if (confirmed) await d.ref.delete();
    removed++;
    console.log(`${confirmed ? "deleted" : "would delete"} orphan profile ${d.id}`);
  }
  console.log(
    removed
      ? `${removed} orphan(s)${confirmed ? " removed" : " — re-run with --yes"}`
      : "No orphans.",
  );
  process.exit(0);
}

// Everything a person or a transaction created. Named explicitly rather than
// discovered with listCollections(), so a collection added next month is not
// silently swept by a script written before it existed.
const WIPE = [
  "cards", // seller listings (NOT the catalogue — that's Supabase)
  "inventory",
  "compiledOrders",
  "posSales",
  "payouts",
  "auctions",
  "userCollection",
  "favourites",
  "notifications",
  "authCodes",
  "reports",
  "actionLogs",
  "errorLogs",
  "users",
  "staffSessions", // sessions only; the accounts are under `staff`
];

// Admin accounts. Kept unless asked for — see the note at the top.
const STAFF = ["staff", "staffCounters"];

const targets = includeStaff ? [...WIPE, ...STAFF] : WIPE;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = new URL(`../firebase-wipe-backup-${stamp}.json`, import.meta.url);

console.log(includeStaff ? "INCLUDING staff accounts.\n" : "Keeping staff accounts.\n");

// ── Survey ───────────────────────────────────────────────────────────
const backup = {};
let firestoreTotal = 0;
console.log("Firestore");
for (const name of targets) {
  const snap = await db.collection(name).get();
  backup[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  firestoreTotal += snap.size;
  console.log(`  ${name.padEnd(22)} ${String(snap.size).padStart(6)} docs`);
}

// Auth users, paged.
const authUsers = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  authUsers.push(...page.users.map((u) => ({ uid: u.uid, email: u.email ?? null })));
  pageToken = page.pageToken;
} while (pageToken);
backup.__authUsers = authUsers;

console.log(`\nFirebase Auth\n  accounts               ${String(authUsers.length).padStart(6)}`);
console.log(`\nKept: Supabase catalogue (cards_catalog, card_prices)`);
if (!includeStaff) console.log(`      Firestore ${STAFF.join(", ")}`);

if (!confirmed) {
  console.log(
    `\nDry run. Would delete ${firestoreTotal} Firestore document(s) and ` +
      `${authUsers.length} Auth account(s).`,
  );
  console.log("Re-run with --yes to apply.");
  process.exit(0);
}

// ── Apply ────────────────────────────────────────────────────────────
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`\nBackup written: ${backupPath.pathname.split("/").pop()}`);

for (const name of targets) {
  const docs = backup[name];
  if (!docs.length) continue;
  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) {
      batch.delete(db.collection(name).doc(d.id));
    }
    await batch.commit();
  }
  console.log(`  cleared ${name} (${docs.length})`);
}

// Auth last: while the documents are gone but the accounts remain, a stale
// session is a signed-in user with no profile — which the app handles. The
// reverse (profile with no account) is the state nothing expects.
if (authUsers.length) {
  for (let i = 0; i < authUsers.length; i += 1000) {
    const res = await auth.deleteUsers(authUsers.slice(i, i + 1000).map((u) => u.uid));
    if (res.failureCount) {
      console.log(`  ⚠ ${res.failureCount} Auth account(s) could not be deleted`);
      for (const e of res.errors.slice(0, 5)) console.log(`     ${e.error.message}`);
    }
  }
  console.log(`  cleared Firebase Auth (${authUsers.length})`);
}

console.log("\nDone. Register a fresh account through /login to start again.");
if (!includeStaff) console.log("Staff logins are unchanged — /mintcondition still works.");
process.exit(0);

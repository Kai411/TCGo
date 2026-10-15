// Read-only survey of everything people have created in Firebase, grouped by
// account, so someone can mark what to keep before a clean-up.
//
//   node scripts/survey-firebase-data.mjs
//
// NOTHING IS WRITTEN TO FIREBASE. The script only lists and reads. It writes
// one local report file, firebase-survey-<time>.md (gitignored), and prints
// the same report.
//
// WHY BY ACCOUNT
// ──────────────
// "Is this test data?" is a question about who made it. So every Auth account
// is listed with what it owns, and every document is linked to the accounts
// it mentions. The link is found, not hard-coded: any string field (or string
// in an array, e.g. a conversation's `participants`) equal to a known uid, or
// a document id equal to one. Field names differ per collection and change
// over time; matching on values doesn't care.
//
// COLLECTIONS ARE DISCOVERED, not named — unlike wipe-firebase.mjs, which
// names its targets on purpose. A survey should show what is there, including
// anything added since that list was written; any collection the wipe would
// NOT touch is flagged so the gap is visible before anything is deleted.
//
// PRIVATE FIELDS ARE NEVER PRINTED. A document is shown as its id, the
// accounts it links to, and a few whitelisted label fields (name, title,
// status, dates, price). Accounts show email and display name, which the
// person marking keep/delete needs to recognise them; the report stays on the
// machine that ran it.
//
// The card catalogue and price history are in Supabase, not here.

import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const serviceAccount = JSON.parse(
  Buffer.from(env.NUXT_FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8"),
);
const databaseURL = env.NUXT_PUBLIC_FIREBASE_DATABASE_URL || undefined;
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), ...(databaseURL ? { databaseURL } : {}) });
}
const db = getFirestore();
const auth = getAuth();

// What scripts/wipe-firebase.mjs deletes (WIPE + STAFF). Kept in step by
// hand; a mismatch only changes which collections get the "not wiped" flag.
const WIPE_COVERS = new Set([
  "cards", "inventory", "compiledOrders", "posSales", "payouts", "auctions",
  "userCollection", "favourites", "notifications", "authCodes", "webhookEvents",
  "reports", "actionLogs", "errorLogs", "users", "staffSessions", "staff", "staffCounters",
]);
// Subcollections the app uses. Counted with collection-group queries, which
// is far cheaper than listing every parent document's children.
const SUBCOLLECTIONS = ["private", "consents", "messages"];
const LABEL_FIELDS = [
  "name", "title", "cardName", "displayName", "username", "status",
  "price", "total", "currentBid", "createdAt", "updatedAt", "endsAt",
];
const SAMPLES_PER_COLLECTION = 5;

const out = [];
const log = (s = "") => {
  out.push(s);
  console.log(s);
};
const day = (v) => {
  if (!v) return "";
  const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};
const label = (data) =>
  LABEL_FIELDS.filter((k) => data[k] != null && (typeof data[k] !== "object" || data[k].toDate))
    .slice(0, 4)
    .map((k) => `${k}=${/At$/.test(k) ? day(data[k]) : String(data[k]).slice(0, 40)}`)
    .join(", ");

// ── Accounts ─────────────────────────────────────────────────────────
const accounts = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  accounts.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);
const uids = new Set(accounts.map((u) => u.uid));

// ── Firestore ────────────────────────────────────────────────────────
const collections = (await db.listCollections()).map((c) => c.id).sort();
const staffIds = new Set();
const owned = new Map(); // uid -> Map(collection -> count)
const perCollection = [];
for (const name of collections) {
  const snap = await db.collection(name).get();
  let unlinked = 0;
  const samples = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (name === "staff") staffIds.add(d.id);
    const links = new Set();
    if (uids.has(d.id)) links.add(d.id);
    for (const v of Object.values(data)) {
      for (const s of Array.isArray(v) ? v : [v]) {
        if (typeof s === "string" && uids.has(s)) links.add(s);
      }
    }
    // Conversation ids are the two uids joined by "__".
    for (const part of d.id.split("__")) if (uids.has(part)) links.add(part);
    if (!links.size) unlinked++;
    for (const uid of links) {
      const m = owned.get(uid) ?? new Map();
      m.set(name, (m.get(name) ?? 0) + 1);
      owned.set(uid, m);
    }
    if (samples.length < SAMPLES_PER_COLLECTION) {
      samples.push(`${d.id}${links.size ? ` [${[...links].join(", ")}]` : ""} ${label(data)}`.trim());
    }
  }
  perCollection.push({ name, size: snap.size, unlinked, samples });
}
const sub = [];
for (const name of SUBCOLLECTIONS) {
  sub.push({ name, size: (await db.collectionGroup(name).count().get()).data().count });
}

// ── Realtime Database (live auction bids) ────────────────────────────
const rtdb = [];
let rtdbNote = "";
if (databaseURL) {
  try {
    const root = (await getDatabase().ref().get()).val() ?? {};
    for (const [k, v] of Object.entries(root)) {
      rtdb.push({ name: k, size: v && typeof v === "object" ? Object.keys(v).length : 1 });
    }
  } catch (e) {
    rtdbNote = `could not read: ${e.message}`;
  }
} else {
  rtdbNote = "NUXT_PUBLIC_FIREBASE_DATABASE_URL not set in .env; skipped";
}

// ── Report ───────────────────────────────────────────────────────────
log(`# Firebase data survey`);
log();
log(`Firebase project: **${serviceAccount.project_id}**` +
  (env.NUXT_PUBLIC_FIREBASE_PROJECT_ID && env.NUXT_PUBLIC_FIREBASE_PROJECT_ID !== serviceAccount.project_id
    ? ` (⚠ .env NUXT_PUBLIC_FIREBASE_PROJECT_ID says ${env.NUXT_PUBLIC_FIREBASE_PROJECT_ID})`
    : ""));
log(`Compare it with NUXT_PUBLIC_FIREBASE_PROJECT_ID on the Netlify site before trusting this as "staging".`);
log(`Run at ${new Date().toISOString()}. Read-only: nothing was changed.`);
log();
log(`## Accounts (${accounts.length})`);
log();
log(`| # | uid | email | name | sign-in | created | last sign-in | staff | owns |`);
log(`|---|---|---|---|---|---|---|---|---|`);
const byCreated = [...accounts].sort((a, b) =>
  new Date(a.metadata.creationTime) - new Date(b.metadata.creationTime));
byCreated.forEach((u, i) => {
  const m = owned.get(u.uid);
  const owns = m ? [...m].map(([c, n]) => `${c} ${n}`).join(", ") : "nothing";
  log(`| ${i + 1} | ${u.uid} | ${u.email ?? ""} | ${u.displayName ?? ""} | ` +
    `${u.providerData.map((p) => p.providerId.replace(".com", "")).join("+")} | ` +
    `${day(u.metadata.creationTime)} | ${day(u.metadata.lastSignInTime)} | ` +
    `${staffIds.has(u.uid) ? "yes" : ""} | ${owns} |`);
});
log();
log(`## Firestore collections (${collections.length})`);
log();
log(`| collection | docs | not linked to any account | wiped by wipe-firebase.mjs |`);
log(`|---|---|---|---|`);
for (const c of perCollection) {
  log(`| ${c.name} | ${c.size} | ${c.unlinked} | ${WIPE_COVERS.has(c.name) ? "yes" : "**no**"} |`);
}
for (const s of sub) log(`| */${s.name} (subcollection) | ${s.size} | | with parent |`);
log();
log(`## Realtime Database`);
log();
if (rtdbNote) log(rtdbNote);
for (const r of rtdb) log(`- ${r.name}: ${r.size} entries`);
log();
log(`## Samples (first ${SAMPLES_PER_COLLECTION} per collection; [uids] = linked accounts)`);
for (const c of perCollection) {
  if (!c.samples.length) continue;
  log();
  log(`### ${c.name}`);
  for (const s of c.samples) log(`- ${s}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = new URL(`../firebase-survey-${stamp}.md`, import.meta.url);
writeFileSync(file, out.join("\n") + "\n");
console.log(`\nReport written: ${file.pathname.split("/").pop()}`);
process.exit(0);

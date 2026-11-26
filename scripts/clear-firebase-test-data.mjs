// Clear test and transactional data from Firestore (and the Realtime Database
// auction nodes), leaving every account and everything people keep for
// themselves alone. Run by .github/workflows/clear-firebase-test-data.yml, or
// by hand:
//
//   CLEAR_COLLECTIONS="compiledOrders,payouts" node scripts/clear-firebase-test-data.mjs
//       dry run: prints what is there, deletes nothing
//
//   CLEAR_COLLECTIONS="..." CLEAR_MODE=delete CLEAR_CONFIRM="DELETE TEST DATA" \
//   CLEAR_PROJECT=<project id> node scripts/clear-firebase-test-data.mjs
//       backs up, then deletes
//
// What may and may not be cleared is in scripts/lib/clear-firebase.mjs.
// Firebase Auth accounts are never opened: this script has no Auth import.
//
// Other inputs (environment variables):
//   FIREBASE_DATABASE_URL  Realtime Database URL; needed when `auctions` is picked
//   CLEAR_BACKUP_DIR       where the JSON backup goes before a delete (default: repo root)
//   GITHUB_REF             set by Actions; a delete runs only on refs/heads/staging
//   FIRESTORE_EMULATOR_HOST / FIREBASE_DATABASE_EMULATOR_HOST + GCLOUD_PROJECT
//                          point it at the emulator instead (used for testing)
//
// The key: FIREBASE_DEPLOY_KEY (raw JSON or base64), or the file named by
// GOOGLE_APPLICATION_CREDENTIALS, or NUXT_FIREBASE_SERVICE_ACCOUNT in .env.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import {
  CLEARABLE,
  PROTECTED,
  RTDB_AUCTION_PATHS,
  parseSelection,
  deleteBlockers,
  relatedWarnings,
  permissionHint,
} from "./lib/clear-firebase.mjs";

const fail = (msg) => {
  console.error(`::error::${msg}`);
  process.exit(1);
};

const readDotEnv = () => {
  try {
    return Object.fromEntries(
      readFileSync(new URL("../.env", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
};

const mode = (process.env.CLEAR_MODE || "dry-run").trim();
if (!["dry-run", "delete"].includes(mode)) fail(`CLEAR_MODE must be dry-run or delete, not "${mode}".`);

// ── What to clear ────────────────────────────────────────────────────
const { collections, refused, unknown } = parseSelection(process.env.CLEAR_COLLECTIONS);
if (refused.length) {
  fail(`Refused, these hold user data and are never cleared: ${refused.map((n) => `${n} (${PROTECTED[n]})`).join("; ")}.`);
}
if (unknown.length) {
  fail(`Not a known collection: ${unknown.join(", ")}. Clearable: ${Object.keys(CLEARABLE).join(", ")}.`);
}
if (!collections.length) fail("No collections picked. Nothing to do.");
const withRtdb = collections.includes("auctions");

// ── Connect ──────────────────────────────────────────────────────────
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let keyProject;
if (emulator) {
  keyProject = process.env.GCLOUD_PROJECT;
  if (!keyProject) fail("Set GCLOUD_PROJECT when using the emulator.");
  if (!getApps().length) initializeApp({ projectId: keyProject, databaseURL: process.env.FIREBASE_DATABASE_URL });
} else {
  let raw =
    process.env.FIREBASE_DEPLOY_KEY ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")) ||
    process.env.NUXT_FIREBASE_SERVICE_ACCOUNT ||
    readDotEnv().NUXT_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) fail("No service account: set FIREBASE_DEPLOY_KEY, or NUXT_FIREBASE_SERVICE_ACCOUNT in .env.");
  let sa;
  try {
    sa = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    fail("The service account key is not valid JSON.");
  }
  keyProject = sa.project_id;
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
      projectId: keyProject,
      databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
    });
  }
}

const blockers = deleteBlockers({
  mode,
  confirm: process.env.CLEAR_CONFIRM,
  typedProject: process.env.CLEAR_PROJECT,
  keyProject,
  ref: process.env.GITHUB_ACTIONS ? process.env.GITHUB_REF : undefined,
});
if (blockers.length) fail(`Nothing deleted. ${blockers.join(" ")}`);

if (withRtdb && !process.env.FIREBASE_DATABASE_URL) {
  fail(
    "auctions also clears the Realtime Database, so FIREBASE_DATABASE_URL is needed: add a repository " +
      "variable FIREBASE_DATABASE_URL with the same value as NUXT_PUBLIC_FIREBASE_DATABASE_URL on Netlify. " +
      "Or leave auctions out of the list.",
  );
}

const db = getFirestore();
const rtdb = withRtdb ? getDatabase() : null;

const guard = async (where, fn) => {
  try {
    return await fn();
  } catch (err) {
    const hint = permissionHint(err, where);
    fail(`${hint ?? "Firebase call failed."} (${err?.code ?? ""} ${err?.message ?? err})`);
  }
};

// ── Survey ───────────────────────────────────────────────────────────
// Walks each collection and its subcollections, keeping the data for the
// backup. listDocuments() also returns parents that only exist because they
// have subcollections, so nothing under them is missed.
const walk = async (colRef, out) => {
  const refs = await colRef.listDocuments();
  for (let i = 0; i < refs.length; i += 300) {
    const slice = refs.slice(i, i + 300);
    const snaps = await db.getAll(...slice);
    for (const snap of snaps) {
      if (snap.exists) out.push({ path: snap.ref.path, data: snap.data() });
    }
    for (const ref of slice) {
      for (const sub of await ref.listCollections()) await walk(sub, out);
    }
  }
  return out;
};

console.log(`Project: ${keyProject}${emulator ? " (emulator)" : ""}`);
console.log(`Mode:    ${mode}\n`);
console.log("Firestore");
const backup = { project: keyProject, takenAt: new Date().toISOString(), firestore: {}, rtdb: {} };
let total = 0;
for (const name of collections) {
  const docs = await guard("firestore", () => walk(db.collection(name), []));
  backup.firestore[name] = docs;
  total += docs.length;
  const top = docs.filter((d) => !d.path.slice(name.length + 1).includes("/")).length;
  const nested = docs.length - top;
  console.log(
    `  ${name.padEnd(16)} ${String(top).padStart(6)} docs${nested ? ` + ${nested} in subcollections` : ""}   ${CLEARABLE[name]}`,
  );
}

let rtdbTotal = 0;
if (rtdb) {
  console.log("\nRealtime Database");
  for (const path of RTDB_AUCTION_PATHS) {
    const val = await guard("rtdb", async () => (await rtdb.ref(path).once("value")).val());
    backup.rtdb[path] = val;
    const n = val && typeof val === "object" ? Object.keys(val).length : 0;
    rtdbTotal += n;
    console.log(`  ${path.padEnd(18)} ${String(n).padStart(6)} entries`);
  }
}

console.log(`\nKept, never touched: ${Object.keys(PROTECTED).join(", ")}, Firebase Auth accounts.`);
const notPicked = Object.keys(CLEARABLE).filter((n) => !collections.includes(n));
if (notPicked.length) console.log(`Not picked this run: ${notPicked.join(", ")}.`);
for (const w of relatedWarnings(collections)) console.log(`::warning::${w}`);

if (mode !== "delete") {
  console.log(
    `\nDry run. A delete would remove ${total} Firestore document(s)` +
      (rtdb ? ` and ${rtdbTotal} Realtime Database entr${rtdbTotal === 1 ? "y" : "ies"}` : "") +
      ". Nothing was changed.",
  );
  process.exit(0);
}

// ── Back up, then delete ─────────────────────────────────────────────
const dir = process.env.CLEAR_BACKUP_DIR || new URL("..", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const file = join(dir, `firebase-clear-backup-${backup.takenAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2));
console.log(`\nBackup written: ${file}`);

for (const name of collections) {
  if (!backup.firestore[name].length) continue;
  // Deletes every document and every subcollection under it.
  await guard("firestore", () => db.recursiveDelete(db.collection(name)));
  console.log(`  cleared ${name} (${backup.firestore[name].length})`);
}
if (rtdb) {
  for (const path of RTDB_AUCTION_PATHS) {
    if (backup.rtdb[path] == null) continue;
    await guard("rtdb", () => rtdb.ref(path).remove());
    console.log(`  cleared ${path}`);
  }
}

// Check nothing is left (a browser left open can write again straight away).
let left = 0;
for (const name of collections) {
  const n = (await db.collection(name).count().get()).data().count;
  if (n) console.log(`::warning::${name} still has ${n} doc(s); something wrote to it during the run.`);
  left += n;
}
console.log(left ? "\nDone, with the warnings above." : "\nDone. Accounts and user data are unchanged.");
process.exit(0);

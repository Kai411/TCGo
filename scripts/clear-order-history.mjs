// Dev utility: wipe order history for a clean test run.
//
// DELETES:   compiledOrders, orders (legacy), payouts
// PRESERVES: inventory, cards, auctions, users, userCollection, favourites
//
// Inventory is never touched — "active items" stay exactly as they are. Note
// that items already marked sold STAY sold: clearing the orders that sold them
// does not un-sell them, and silently rewriting stock levels is not something
// a cleanup script should decide. Use --reset-sold if you want that too.
//
//   node scripts/clear-order-history.mjs             # dry run, shows what would go
//   node scripts/clear-order-history.mjs --yes       # back up, then delete
//   node scripts/clear-order-history.mjs --yes --reset-sold
//
// Every run writes a JSON backup next to the script before deleting anything.

import { readFileSync, writeFileSync } from "node:fs";
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
    credential: cert(JSON.parse(Buffer.from(env.NUXT_FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8"))),
  });
}
const db = getFirestore();

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const resetSold = args.includes("--reset-sold");

const TARGETS = ["compiledOrders", "orders", "payouts"];
const PRESERVED = ["inventory", "cards", "auctions", "users", "userCollection", "favourites", "reports"];

console.log("Will DELETE   :", TARGETS.join(", "));
console.log("Will PRESERVE :", PRESERVED.join(", "));
console.log("");

const backup = {};
let total = 0;
for (const name of TARGETS) {
  const snap = await db.collection(name).get();
  backup[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  total += snap.size;
  console.log(`  ${name.padEnd(16)} ${String(snap.size).padStart(4)} doc(s)`);
}

// Show inventory impact without changing it.
const inv = await db.collection("inventory").get();
const sold = inv.docs.filter((d) => d.data().status === "sold");
console.log("");
console.log(`  inventory        ${String(inv.size).padStart(4)} doc(s) — PRESERVED (${sold.length} marked sold)`);

if (!total) {
  console.log("\nNothing to delete.");
  process.exit(0);
}

if (!confirmed) {
  console.log(`\nDry run. ${total} document(s) would be deleted.`);
  console.log("Re-run with --yes to back up and delete.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = new URL(`../order-history-backup-${stamp}.json`, import.meta.url);
writeFileSync(path, JSON.stringify(backup, null, 2));
console.log(`\nBackup written: ${path.pathname}`);

for (const name of TARGETS) {
  const docs = backup[name];
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) {
      batch.delete(db.collection(name).doc(d.id));
    }
    await batch.commit();
  }
  console.log(`  deleted ${docs.length} from ${name}`);
}

if (resetSold && sold.length) {
  for (let i = 0; i < sold.length; i += 400) {
    const batch = db.batch();
    for (const d of sold.slice(i, i + 400)) {
      batch.update(d.ref, {
        status: "in_stock",
        soldAt: null,
        soldPrice: null,
        saleChannel: null,
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
  }
  console.log(`  reset ${sold.length} sold inventory item(s) back to in_stock`);
}

console.log(`\nDone. ${total} document(s) deleted, inventory preserved.`);

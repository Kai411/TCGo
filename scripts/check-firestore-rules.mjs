// Run the app's own Firestore reads and writes through the CLIENT SDK, as a
// throwaway signed-in user and as a guest, against the LIVE rules. Reports
// what the rules allow and refuse.
//
// Why this exists: rules only take effect once published, and a rule that
// looks right can still refuse a query the app makes — Firestore rejects a
// list query unless the rules can prove every possible result is allowed,
// so `where("listingId", "==", x)` against `allow read: if isOwner(
// resource.data.userUid)` fails even when every row IS the caller's. Nothing
// but running the queries finds that. Run it after every
// deploy-firestore-rules.mjs --yes.
//
//   node scripts/check-firestore-rules.mjs
//
// Everything it writes is tagged `mock: true` under uids starting with
// `tcgotest_`, and removed afterwards.

import { readFileSync } from "node:fs";
import { initializeApp as initAdmin, cert, getApps } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { initializeApp as initClient, deleteApp } from "firebase/app";
import { getAuth as clientAuth, signInWithCustomToken } from "firebase/auth";
import {
  getFirestore as clientFirestore,
  collection,
  doc,
  query,
  where,
  limit,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sa = JSON.parse(Buffer.from(env.NUXT_FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8"));
if (!getApps().length) initAdmin({ credential: cert(sa), projectId: sa.project_id });
const admin = adminFirestore();
const auth = adminAuth();

const RUN = Date.now().toString(36);
const me = `tcgotest_rules_me_${RUN}`;
const other = `tcgotest_rules_other_${RUN}`;

const results = [];
const report = (name, outcome, expected, detail = "") => {
  // outcome: "ok" | "denied" | other error code
  const ok = expected === "either" || outcome === expected;
  results.push({ name, ok, outcome, expected, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`  ${tag}  ${name}  — ${outcome}${expected !== "either" && !ok ? ` (expected ${expected})` : ""}${detail ? `; ${detail}` : ""}`);
};

const attempt = async (fn) => {
  try {
    const r = await fn();
    return { outcome: "ok", value: r };
  } catch (e) {
    const code = String(e?.code || "");
    return { outcome: code.includes("permission-denied") ? "denied" : code || e?.message || String(e) };
  }
};

const clientApp = (name) =>
  initClient(
    {
      apiKey: env.NUXT_PUBLIC_FIREBASE_API_KEY,
      projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      authDomain: env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    },
    `${name}-${RUN}`,
  );

// ── Fixtures (Admin SDK, bypasses rules) ─────────────────────────────────

const fixtures = { docs: [] };
const put = async (coll, data) => {
  const ref = await admin.collection(coll).add({ ...data, mock: true, createdAt: Date.now() });
  fixtures.docs.push(ref);
  return ref.id;
};

console.log(`Firestore rules check on ${sa.project_id} (run ${RUN})\n`);
console.log("Setup");
for (const uid of [me, other]) {
  await auth.createUser({ uid, email: `${uid}@example.test`, displayName: uid });
  await admin.collection("users").doc(uid).set({
    uid,
    email: `${uid}@example.test`,
    displayName: uid,
    customName: uid,
    trustScore: 100,
    tier: "free",
    favouritesPublic: true,
    createdAt: Date.now(),
    mock: true,
  });
}
const myInventory = await put("inventory", { userUid: me, listingId: `listing_${RUN}`, cardName: "Test", status: "listed" });
await put("userCollection", { userUid: other, productId: 1, addedAt: Date.now() });
await put("userCollection", { userUid: me, productId: 2, addedAt: Date.now() });
const myOrder = await put("compiledOrders", { buyerUid: me, sellerUid: other, status: "pending", items: [], subtotal: 0, total: 0 });
await put("notifications", { userUid: me, kind: "test", title: "t", body: "b", readAt: null });
const someCard = (await admin.collection("cards").limit(1).get()).docs[0];
console.log(`  users ${me}, ${other}; fixtures in inventory, userCollection, compiledOrders, notifications`);

// ── Signed in ────────────────────────────────────────────────────────────

console.log("\nSigned in (the app's own queries)");
const app = clientApp("me");
await signInWithCustomToken(clientAuth(app), await auth.createCustomToken(me));
const db = clientFirestore(app);
const q = (coll, ...clauses) => getDocs(query(collection(db, coll), ...clauses));

report("shop: list cards", (await attempt(() => q("cards", limit(5)))).outcome, "ok");
report("shop: list auctions", (await attempt(() => q("auctions", limit(5)))).outcome, "ok");
if (someCard) report("shop: read one card", (await attempt(() => getDoc(doc(db, "cards", someCard.id)))).outcome, "ok");
report("profile: read another user's profile", (await attempt(() => getDoc(doc(db, "users", other)))).outcome, "ok");
report("profile: update own customName", (await attempt(() => updateDoc(doc(db, "users", me), { customName: "Renamed" }))).outcome, "ok");
report("profile: self-verify KYC", (await attempt(() => updateDoc(doc(db, "users", me), { kycStatus: "verified" }))).outcome, "denied");
report("profile: self-upgrade tier", (await attempt(() => updateDoc(doc(db, "users", me), { tier: "premium" }))).outcome, "denied");
report("favourites: mine", (await attempt(() => q("favourites", where("userId", "==", me)))).outcome, "ok");
const fav = await attempt(() => addDoc(collection(db, "favourites"), { userId: me, cardId: "x", createdAt: Date.now(), mock: true }));
report("favourites: add one", fav.outcome, "ok");
if (fav.value) report("favourites: remove it", (await attempt(() => deleteDoc(fav.value))).outcome, "ok");
report("collection: mine", (await attempt(() => q("userCollection", where("userUid", "==", me)))).outcome, "ok");
report("collection: someone else's (profile showcase)", (await attempt(() => q("userCollection", where("userUid", "==", other)))).outcome, "either");
report("inventory: mine", (await attempt(() => q("inventory", where("userUid", "==", me)))).outcome, "ok");
report("inventory: mine, by listing id", (await attempt(() => q("inventory", where("userUid", "==", me), where("listingId", "==", `listing_${RUN}`)))).outcome, "ok");
report("inventory: by listing id alone (old query shape)", (await attempt(() => q("inventory", where("listingId", "==", `listing_${RUN}`)))).outcome, "either");
report("inventory: update own row", (await attempt(() => updateDoc(doc(db, "inventory", myInventory), { listPrice: 1 }))).outcome, "ok");
report("inventory: someone else's", (await attempt(() => q("inventory", where("userUid", "==", other)))).outcome, "denied");
report("orders: as buyer", (await attempt(() => q("compiledOrders", where("buyerUid", "==", me)))).outcome, "ok");
report("orders: as seller", (await attempt(() => q("compiledOrders", where("sellerUid", "==", me)))).outcome, "ok");
report("orders: everyone's", (await attempt(() => q("compiledOrders", limit(3)))).outcome, "denied");
report("orders: read own", (await attempt(() => getDoc(doc(db, "compiledOrders", myOrder)))).outcome, "ok");
report("orders: set delivery address on own pending order", (await attempt(() => updateDoc(doc(db, "compiledOrders", myOrder), { deliveryAddress: { postcode: "47300" } }))).outcome, "ok");
report("orders: mark own order paid", (await attempt(() => updateDoc(doc(db, "compiledOrders", myOrder), { status: "paid" }))).outcome, "denied");
report("legacy orders: as buyer", (await attempt(() => q("orders", where("buyerUid", "==", me)))).outcome, "ok");
report("notifications: mine", (await attempt(() => q("notifications", where("userUid", "==", me)))).outcome, "ok");
report("notifications: someone else's", (await attempt(() => q("notifications", where("userUid", "==", other)))).outcome, "denied");
report("staff/payouts/refunds: hidden", (await attempt(() => q("payouts", limit(1)))).outcome, "denied");

await deleteApp(app);

// ── Guest ────────────────────────────────────────────────────────────────

console.log("\nGuest (signed out)");
const guest = clientApp("guest");
const gdb = clientFirestore(guest);
const gq = (coll, ...clauses) => getDocs(query(collection(gdb, coll), ...clauses));
report("guest: list cards", (await attempt(() => gq("cards", limit(5)))).outcome, "ok");
report("guest: list auctions", (await attempt(() => gq("auctions", limit(5)))).outcome, "ok");
report("guest: read a profile", (await attempt(() => getDoc(doc(gdb, "users", other)))).outcome, "either");
report("guest: read someone's orders", (await attempt(() => gq("compiledOrders", where("buyerUid", "==", me)))).outcome, "denied");
report("guest: write a card", (await attempt(() => addDoc(collection(gdb, "cards"), { cardName: "nope", mock: true }))).outcome, "denied");
await deleteApp(guest);

// ── Cleanup ──────────────────────────────────────────────────────────────

console.log("\nCleanup");
const batch = admin.batch();
for (const ref of fixtures.docs) batch.delete(ref);
for (const coll of ["favourites"]) {
  const snap = await admin.collection(coll).where("userId", "in", [me, other]).get();
  snap.docs.forEach((d) => batch.delete(d.ref));
}
batch.delete(admin.collection("users").doc(me));
batch.delete(admin.collection("users").doc(other));
await batch.commit();
await auth.deleteUsers([me, other]);
console.log("  removed fixtures and test users");

const failed = results.filter((r) => !r.ok);
const info = results.filter((r) => r.expected === "either");
console.log(`\n${results.length - failed.length} as expected, ${failed.length} not.`);
if (info.length) {
  console.log("Product choices to confirm (no expectation set):");
  for (const r of info) console.log(`  · ${r.name}: ${r.outcome}`);
}
for (const f of failed) console.log(`  ✗ ${f.name}: ${f.outcome}, expected ${f.expected}`);
process.exit(failed.length ? 1 : 0);

// Dev utility: mark a compiled order delivered, with a backdated delivery date.
//
// Why this exists: funds only unlock at `deliveredAt + PAYOUT_HOLD_DAYS`, and
// nothing in the app can set `deliveredAt` to anything but Date.now() —
// markDelivered() stamps the current time. So there is no way to exercise the
// payout path without either waiting three days or editing Firestore directly.
//
// Note this is also the ONLY way an order becomes "delivered" today: courier
// tracking is read-only (server/api/shipping/track.post.ts writes nothing
// back), so a parcel Delyva reports as delivered leaves the order on "shipped".
//
//   node scripts/backdate-delivery.mjs --list
//   node scripts/backdate-delivery.mjs <orderId> [--days 4]
//
// --days is how long ago delivery happened; anything above PAYOUT_HOLD_DAYS
// makes the funds immediately available.

import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Mirrors shared/payouts.ts — kept in sync by hand because this script runs
// outside the Nuxt/TS build.
const PAYOUT_HOLD_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const b64 = env.NUXT_FIREBASE_SERVICE_ACCOUNT;
if (!b64) {
  console.error("NUXT_FIREBASE_SERVICE_ACCOUNT missing from .env");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(Buffer.from(b64, "base64").toString("utf8"))),
  });
}
const db = getFirestore();

const args = process.argv.slice(2);
const list = args.includes("--list");
const daysIdx = args.indexOf("--days");
const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : PAYOUT_HOLD_DAYS + 1;
const orderId = args.find((a) => !a.startsWith("--") && a !== String(days));

const money = (n) => "RM " + Number(n || 0).toFixed(2);
const payoutOf = (o) => (o.subtotal || 0); // PLATFORM_FEE_PERCENT is 0 in beta

if (list) {
  const snap = await db
    .collection("compiledOrders")
    .where("paymentMethod", "==", "billplz")
    .get();
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
  if (!rows.length) {
    console.log("No payout-trackable (billplz, paid/shipped/delivered) orders.");
    process.exit(0);
  }
  console.log(`${rows.length} payout-trackable order(s):\n`);
  for (const o of rows) {
    const eligibleAt =
      o.status === "delivered" && o.deliveredAt
        ? o.deliveredAt + PAYOUT_HOLD_DAYS * DAY_MS
        : null;
    const state =
      eligibleAt === null
        ? "LOCKED (not delivered)"
        : Date.now() >= eligibleAt
          ? "AVAILABLE"
          : `LOCKED until ${new Date(eligibleAt).toLocaleString("en-MY")}`;
    console.log(`  ${o.id}`);
    console.log(
      `     ${o.status.padEnd(9)} ${money(payoutOf(o)).padEnd(12)} payout=${o.payoutStatus ?? "pending"}  ${state}`,
    );
  }
  process.exit(0);
}

if (!orderId) {
  console.error("Usage: node scripts/backdate-delivery.mjs <orderId> [--days N]");
  console.error("       node scripts/backdate-delivery.mjs --list");
  process.exit(1);
}

const ref = db.collection("compiledOrders").doc(orderId);
const snap = await ref.get();
if (!snap.exists) {
  console.error("Order not found:", orderId);
  process.exit(1);
}
const before = snap.data();

if (before.paymentMethod !== "billplz") {
  console.error(
    `Order paymentMethod is "${before.paymentMethod}" — only billplz orders enter the payout rail, so this would prove nothing.`,
  );
  process.exit(1);
}

const deliveredAt = Date.now() - days * DAY_MS;
await ref.update({ status: "delivered", deliveredAt });

const eligibleAt = deliveredAt + PAYOUT_HOLD_DAYS * DAY_MS;
console.log("Order      :", orderId);
console.log("Before     :", before.status, "| deliveredAt:", before.deliveredAt ?? "unset");
console.log("After      : delivered | deliveredAt:", new Date(deliveredAt).toLocaleString("en-MY"), `(${days}d ago)`);
console.log("Hold ends  :", new Date(eligibleAt).toLocaleString("en-MY"));
console.log("Payout     :", money(payoutOf(before)));
console.log(
  "Fund state :",
  Date.now() >= eligibleAt ? "AVAILABLE ✅ — check /seller/funds" : "still LOCKED (raise --days)",
);

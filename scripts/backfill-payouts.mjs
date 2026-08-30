// Repair sellerPayout on orders settled before the post-booking refresh
// existed.
//
// The Billplz webhook used to write sellerPayout before booking the courier.
// shippingReimbursement keys off shipmentOrderNo, which did not exist yet, so
// every auto-booked order recorded a payout that reimbursed the seller for
// postage the platform then paid the courier for — the same money out twice.
// The webhook now settles the figure after booking; this fixes what it wrote
// before that.
//
// Commission is never touched. It was struck on the subtotal when payment
// landed, and who ends up buying the label has nothing to do with it. Only
// the shipping side is re-derived.
//
//   node scripts/backfill-payouts.mjs           # dry run
//   node scripts/backfill-payouts.mjs --yes     # apply
//
// --reprice additionally restates the COMMISSION at today's rate. That is
// normally the one thing never to do — a sale charged 2% during beta stays
// charged 2%, which is why platformFeeRate travels with the order. It exists
// for test data seeded under an old rate, and it needs
// --experimental-strip-types to read the rate from shared/pricing.ts:
//
//   node --experimental-strip-types scripts/backfill-payouts.mjs --reprice
//   node --experimental-strip-types scripts/backfill-payouts.mjs --reprice --yes
//
// Orders whose money has already moved are never rewritten. A payout that is
// queued, processing or paid has been acted on at the recorded amount, and
// silently changing the number would hide a real overpayment rather than
// surface it. Those are listed for a human instead.

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
const confirmed = process.argv.includes("--yes");
const reprice = process.argv.includes("--reprice");

// Only loaded when asked for: the import needs type stripping, and the plain
// repair path must keep working under a bare `node`.
const { effectiveRate } = reprice
  ? await import("../shared/pricing.ts")
  : { effectiveRate: null };

if (reprice) {
  console.log(
    `RESTATING COMMISSION at today's rate ` +
      `(free ${(effectiveRate("free") * 100).toFixed(2)}%, ` +
      `vendor ${(effectiveRate("vendor") * 100).toFixed(2)}%).`,
  );
  console.log("This rewrites what a sale was charged. Test data only.\n");
}

const round2 = (n) => Math.round(n * 100) / 100;
const SETTLED = ["paid", "shipped", "delivered"];
const MONEY_MOVED = ["queued", "processing", "paid"];

const snap = await db
  .collection("compiledOrders")
  .where("paymentMethod", "==", "billplz")
  .get();

const fixable = [];
const locked = [];

for (const doc of snap.docs) {
  const o = doc.data();
  if (!SETTLED.includes(o.status)) continue;
  if (o.sellerPayout == null) continue;

  // Exactly what the webhook now computes once booking is known.
  const rate = reprice ? effectiveRate(o.sellerPlan) : null;
  const fee = reprice
    ? round2((o.subtotal || 0) * rate)
    : o.platformFee != null
      ? round2(o.platformFee)
      : 0;
  const reimbursement = o.shipmentOrderNo ? 0 : round2(o.shipping || 0);
  const correct = round2((o.subtotal || 0) - fee + reimbursement);
  const stored = round2(o.sellerPayout);
  const feeChanged = reprice && fee !== round2(o.platformFee ?? 0);
  if (correct === stored && !feeChanged) continue;

  const row = {
    id: doc.id,
    ref: doc.ref,
    seller: o.sellerName || o.sellerUid,
    subtotal: o.subtotal || 0,
    shipping: o.shipping || 0,
    fee,
    booked: !!o.shipmentOrderNo,
    stored,
    correct,
    delta: round2(correct - stored),
    payoutStatus: o.payoutStatus ?? "pending",
    newFee: reprice ? fee : null,
    newRate: rate,
    oldFee: round2(o.platformFee ?? 0),
  };
  (MONEY_MOVED.includes(row.payoutStatus) ? locked : fixable).push(row);
}

const show = (rows, title) => {
  if (!rows.length) return;
  console.log(`\n${title}`);
  for (const r of rows) {
    console.log(
      `  ${r.id.slice(0, 8)}  ${String(r.seller).slice(0, 14).padEnd(14)}` +
        ` sub ${r.subtotal.toFixed(2).padStart(8)}` +
        ` ship ${r.shipping.toFixed(2).padStart(6)}` +
        ` ${r.booked ? "booked  " : "unbooked"}` +
        (r.newFee !== null
          ? `  fee ${r.oldFee.toFixed(2)}→${r.newFee.toFixed(2)}`
          : "") +
        `  ${r.stored.toFixed(2).padStart(8)} → ${r.correct.toFixed(2).padStart(8)}` +
        `  (${r.delta > 0 ? "+" : ""}${r.delta.toFixed(2)})`,
    );
  }
};

console.log(`Scanned ${snap.size} Billplz order(s).`);
show(fixable, "Will correct — no money has moved yet:");
show(locked, "NOT touched — payout already queued/sent at the recorded amount:");

const overpaid = round2(locked.reduce((t, r) => t + (r.delta < 0 ? -r.delta : 0), 0));
if (overpaid > 0) {
  console.log(
    `\n  ⚠ RM ${overpaid.toFixed(2)} was queued or paid above the correct figure.` +
      `\n    Reconcile by hand — this script will not rewrite history.`,
  );
}

if (!fixable.length) {
  console.log("\nNothing to correct.");
  process.exit(0);
}

if (!confirmed) {
  console.log(`\nDry run. ${fixable.length} order(s) would be corrected.`);
  console.log("Re-run with --yes to apply.");
  process.exit(0);
}

for (let i = 0; i < fixable.length; i += 400) {
  const batch = db.batch();
  for (const r of fixable.slice(i, i + 400)) {
    batch.update(r.ref, {
      sellerPayout: r.correct,
      // Record the rate alongside the fee so the statement never has to
      // divide it back out of a sen-rounded figure.
      ...(reprice ? { platformFee: r.newFee, platformFeeRate: r.newRate } : {}),
    });
  }
  await batch.commit();
}
const total = round2(fixable.reduce((t, r) => t + r.delta, 0));
console.log(
  `\nDone. ${fixable.length} order(s) corrected` +
    ` (net ${total > 0 ? "+" : ""}RM ${total.toFixed(2)} to sellers).`,
);

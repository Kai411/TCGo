// Dev utility: exercise everything that happens AFTER an auction's clock runs
// out — settlement, the winner's order, FPX bill creation, and the Billplz
// callback that marks it paid — against a running dev server.
//
// Why this exists: there is no scheduler, so an auction only settles when a
// party opens it, and nothing in the app can end an auction early. Testing the
// post-win flow by hand means creating an auction, bidding from a second
// account, waiting for it to end, then paying through the Billplz sandbox —
// whose callback can't reach localhost anyway. This script does all of that in
// one go, with throwaway users, and cleans up after itself.
//
//   node scripts/test-auction-flow.mjs                     # against http://localhost:3000
//   node scripts/test-auction-flow.mjs --base http://localhost:3100
//   node scripts/test-auction-flow.mjs --keep              # leave the test data in place
//
// What it needs: the dev server running with the same .env (Firebase service
// account, Billplz SANDBOX credentials, Delyva credentials). Everything it
// writes is tagged `mock: true` and belongs to users whose uid starts with
// `tcgotest_`, so a --clean of seed-mock-listings.mjs won't touch real data
// and neither will this.
//
// The Billplz callback is SIMULATED: the script signs a callback payload with
// the X-Signature key and posts it to /api/billplz/webhook, exactly as Billplz
// would. The sandbox bill it creates is real but never paid, and is voided in
// cleanup.

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
// The client SDK, for the one thing the Admin SDK can't test: what the
// deployed Firestore rules let a signed-in buyer do.
import { initializeApp as initClientApp, deleteApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";
import { getFirestore as getClientFirestore, doc as clientDoc, updateDoc as clientUpdateDoc } from "firebase/firestore";

// ── Env ──────────────────────────────────────────────────────────────────

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : "http://localhost:3000").replace(/\/+$/, "");
const KEEP = args.includes("--keep");

for (const k of [
  "NUXT_FIREBASE_SERVICE_ACCOUNT",
  "NUXT_PUBLIC_FIREBASE_API_KEY",
  "NUXT_PUBLIC_FIREBASE_DATABASE_URL",
  "NUXT_BILLPLZ_X_SIGNATURE_KEY",
]) {
  if (!env[k]) {
    console.error(`${k} missing from .env`);
    process.exit(1);
  }
}
if (String(env.NUXT_BILLPLZ_SANDBOX).toLowerCase() !== "true") {
  console.error("Refusing to run: NUXT_BILLPLZ_SANDBOX is not true. This script creates bills.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(Buffer.from(env.NUXT_FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8"))),
    databaseURL: env.NUXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}
const db = getFirestore();
const auth = getAuth();
const rtdb = getDatabase();

// ── Reporting ────────────────────────────────────────────────────────────

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  return ok;
};
const blocked = (name, detail) => {
  results.push({ name, ok: null, detail });
  console.log(`  SKIP  ${name}  — ${detail}`);
};
const section = (title) => console.log(`\n${title}`);
const money = (n) => `RM ${Number(n || 0).toFixed(2)}`;

// ── Test users ───────────────────────────────────────────────────────────

const RUN = Date.now().toString(36);
const uids = {
  seller: `tcgotest_seller_${RUN}`,
  winner: `tcgotest_winner_${RUN}`,
  stranger: `tcgotest_stranger_${RUN}`,
};
const tokens = {};
const customTokens = {};

const createUser = async (uid, profile) => {
  await auth.createUser({ uid, email: `${uid}@example.test`, displayName: profile.displayName });
  await db.collection("users").doc(uid).set({
    uid,
    email: `${uid}@example.test`,
    createdAt: Date.now(),
    trustScore: 100,
    mock: true,
    ...profile,
  });
  // A Firebase ID token, the way the browser would hold one: custom token
  // from the Admin SDK, exchanged through the Identity Toolkit REST API.
  const custom = await auth.createCustomToken(uid);
  customTokens[uid] = custom;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NUXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!json.idToken) throw new Error(`Couldn't mint an ID token for ${uid}: ${JSON.stringify(json)}`);
  return json.idToken;
};

// A Firestore write made the way the browser makes it — signed in as one of
// the test users, subject to the DEPLOYED rules. Returns "ok" or the error code.
const clientWriteAs = async (who, collectionName, id, data) => {
  const app = initClientApp(
    {
      apiKey: env.NUXT_PUBLIC_FIREBASE_API_KEY,
      projectId: env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      authDomain: env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    },
    `client-${who}-${Date.now()}`,
  );
  try {
    await signInWithCustomToken(getClientAuth(app), customTokens[uids[who]]);
    await clientUpdateDoc(clientDoc(getClientFirestore(app), collectionName, id), data);
    return "ok";
  } catch (e) {
    return e?.code || e?.message || String(e);
  } finally {
    await deleteApp(app).catch(() => {});
  }
};

// Bill state straight from Billplz sandbox: "due" | "paid" | "deleted" | …
const billplzBillState = async (billId) => {
  const res = await fetch(`https://www.billplz-sandbox.com/api/v3/bills/${billId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${env.NUXT_BILLPLZ_API_KEY}:`).toString("base64")}` },
  });
  if (!res.ok) return `http ${res.status}`;
  return (await res.json())?.state ?? "unknown";
};

// A complete refund form, as the cancel route would insist on for a paid
// order — so a refusal is about the auction, not a missing field.
const REFUND_FORM = {
  reasonCode: "changed_mind",
  reasonNote: "",
  holderName: "Test Winner",
  identityNumber: "900101-14-5678",
  bankCode: "MBBEMYKL",
  bankAccountNumber: "512345678901",
};

const DELIVERY = {
  name: "Test Winner",
  phone: "0123456789",
  address1: "1 Jalan Ujian",
  address2: "",
  postcode: "47300",
  city: "Petaling Jaya",
  state: "sgr",
};

// ── HTTP ─────────────────────────────────────────────────────────────────

const api = async (path, { as, method = "POST", body, form } = {}) => {
  const headers = {};
  if (as) headers.authorization = `Bearer ${tokens[as]}`;
  let payload;
  if (form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
};

const settle = (auctionId, as) => api("/api/auctions/settle", { as, body: { auctionId } });

// Billplz signs a callback as HMAC-SHA256 over `<key><value>` parts, sorted,
// joined with `|` — mirrors verifyBillplzSignature in server/utils/billplz.ts.
const signCallback = (params) => {
  const parts = Object.entries(params).map(([k, v]) => `${k}${v ?? ""}`);
  parts.sort((a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return createHmac("sha256", env.NUXT_BILLPLZ_X_SIGNATURE_KEY).update(parts.join("|")).digest("hex");
};

const postCallback = async (order, overrides = {}) => {
  const params = {
    id: order.billplzBillId,
    collection_id: env.NUXT_BILLPLZ_COLLECTION_ID || "test",
    paid: "true",
    state: "paid",
    amount: String(order.billplzAmountSen),
    paid_amount: String(order.billplzAmountSen),
    due_at: new Date().toISOString().slice(0, 10),
    email: order.buyerEmail || "",
    mobile: "",
    name: order.buyerName || "",
    url: `https://www.billplz-sandbox.com/bills/${order.billplzBillId}`,
    paid_at: new Date().toISOString(),
    transaction_id: `TEST${RUN}`,
    transaction_status: "completed",
    ...overrides,
  };
  params.x_signature = signCallback(params);
  return api("/api/billplz/webhook", { form: params });
};

// ── Fixtures ─────────────────────────────────────────────────────────────

const created = { auctions: [], orders: [], bills: [] };

const createAuction = async ({ winner, price = 25, endedAgoMs = 60_000, status = "active" } = {}) => {
  const now = Date.now();
  const endsAt = now - endedAgoMs;
  const startingPrice = 10;
  const ref = await db.collection("auctions").add({
    title: `TEST auction ${RUN}`,
    description: "Created by scripts/test-auction-flow.mjs",
    cardName: "Pikachu (test)",
    cardSet: "Test Set",
    cardNumber: "001",
    productType: "Ungraded",
    condition: "NM",
    gradingProvider: "",
    grade: "",
    customGradingProvider: "",
    imageUrl: "",
    imageUrls: [],
    shippingWM: 8,
    shippingEM: 12,
    startingPrice,
    currentPrice: winner ? price : startingPrice,
    minIncrement: 1,
    seller: "Test Seller",
    sellerUid: uids.seller,
    endsAt,
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
    isPrivate: false,
    quantity: 1,
    status,
    mock: true,
  });
  const summary = { currentPrice: winner ? price : startingPrice, endsAt, bidCount: winner ? 1 : 0 };
  if (winner) {
    summary.topBidderUid = uids[winner];
    summary.topBidder = "Test Winner";
    await rtdb.ref(`auction_bids/${ref.id}/bids`).push({
      bidder: "Test Winner",
      bidderUid: uids[winner],
      amount: price,
      timestamp: endsAt - 10_000,
      isAutoBid: false,
      triggeredAntiSnipe: false,
    });
    await rtdb.ref(`user_bid_index/${uids[winner]}/${ref.id}`).set({ highestBid: price });
  }
  await rtdb.ref(`auction_summaries/${ref.id}`).set(summary);
  created.auctions.push(ref.id);
  return ref.id;
};

const auctionDoc = async (id) => (await db.collection("auctions").doc(id).get()).data();
const orderDoc = async (id) => {
  const snap = await db.collection("compiledOrders").doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
};
const ordersForAuction = async (auctionId) =>
  (await db.collection("compiledOrders").where("auctionId", "==", auctionId).get()).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
const trackOrder = (id) => id && !created.orders.includes(id) && created.orders.push(id);

// Bring the winner to the point of paying: address on the order (what the
// order page writes), then create-bill. Returns the refreshed order or null.
const createBill = async (orderId) => {
  await db.collection("compiledOrders").doc(orderId).update({ deliveryAddress: DELIVERY });
  const res = await api("/api/billplz/create-bill", { as: "winner", body: { orderId } });
  if (res.status !== 200) return { res, order: null };
  const order = await orderDoc(orderId);
  if (order?.billplzBillId) created.bills.push(order.billplzBillId);
  return { res, order };
};

// ── Scenarios ────────────────────────────────────────────────────────────

const scenarioHappyPath = async () => {
  section("A. Winner pays inside the window");
  const id = await createAuction({ winner: "winner", price: 25 });

  const stranger = await settle(id, "stranger");
  check("a stranger can't settle someone else's auction", stranger.status === 403, `HTTP ${stranger.status}`);

  const first = await settle(id, "winner");
  const orderId = first.json?.orderId;
  trackOrder(orderId);
  check(
    "first settlement creates the winner's order",
    first.status === 200 && first.json?.status === "pending_payment" && !!orderId,
    JSON.stringify(first.json),
  );

  const order = await orderDoc(orderId);
  const a = await auctionDoc(id);
  check("order is pending, for the winner, priced at the winning bid", order?.status === "pending" && order?.buyerUid === uids.winner && order?.subtotal === 25, `${order?.status} ${money(order?.subtotal)}`);
  check("order carries auctionId + paymentDueAt ≈ 48h", order?.auctionId === id && Math.abs(order?.paymentDueAt - Date.now() - 48 * 3600e3) < 60e3);
  check("auction → pending_payment with orderId/winner/winningBid", a?.status === "pending_payment" && a?.orderId === orderId && a?.winnerUid === uids.winner && a?.winningBid === 25, `${a?.status}`);
  check("order.paymentDueAt mirrors auction.paymentDueAt", order?.paymentDueAt === a?.paymentDueAt);

  const again = await settle(id, "seller");
  check("settling again (as the seller) is a no-op with the same order", again.json?.unchanged === true && again.json?.orderId === orderId, JSON.stringify(again.json));
  check("no duplicate orders after two settle calls", (await ordersForAuction(id)).length === 1);

  const noAddr = await api("/api/billplz/create-bill", { as: "winner", body: { orderId } });
  check("create-bill refuses without a delivery address", noAddr.status === 400 && /address/i.test(noAddr.json?.message || ""), `HTTP ${noAddr.status} ${noAddr.json?.message || ""}`);

  const sellerPays = await api("/api/billplz/create-bill", { as: "seller", body: { orderId } });
  check("the seller can't create a bill for the buyer's order", sellerPays.status === 403, `HTTP ${sellerPays.status}`);

  const { res: billRes, order: billed } = await createBill(orderId);
  if (billRes.status !== 200) {
    blocked("create-bill returns a Billplz URL", `HTTP ${billRes.status} ${billRes.json?.message || billRes.text.slice(0, 200)}`);
    blocked("webhook marks the order paid and the auction sold", "no bill to pay");
    return;
  }
  check("create-bill returns a Billplz URL", /^https?:\/\//.test(billRes.json?.url || ""), billRes.json?.url);
  check(
    "a live courier quote replaced the seller's flat shipping",
    billed?.shippingQuoted === true && billed?.shipping > 0 && !!billed?.shippingCourier,
    `${billed?.shippingCourier} ${money(billed?.shipping)} → total ${money(billed?.total)}`,
  );
  check("region derived from the address, total = bid + shipping", billed?.region === "WM" && Math.abs(billed?.total - (25 + billed?.shipping)) < 0.005);
  check("bill amount recorded in sen", billed?.billplzAmountSen === Math.round(billed?.total * 100), `${billed?.billplzAmountSen} sen`);

  const bad = await postCallback(billed, { amount: String(billed.billplzAmountSen - 100), paid_amount: String(billed.billplzAmountSen - 100) });
  const afterBad = await orderDoc(orderId);
  check("webhook refuses to settle an underpaid bill", bad.json?.ignored === "amount mismatch" && afterBad?.status === "pending" && !!afterBad?.paymentAmountMismatch, JSON.stringify(bad.json));
  // Clear the flag so the real callback isn't blocked by the mismatch test.
  await db.collection("compiledOrders").doc(orderId).update({ paymentAmountMismatch: null });

  const forged = await postCallback(billed, { x_signature: "0".repeat(64) });
  check("webhook rejects a bad signature", forged.status === 403, `HTTP ${forged.status}`);

  const hook = await postCallback(billed);
  const paid = await orderDoc(orderId);
  const soldA = await auctionDoc(id);
  check("webhook accepts the signed callback", hook.status === 200 && hook.json?.ok === true, JSON.stringify(hook.json));
  check("order → paid with payout fields", paid?.status === "paid" && !!paid?.paidAt && typeof paid?.sellerPayout === "number" && paid?.payoutStatus === "pending", `payout ${money(paid?.sellerPayout)} fee ${money(paid?.platformFee)}`);
  check("auction → sold", soldA?.status === "sold" && !!soldA?.soldAt, soldA?.status);

  const bells = await db.collection("notifications").where("userUid", "in", [uids.seller, uids.winner]).get();
  const kinds = bells.docs.map((d) => `${d.data().userUid === uids.seller ? "seller" : "buyer"}:${d.data().kind}`);
  check("both parties were notified", kinds.some((k) => k.startsWith("seller:")) && kinds.some((k) => k.startsWith("buyer:")), kinds.join(", "));

  const replay = await postCallback(billed);
  check("a replayed callback is ignored", replay.json?.ignored === "status paid", JSON.stringify(replay.json));

  const cancelPaid = await api("/api/orders/cancel", { as: "winner", body: { orderId, refund: REFUND_FORM } });
  const afterCancel = await orderDoc(orderId);
  check(
    "the 30-minute cancel-and-refund window doesn't apply to an auction win",
    cancelPaid.status === 409 && /auction/i.test(cancelPaid.json?.message || "") && afterCancel?.status === "paid",
    `HTTP ${cancelPaid.status} ${cancelPaid.json?.message || ""}`,
  );

  const settled = await settle(id, "winner");
  check("settle after payment reports sold, unchanged", settled.json?.status === "sold" && settled.json?.unchanged === true, JSON.stringify(settled.json));
};

const scenarioLapsed = async () => {
  section("B. Winner never pays: window lapses");
  const id = await createAuction({ winner: "winner", price: 30 });
  const first = await settle(id, "seller");
  const orderId = first.json?.orderId;
  trackOrder(orderId);

  const early = await settle(id, "seller");
  check("inside the window nothing changes", early.json?.status === "pending_payment" && early.json?.unchanged === true);

  // Fast-forward: the deadline has passed.
  await db.collection("auctions").doc(id).update({ paymentDueAt: Date.now() - 1000 });
  const late = await settle(id, "seller");
  const order = await orderDoc(orderId);
  const a = await auctionDoc(id);
  check("after the deadline the auction is voided", late.json?.status === "expired" && a?.status === "expired", JSON.stringify(late.json));
  check("…and the unpaid order is cancelled with a reason", order?.status === "cancelled" && /window lapsed/i.test(order?.cancelReason || ""), `${order?.status}: ${order?.cancelReason}`);

  const again = await settle(id, "winner");
  check("expired is terminal", again.json?.status === "expired" && again.json?.unchanged === true);
};

const scenarioNoBids = async () => {
  section("C. Ended with no bids");
  const id = await createAuction({ winner: null });
  const res = await settle(id, "seller");
  const a = await auctionDoc(id);
  check("settles as expired with no order", res.json?.status === "expired" && res.json?.orderId === null && a?.status === "expired", JSON.stringify(res.json));
};

const scenarioBuyerCancelled = async () => {
  section("D. Nobody but staff can cancel an auction order");
  const id = await createAuction({ winner: "winner", price: 40 });
  const first = await settle(id, "winner");
  const orderId = first.json?.orderId;
  trackOrder(orderId);

  // The write the order page's "Cancel order" button used to make, through
  // the client SDK so the deployed rules are what decides.
  const asBuyer = await clientWriteAs("winner", "compiledOrders", orderId, { status: "cancelled", cancelledAt: Date.now(), cancelReason: "" });
  check(
    "rules refuse the buyer cancelling a pending auction order",
    asBuyer === "permission-denied",
    asBuyer === "ok" ? "the write went through — deploy the rules: firebase deploy --only firestore:rules" : asBuyer,
  );
  const asBuyerSneaky = await clientWriteAs("winner", "compiledOrders", orderId, { auctionId: null });
  check("rules refuse the buyer detaching the order from its auction", asBuyerSneaky === "permission-denied", asBuyerSneaky);
  const asBuyerAddress = await clientWriteAs("winner", "compiledOrders", orderId, { deliveryAddress: DELIVERY });
  check("…but the buyer can still set their delivery address", asBuyerAddress === "ok", asBuyerAddress);
  const asSeller = await clientWriteAs("seller", "compiledOrders", orderId, { status: "cancelled", cancelledAt: Date.now() });
  check("rules refuse the seller cancelling an auction order", asSeller === "permission-denied", asSeller);
  // If the rules aren't deployed yet the writes above may have landed; put
  // the order back so the rest of the scenario still tests settlement.
  await db.collection("compiledOrders").doc(orderId).update({ status: "pending", auctionId: id });

  const cancelPending = await api("/api/orders/cancel", { as: "winner", body: { orderId, refund: REFUND_FORM } });
  check("the cancel route refuses an unpaid auction order too", cancelPending.status === 409 && /auction/i.test(cancelPending.json?.message || ""), `HTTP ${cancelPending.status} ${cancelPending.json?.message || ""}`);

  // Staff void the order by hand (the Admin SDK bypasses rules). The auction
  // must follow it to expired — straight away, and never to sold.
  await db.collection("compiledOrders").doc(orderId).update({ status: "cancelled", cancelledAt: Date.now(), cancelReason: "Cancelled by staff" });
  const mid = await settle(id, "seller");
  const a = await auctionDoc(id);
  check("a staff-cancelled order voids the auction without waiting for the deadline", mid.json?.status === "expired" && a?.status === "expired", `settle says ${mid.json?.status}, auction ${a?.status}`);

  await db.collection("auctions").doc(id).update({ paymentDueAt: Date.now() - 1000 });
  const late = await settle(id, "seller");
  const a2 = await auctionDoc(id);
  check("…and never becomes a sale", a2?.status !== "sold" && late.json?.unchanged === true, `auction ${a2?.status}, settle said ${late.json?.status}`);
};

const scenarioConcurrentSettle = async () => {
  section("E. Seller and winner open the ended auction at the same moment");
  const id = await createAuction({ winner: "winner", price: 50 });
  const [x, y] = await Promise.all([settle(id, "winner"), settle(id, "seller")]);
  const orders = await ordersForAuction(id);
  orders.forEach((o) => trackOrder(o.id));
  const a = await auctionDoc(id);
  check("both callers succeed", x.status === 200 && y.status === 200, `${x.status}/${y.status}`);
  check("exactly one order exists for the auction", orders.length === 1, `${orders.length} orders: ${orders.map((o) => o.id).join(", ")}`);
  check("both callers were told the same orderId", x.json?.orderId === y.json?.orderId && x.json?.orderId === a?.orderId, `${x.json?.orderId} vs ${y.json?.orderId}, auction says ${a?.orderId}`);
};

const scenarioPaidAfterLapse = async () => {
  section("F. Winner pays on a bill they opened before the window closed");
  const id = await createAuction({ winner: "winner", price: 35 });
  const first = await settle(id, "winner");
  const orderId = first.json?.orderId;
  trackOrder(orderId);
  const { res: billRes, order: billed } = await createBill(orderId);
  if (billRes.status !== 200) {
    blocked("payment after the window lapsed", `create-bill HTTP ${billRes.status} ${billRes.json?.message || ""}`);
    return;
  }
  // The bank page is open in the winner's browser; meanwhile the seller's
  // dashboard enforces the deadline.
  await db.collection("auctions").doc(id).update({ paymentDueAt: Date.now() - 1000 });
  const late = await settle(id, "seller");
  const voided = await orderDoc(orderId);
  check("order voided by the deadline", late.json?.status === "expired" && voided?.status === "cancelled", `${late.json?.status} / ${voided?.status}`);

  // The bill goes with it, so the bank page can no longer collect.
  const state = await billplzBillState(billed.billplzBillId);
  check("the Billplz bill was voided before the order was cancelled", state === "deleted", `bill state: ${state}`);

  // Belt and braces: a callback that arrives for it anyway must leave a
  // trail for staff, not vanish.
  const hook = await postCallback(billed);
  const after = await orderDoc(orderId);
  check(
    "a payment reported against a voided order is recorded for a manual refund",
    hook.json?.ignored === "status cancelled" && after?.stalePayment?.billId === billed.billplzBillId,
    `webhook: ${JSON.stringify(hook.json)}; stalePayment: ${JSON.stringify(after?.stalePayment ?? null)}`,
  );
};

// ── Cleanup ──────────────────────────────────────────────────────────────

const cleanup = async () => {
  section(KEEP ? "Keeping test data (--keep)" : "Cleaning up");
  if (KEEP) {
    console.log(`  users: ${Object.values(uids).join(", ")}`);
    console.log(`  auctions: ${created.auctions.join(", ")}`);
    console.log(`  orders: ${created.orders.join(", ")}`);
    return;
  }
  const billplzBase = "https://www.billplz-sandbox.com/api";
  const authHeader = `Basic ${Buffer.from(`${env.NUXT_BILLPLZ_API_KEY}:`).toString("base64")}`;
  for (const billId of created.bills) {
    await fetch(`${billplzBase}/v3/bills/${billId}`, { method: "DELETE", headers: { Authorization: authHeader } }).catch(() => {});
  }
  const batch = db.batch();
  for (const id of created.auctions) batch.delete(db.collection("auctions").doc(id));
  for (const id of created.orders) batch.delete(db.collection("compiledOrders").doc(id));
  const testUids = Object.values(uids);
  for (const coll of ["notifications"]) {
    const snap = await db.collection(coll).where("userUid", "in", testUids).get();
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  for (const uid of testUids) batch.delete(db.collection("users").doc(uid));
  await batch.commit();
  await Promise.all([
    ...created.auctions.flatMap((id) => [rtdb.ref(`auction_summaries/${id}`).remove(), rtdb.ref(`auction_bids/${id}`).remove()]),
    ...testUids.map((uid) => rtdb.ref(`user_bid_index/${uid}`).remove()),
  ]);
  await auth.deleteUsers(testUids);
  console.log(`  removed ${created.auctions.length} auctions, ${created.orders.length} orders, ${created.bills.length} bills, ${testUids.length} users`);
};

// ── Run ──────────────────────────────────────────────────────────────────

console.log(`Auction post-win flow against ${BASE} (run ${RUN})`);
const ping = await fetch(`${BASE}/api/fx/usd-myr`).catch(() => null);
if (!ping) {
  console.error(`Dev server not reachable at ${BASE}. Start it (npm run dev) or pass --base.`);
  process.exit(1);
}

try {
  section("Setup");
  tokens.seller = await createUser(uids.seller, {
    displayName: "Test Seller",
    customName: "Test Seller",
    phone: "0111111111",
    kycStatus: "verified",
    pickupAddress1: "2 Jalan Penjual",
    pickupCity: "Kuala Lumpur",
    pickupPostcode: "50450",
    pickupState: "kul",
    handoverPreference: "dropoff",
    bankCode: "MBBEMYKL",
    bankAccountNumber: "1234567890",
    bankAccountHolder: "Test Seller",
  });
  tokens.winner = await createUser(uids.winner, { displayName: "Test Winner", customName: "Test Winner", phone: "0123456789" });
  tokens.stranger = await createUser(uids.stranger, { displayName: "Test Stranger", phone: "0100000000" });
  console.log(`  users ready: ${Object.values(uids).join(", ")}`);

  await scenarioHappyPath();
  await scenarioLapsed();
  await scenarioNoBids();
  await scenarioBuyerCancelled();
  await scenarioConcurrentSettle();
  await scenarioPaidAfterLapse();
} catch (e) {
  console.error("\nAborted:", e?.stack || e);
  results.push({ name: "run completed", ok: false, detail: String(e?.message || e) });
} finally {
  await cleanup().catch((e) => console.error("cleanup failed:", e?.message || e));
}

const passed = results.filter((r) => r.ok === true).length;
const failed = results.filter((r) => r.ok === false);
const skipped = results.filter((r) => r.ok === null).length;
console.log(`\n${passed} passed, ${failed.length} failed, ${skipped} skipped`);
for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
process.exit(failed.length ? 1 : 0);

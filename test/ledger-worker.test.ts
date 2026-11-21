// The ledger Worker (workers/ledger), run against the real migration on
// node:sqlite. D1 is SQLite, and a D1 batch is one transaction, which the shim
// below reproduces with BEGIN / COMMIT / ROLLBACK.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { handle, type Env } from "~/workers/ledger/src/index";
import { billplzSignature, signRequest } from "~/workers/ledger/src/crypto";
import type { D1Like, D1StatementLike } from "~/workers/ledger/src/d1";

const MIGRATION = readFileSync(new URL("../workers/ledger/migrations/0001_init.sql", import.meta.url), "utf8");
const SECRET = "s".repeat(64);
const BILLPLZ_KEY = "S-test-billplz-key";

const d1 = (sqlite: DatabaseSync): D1Like => {
  const stmt = (sql: string, params: unknown[] = []): D1StatementLike & { exec(): void } => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    first: async <T,>() => (sqlite.prepare(sql).get(...(params as any[])) as T) ?? null,
    all: async <T,>() => ({ results: sqlite.prepare(sql).all(...(params as any[])) as T[] }),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
    exec: () => void sqlite.prepare(sql).run(...(params as any[])),
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        for (const s of statements) (s as any).exec();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
      return [];
    },
  };
};

let sqlite: DatabaseSync;
let env: Env;
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(MIGRATION);
  env = { DB: d1(sqlite), LEDGER_WORKER_SECRET: SECRET, BILLPLZ_X_SIGNATURE_KEY: BILLPLZ_KEY };
});

const NOW = 1_763_700_000_000;

const callback = async (billId: string, paidAt = "2026-11-21 16:00:00 +0800") => {
  const params: Record<string, string> = {
    id: billId, collection_id: "col1", paid: "true", state: "paid",
    amount: "5800", paid_amount: "5800", paid_at: paidAt,
  };
  return { ...params, x_signature: await billplzSignature(params, BILLPLZ_KEY) };
};

const order = (firestoreId: string, listingId = "card-1", buyerUid = "buyer-1") => ({
  firestoreId, source: "cart", buyerUid, sellerUid: "seller-1",
  items: [{ listingId, cardName: "Pikachu", unitPriceSen: 5000 }],
  subtotalSen: 5000, shippingSen: 800, totalSen: 5800, deliveryAddress: { postcode: "50000" },
  feeRateBp: 200, platformFeeSen: 100, sstSen: 0, sellerNetSen: 4900,
});

const call = async (path: string, body: unknown, opts: { secret?: string; ts?: number } = {}) => {
  const raw = JSON.stringify(body);
  const ts = opts.ts ?? NOW;
  const sig = await signRequest(opts.secret ?? SECRET, ts, raw);
  const res = await handle(
    new Request(`https://ledger.test${path}`, {
      method: "POST",
      body: raw,
      headers: { "x-tcgo-timestamp": String(ts), "x-tcgo-signature": sig },
    }),
    env,
    NOW,
  );
  return { status: res.status, body: (await res.json()) as any };
};

const balances = () =>
  Object.fromEntries(
    (sqlite.prepare("SELECT code, SUM(balance_sen) AS b FROM account_balances GROUP BY code").all() as any[]).map(
      (r) => [r.code, r.b],
    ),
  );

describe("ledger worker: request signing", () => {
  it("refuses unsigned, wrongly signed and stale calls", async () => {
    const res = await handle(new Request("https://ledger.test/v1/summary", { method: "POST", body: "{}" }), env, NOW);
    assert.equal(res.status, 401);
    assert.equal((await call("/v1/summary", { fromMs: 0, toMs: 1 }, { secret: "x".repeat(64) })).status, 401);
    assert.equal((await call("/v1/summary", { fromMs: 0, toMs: 1 }, { ts: NOW - 61_000 })).status, 401);
    assert.equal((await call("/v1/summary", { fromMs: NOW - 1000, toMs: NOW })).status, 200);
  });

  it("refuses a callback Billplz didn't sign, even with a valid Netlify signature", async () => {
    const cb = await callback("bill-1");
    const forged = { ...cb, amount: "1", paid_amount: "1" };
    const r = await call("/v1/shadow-payment", { callback: forged, paidSen: 1, order: order("ord-1") });
    assert.equal(r.status, 403);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM orders").get()!.n, 0);
  });
});

describe("ledger worker: shadowing a payment", () => {
  it("records the order, the payment and a balanced ledger posting", async () => {
    const r = await call("/v1/shadow-payment", { callback: await callback("bill-1"), paidSen: 5800, order: order("ord-1") });
    assert.equal(r.status, 200);
    assert.equal(r.body.outcome, "recorded");
    assert.deepEqual(r.body.conflicts, []);
    const o = sqlite.prepare("SELECT status, total_sen FROM orders WHERE legacy_firestore_id = 'ord-1'").get() as any;
    assert.deepEqual({ ...o }, { status: "paid", total_sen: 5800 });
    assert.deepEqual(balances(), {
      "asset:billplz_receivable": 5800,
      "liability:buyer_protection_held": -5800,
    });
  });

  it("is idempotent when Billplz retries the callback", async () => {
    const body = { callback: await callback("bill-1"), paidSen: 5800, order: order("ord-1") };
    await call("/v1/shadow-payment", body);
    const again = await call("/v1/shadow-payment", body);
    assert.equal(again.body.outcome, "already_recorded");
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get()!.n, 2);
  });

  it("flags a card sold to two orders instead of hiding it", async () => {
    await call("/v1/shadow-payment", { callback: await callback("bill-1"), paidSen: 5800, order: order("ord-1") });
    const r = await call("/v1/shadow-payment", {
      callback: await callback("bill-2"), paidSen: 5800, order: order("ord-2", "card-1", "buyer-2"),
    });
    assert.equal(r.body.outcome, "recorded");
    assert.equal(r.body.conflicts.length, 1);
    assert.equal(r.body.conflicts[0].listingId, "card-1");
    const s = await call("/v1/summary", { fromMs: NOW - 1000, toMs: NOW });
    assert.equal(s.body.orders.length, 2);
    assert.equal(s.body.conflicts.length, 1);
  });

  it("books a second paid bill on the same order as a refund owed", async () => {
    await call("/v1/shadow-payment", { callback: await callback("bill-1"), paidSen: 5800, order: order("ord-1") });
    const r = await call("/v1/shadow-payment", { callback: await callback("bill-1b"), paidSen: 5800, order: order("ord-1") });
    assert.equal(r.body.outcome, "recorded_duplicate_payment");
    assert.equal(balances()["liability:refund_payable"], -5800);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM refunds WHERE reason = 'duplicate_payment'").get()!.n, 1);
  });

  it("rejects input the schema would refuse", async () => {
    const bad = { ...order("ord-1"), totalSen: 0 };
    const r = await call("/v1/shadow-payment", { callback: await callback("bill-1"), paidSen: 5800, order: bad });
    assert.equal(r.status, 400);
  });
});

describe("ledger schema rules", () => {
  it("keeps the ledger append-only", async () => {
    await call("/v1/shadow-payment", { callback: await callback("bill-1"), paidSen: 5800, order: order("ord-1") });
    assert.throws(() => sqlite.exec("UPDATE ledger_entries SET amount_sen = 1"), /ledger_append_only/);
    assert.throws(() => sqlite.exec("DELETE FROM ledger_transactions"), /ledger_append_only/);
  });

  it("refuses an unbalanced posting and illegal status moves", async () => {
    await call("/v1/shadow-payment", { callback: await callback("bill-1"), paidSen: 5800, order: order("ord-1") });
    const db = env.DB;
    await assert.rejects(
      db.batch([
        db.prepare("INSERT INTO ledger_transactions (id, kind, source_key, occurred_at) VALUES ('t', 'x', 'x:1', 1)"),
        db.prepare("INSERT INTO ledger_entries (txn_id, account_id, amount_sen, created_at) VALUES ('t', 1, 100, 1)"),
        db.prepare("INSERT INTO assert_balanced SELECT COALESCE(SUM(amount_sen), 0) = 0 FROM ledger_entries WHERE txn_id = 't'"),
      ]),
      /ledger_unbalanced/,
    );
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM ledger_transactions WHERE id = 't'").get()!.n, 0);
    assert.throws(() => sqlite.exec("UPDATE orders SET status = 'awaiting_payment'"), /illegal_order_transition/);
    assert.throws(() => sqlite.exec("UPDATE orders SET shipping_sen = 0"), /order_amounts_frozen/);
  });
});

describe("Netlify side of the ledger shadow", async () => {
  const { buildShadowOrder, signLedgerRequest, toSen } = await import("~/server/utils/ledger-shadow");

  it("signs requests exactly as the Worker checks them", async () => {
    const body = JSON.stringify({ a: 1 });
    assert.equal(signLedgerRequest(SECRET, NOW, body), await signRequest(SECRET, NOW, body));
  });

  it("converts ringgit floats to sen once, without drift", () => {
    assert.equal(toSen(0.1 + 0.2), 30);
    assert.equal(toSen(74.45), 7445);
    assert.equal(toSen(undefined), 0);
  });

  it("builds a cart order the Worker accepts", async () => {
    const fees = { platformFee: 1.4, feeRate: 0.02, sstAmount: 0, sellerPayout: 68.6 };
    const shadow = buildShadowOrder("ord-9", {
      buyerUid: "b", sellerUid: "s", subtotal: 70, shipping: 8.5, total: 78.5,
      items: [{ cardId: "c9", cardName: "Charizard", price: 70 }],
    }, fees);
    assert.equal(shadow.feeRateBp, 200);
    assert.equal(shadow.totalSen, 7850);
    const r = await call("/v1/shadow-payment", {
      callback: { ...(await callback("bill-9")) }, paidSen: 7850, order: shadow,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });

  it("uses the auction as the item for auction wins", () => {
    const shadow = buildShadowOrder("ord-a", {
      auctionId: "auc1", buyerUid: "b", sellerUid: "s", subtotal: 120, shipping: 10, total: 130, items: [],
    }, { platformFee: 2.4, feeRate: 0.02, sstAmount: 0, sellerPayout: 117.6 });
    assert.equal(shadow.source, "auction");
    assert.deepEqual(shadow.items, [{ listingId: "auction:auc1", cardName: "Auction", unitPriceSen: 12000 }]);
  });
});

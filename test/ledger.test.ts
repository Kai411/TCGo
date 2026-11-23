// The ledger (server/ledger), run against the real migration on two engines:
//  - libSQL, the engine Turso runs, through the same adapter production uses
//    (server/ledger/db.ts), on a temporary file;
//  - node:sqlite, with a shim that wraps a batch in BEGIN / COMMIT / ROLLBACK,
//    which also lets the schema-rule tests poke the tables directly.

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";

import { fromLibsql, type D1Like, type D1StatementLike } from "~/server/ledger/db";
import { recordBillplzPayment, summary, LedgerInputError } from "~/server/ledger/shadow";

const MIGRATION = readFileSync(new URL("../server/ledger/migrations/0001_init.sql", import.meta.url), "utf8");
const NOW = 1_763_700_000_000;

const sqliteShim = (sqlite: DatabaseSync): D1Like => {
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

const tmp = mkdtempSync(join(tmpdir(), "tcgo-ledger-"));
after(() => rmSync(tmp, { recursive: true, force: true }));
let fileNo = 0;

const engines: Record<string, () => Promise<D1Like>> = {
  libsql: async () => {
    const client = createClient({ url: `file:${join(tmp, `l${fileNo++}.db`)}` });
    await client.executeMultiple(MIGRATION);
    return fromLibsql(client as any);
  },
  "node:sqlite": async () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(MIGRATION);
    return sqliteShim(sqlite);
  },
};

const callback = (billId: string, paidAt = "2026-11-21 16:00:00 +0800") => ({
  id: billId, collection_id: "col1", paid: "true", state: "paid",
  amount: "5800", paid_amount: "5800", paid_at: paidAt, x_signature: "a".repeat(64),
});

const order = (firestoreId: string, listingId = "card-1", buyerUid = "buyer-1") => ({
  firestoreId, source: "cart" as const, buyerUid, sellerUid: "seller-1",
  items: [{ listingId, cardName: "Pikachu", unitPriceSen: 5000 }],
  subtotalSen: 5000, shippingSen: 800, totalSen: 5800, deliveryAddress: { postcode: "50000" },
  feeRateBp: 200, platformFeeSen: 100, sstSen: 0, sellerNetSen: 4900,
});

for (const [engine, open] of Object.entries(engines)) {
  describe(`ledger on ${engine}`, () => {
    let db: D1Like;
    beforeEach(async () => {
      db = await open();
    });

    const count = async (sql: string) => Number((await db.prepare(sql).first<{ n: number }>())!.n);
    const balances = async () =>
      Object.fromEntries(
        (await db.prepare("SELECT code, SUM(balance_sen) AS b FROM account_balances GROUP BY code").all<any>()).results
          .filter((r) => Number(r.b) !== 0)
          .map((r) => [r.code, Number(r.b)]),
      );
    const pay = (billId: string, o = order("ord-1"), paidSen = 5800) =>
      recordBillplzPayment(db, { callback: callback(billId), paidSen, order: o }, NOW);

    it("records the order, the payment and a balanced ledger posting", async () => {
      const r = await pay("bill-1");
      assert.equal(r.outcome, "recorded");
      assert.deepEqual(r.conflicts, []);
      const o = await db.prepare("SELECT status, total_sen FROM orders WHERE legacy_firestore_id = 'ord-1'").first<any>();
      assert.deepEqual({ status: o.status, total_sen: Number(o.total_sen) }, { status: "paid", total_sen: 5800 });
      assert.deepEqual(await balances(), {
        "asset:billplz_receivable": 5800,
        "liability:buyer_protection_held": -5800,
      });
    });

    it("is idempotent when Billplz retries the callback", async () => {
      await pay("bill-1");
      assert.equal((await pay("bill-1")).outcome, "already_recorded");
      assert.equal(await count("SELECT COUNT(*) AS n FROM ledger_entries"), 2);
    });

    it("flags a card sold to two orders instead of hiding it", async () => {
      await pay("bill-1");
      const r = await pay("bill-2", order("ord-2", "card-1", "buyer-2"));
      assert.equal(r.outcome, "recorded");
      assert.equal(r.conflicts.length, 1);
      assert.equal(r.conflicts[0].listingId, "card-1");
      const s = await summary(db, NOW - 1000, NOW);
      assert.equal(s.orders.length, 2);
      assert.equal(s.conflicts.length, 1);
    });

    it("books a second paid bill on the same order as a refund owed", async () => {
      await pay("bill-1");
      assert.equal((await pay("bill-1b")).outcome, "recorded_duplicate_payment");
      assert.equal((await balances())["liability:refund_payable"], -5800);
      assert.equal(await count("SELECT COUNT(*) AS n FROM refunds WHERE reason = 'duplicate_payment'"), 1);
    });

    it("refuses unpaid callbacks and input the schema would refuse", async () => {
      await assert.rejects(
        recordBillplzPayment(db, { callback: { ...callback("bill-1"), paid: "false" }, paidSen: 5800, order: order("ord-1") }, NOW),
        LedgerInputError,
      );
      await assert.rejects(pay("bill-1", { ...order("ord-1"), totalSen: 0 }), LedgerInputError);
      assert.equal(await count("SELECT COUNT(*) AS n FROM orders"), 0);
    });

    it("keeps the raw callback for audit, without the signature", async () => {
      await pay("bill-1");
      const ev = await db.prepare("SELECT payload FROM provider_events").first<{ payload: string }>();
      const payload = JSON.parse(ev!.payload);
      assert.equal(payload.id, "bill-1");
      assert.equal("x_signature" in payload, false);
    });

    it("rolls back a whole batch when a posting doesn't balance", async () => {
      await assert.rejects(
        db.batch([
          db.prepare("INSERT INTO ledger_transactions (id, kind, source_key, occurred_at) VALUES ('t', 'x', 'x:1', 1)"),
          db.prepare("INSERT INTO ledger_entries (txn_id, account_id, amount_sen, created_at) VALUES ('t', 1, 100, 1)"),
          db.prepare("INSERT INTO assert_balanced SELECT COALESCE(SUM(amount_sen), 0) = 0 FROM ledger_entries WHERE txn_id = 't'"),
        ]),
        /ledger_unbalanced/,
      );
      assert.equal(await count("SELECT COUNT(*) AS n FROM ledger_transactions WHERE id = 't'"), 0);
    });

    it("keeps the ledger append-only and order amounts frozen", async () => {
      await pay("bill-1");
      await assert.rejects(db.prepare("UPDATE ledger_entries SET amount_sen = 1").run(), /ledger_append_only/);
      await assert.rejects(db.prepare("DELETE FROM ledger_transactions").run(), /ledger_append_only/);
      await assert.rejects(db.prepare("UPDATE orders SET status = 'awaiting_payment'").run(), /illegal_order_transition/);
      await assert.rejects(db.prepare("UPDATE orders SET shipping_sen = 0").run(), /order_amounts_frozen/);
    });
  });
}

describe("Netlify side of the ledger shadow", async () => {
  const { buildShadowOrder, toSen } = await import("~/server/utils/ledger-shadow");

  it("converts ringgit floats to sen once, without drift", () => {
    assert.equal(toSen(0.1 + 0.2), 30);
    assert.equal(toSen(74.45), 7445);
    assert.equal(toSen(undefined), 0);
  });

  it("builds a cart order the ledger accepts", async () => {
    const fees = { platformFee: 1.4, feeRate: 0.02, sstAmount: 0, sellerPayout: 68.6 };
    const shadow = buildShadowOrder("ord-9", {
      buyerUid: "b", sellerUid: "s", subtotal: 70, shipping: 8.5, total: 78.5,
      items: [{ cardId: "c9", cardName: "Charizard", price: 70 }],
    }, fees);
    assert.equal(shadow.feeRateBp, 200);
    assert.equal(shadow.totalSen, 7850);
    const db = await engines.libsql();
    const r = await recordBillplzPayment(db, { callback: callback("bill-9"), paidSen: 7850, order: shadow as any }, NOW);
    assert.equal(r.outcome, "recorded");
  });

  it("uses the auction as the item for auction wins", () => {
    const shadow = buildShadowOrder("ord-a", {
      auctionId: "auc1", buyerUid: "b", sellerUid: "s", subtotal: 120, shipping: 10, total: 130, items: [],
    }, { platformFee: 2.4, feeRate: 0.02, sstAmount: 0, sellerPayout: 117.6 });
    assert.equal(shadow.source, "auction");
    assert.deepEqual(shadow.items, [{ listingId: "auction:auc1", cardName: "Auction", unitPriceSen: 12000 }]);
  });
});

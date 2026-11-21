-- TCGo ledger, Cloudflare D1 (SQLite). Migration 0001.
-- Design: https://claude.ai/artifact/4Yk63zjf7reDKwEK2kMAdV (section 0). Same tables and rules as commerce-schema.sql (Postgres);
-- what changes:
--   * no schemas, enums, plpgsql, deferred triggers or row locks in SQLite.
--   * enums become CHECK (... IN (...)).
--   * timestamps are integer epoch milliseconds (same as Firestore today).
--   * ids are text UUIDs made by the Worker (crypto.randomUUID()).
--   * the money functions (place_order, record_payment, ...) move into the
--     Worker as db.batch() calls. A batch is one SQL transaction: if any
--     statement fails, the whole batch rolls back.
--   * "raise exception" becomes an INSERT into an assert_* view whose trigger
--     aborts the batch when the condition is false. That is how a batch checks
--     a card is still free, an order is still payable, or a ledger
--     transaction balances, inside the same transaction that writes.
--   * D1 runs one writer per database, so batches never interleave: there is
--     no lost-update race to lock against, only stale reads between calls,
--     which the asserts catch.


-- ── Assertions (abort the batch when ok is not 1) ──────────────────
-- One view per reason, with literal messages, so the Worker can map the
-- error to a clear answer ("This card has just been sold").
CREATE VIEW assert_listing_free AS SELECT NULL AS ok;
CREATE TRIGGER assert_listing_free_t INSTEAD OF INSERT ON assert_listing_free
  BEGIN SELECT RAISE(ABORT, 'listing_unavailable') WHERE NEW.ok IS NOT 1; END;

CREATE VIEW assert_order_state AS SELECT NULL AS ok;
CREATE TRIGGER assert_order_state_t INSTEAD OF INSERT ON assert_order_state
  BEGIN SELECT RAISE(ABORT, 'order_state_changed') WHERE NEW.ok IS NOT 1; END;

CREATE VIEW assert_balanced AS SELECT NULL AS ok;
CREATE TRIGGER assert_balanced_t INSTEAD OF INSERT ON assert_balanced
  BEGIN SELECT RAISE(ABORT, 'ledger_unbalanced') WHERE NEW.ok IS NOT 1; END;

-- ── Orders ──────────────────────────────────────────────────────────
CREATE TABLE orders (
  id                  TEXT PRIMARY KEY,
  legacy_firestore_id TEXT UNIQUE,
  source              TEXT NOT NULL CHECK (source IN ('cart','auction','pos','legacy')),
  auction_id          TEXT,
  buyer_uid           TEXT NOT NULL,
  seller_uid          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
                        'awaiting_payment','paid','shipped','delivered','disputed',
                        'completed','cancelled','refunded','partially_refunded')),
  subtotal_sen        INTEGER NOT NULL CHECK (subtotal_sen >= 0),
  shipping_sen        INTEGER NOT NULL DEFAULT 0 CHECK (shipping_sen >= 0),
  join_fee_sen        INTEGER NOT NULL DEFAULT 0 CHECK (join_fee_sen >= 0),
  discount_sen        INTEGER NOT NULL DEFAULT 0 CHECK (discount_sen >= 0),
  total_sen           INTEGER GENERATED ALWAYS AS (subtotal_sen + shipping_sen + join_fee_sen - discount_sen) STORED,
  fee_rate_bp         INTEGER CHECK (fee_rate_bp BETWEEN 0 AND 10000),
  platform_fee_sen    INTEGER CHECK (platform_fee_sen >= 0),
  sst_sen             INTEGER CHECK (sst_sen >= 0),
  seller_net_sen      INTEGER CHECK (seller_net_sen >= 0),
  shipping_quote      TEXT,                 -- JSON
  delivery_address    TEXT NOT NULL,        -- JSON snapshot
  shipment_id         TEXT REFERENCES shipments(id),
  hold_expires_at     INTEGER,
  paid_at INTEGER, shipped_at INTEGER, delivered_at INTEGER, payable_at INTEGER,
  completed_at INTEGER, cancelled_at INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  CHECK (total_sen > 0),
  CHECK (source <> 'auction' OR auction_id IS NOT NULL),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL),
  CHECK (status <> 'completed' OR (paid_at IS NOT NULL AND seller_net_sen IS NOT NULL))
);
CREATE INDEX orders_buyer_idx   ON orders (buyer_uid, created_at DESC);
CREATE INDEX orders_seller_idx  ON orders (seller_uid, status, created_at DESC);
CREATE INDEX orders_payable_idx ON orders (payable_at) WHERE status = 'delivered';

CREATE TABLE order_transitions (
  from_status TEXT NOT NULL, to_status TEXT NOT NULL, PRIMARY KEY (from_status, to_status)
);
INSERT INTO order_transitions VALUES
  ('awaiting_payment','paid'), ('awaiting_payment','cancelled'),
  ('paid','shipped'), ('paid','refunded'), ('paid','disputed'),
  ('shipped','delivered'), ('shipped','disputed'),
  ('delivered','completed'), ('delivered','disputed'),
  ('disputed','completed'), ('disputed','refunded'), ('disputed','partially_refunded');

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_status TEXT, to_status TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'unknown', note TEXT,
  at INTEGER NOT NULL
);

CREATE TRIGGER orders_transition BEFORE UPDATE OF status ON orders
  WHEN NEW.status IS NOT OLD.status
   AND NOT EXISTS (SELECT 1 FROM order_transitions WHERE from_status = OLD.status AND to_status = NEW.status)
  BEGIN SELECT RAISE(ABORT, 'illegal_order_transition'); END;
CREATE TRIGGER orders_history AFTER UPDATE OF status ON orders
  WHEN NEW.status IS NOT OLD.status
  BEGIN
    INSERT INTO order_events (order_id, from_status, to_status, at)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.updated_at);
  END;
CREATE TRIGGER orders_frozen BEFORE UPDATE OF subtotal_sen, shipping_sen, join_fee_sen, discount_sen ON orders
  WHEN OLD.status <> 'awaiting_payment'
  BEGIN SELECT RAISE(ABORT, 'order_amounts_frozen'); END;

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  listing_id TEXT NOT NULL,
  card_name TEXT NOT NULL,
  unit_price_sen INTEGER NOT NULL CHECK (unit_price_sen > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  snapshot TEXT NOT NULL DEFAULT '{}',
  UNIQUE (order_id, listing_id)
);

-- One live claim per listing (primary key). Same rule as Postgres.
CREATE TABLE listing_locks (
  listing_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  pos_sale_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('held','sold')),
  held_until INTEGER,
  updated_at INTEGER NOT NULL,
  CHECK (state = 'sold' OR held_until IS NOT NULL),
  CHECK ((order_id IS NULL) <> (pos_sale_id IS NULL))
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY, seller_uid TEXT NOT NULL, courier TEXT,
  delyva_order_no TEXT UNIQUE, tracking_number TEXT,
  label_cost_sen INTEGER CHECK (label_cost_sen >= 0),
  booked_at INTEGER, delivered_at INTEGER
);

-- ── Payments ────────────────────────────────────────────────────────
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL DEFAULT 'billplz',
  provider_bill_id TEXT UNIQUE,
  amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','voided','duplicate')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, paid_at INTEGER, voided_at INTEGER
);
CREATE UNIQUE INDEX payments_one_open_per_order ON payments (order_id) WHERE status = 'created';
CREATE UNIQUE INDEX payments_one_paid_per_order ON payments (order_id) WHERE status = 'paid';

CREATE TABLE provider_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL, kind TEXT NOT NULL, provider_ref TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  signature_ok INTEGER NOT NULL CHECK (signature_ok IN (0,1)),
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL, processed_at INTEGER, outcome TEXT
);

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY, scope TEXT NOT NULL, request_hash TEXT NOT NULL,
  response TEXT, created_at INTEGER NOT NULL
);

-- ── Refunds, destinations, payouts ──────────────────────────────────
CREATE TABLE payout_destinations (
  id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL, account_number TEXT NOT NULL, account_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (owner_uid, bank_code, account_number, account_name)
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
  fee_kept_sen INTEGER NOT NULL DEFAULT 0 CHECK (fee_kept_sen >= 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processing','paid','failed','cancelled')),
  destination_id TEXT REFERENCES payout_destinations(id),
  payment_order_id TEXT UNIQUE,
  reference_id TEXT NOT NULL UNIQUE,
  requested_at INTEGER NOT NULL, paid_at INTEGER, failed_reason TEXT
);

CREATE TABLE payout_batches (
  id TEXT PRIMARY KEY,
  seller_uid TEXT NOT NULL,
  destination_id TEXT NOT NULL REFERENCES payout_destinations(id),
  gross_sen INTEGER NOT NULL CHECK (gross_sen > 0),
  withdrawal_fee_sen INTEGER NOT NULL DEFAULT 0 CHECK (withdrawal_fee_sen >= 0),
  amount_sen INTEGER GENERATED ALWAYS AS (gross_sen - withdrawal_fee_sen) STORED,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','paid','failed')),
  auto_supported INTEGER NOT NULL CHECK (auto_supported IN (0,1)),
  payment_order_id TEXT UNIQUE,
  reference_id TEXT NOT NULL UNIQUE,
  manual_reference TEXT,
  requested_at INTEGER NOT NULL, executed_at INTEGER, paid_at INTEGER,
  failed_at INTEGER, failure_reason TEXT,
  CHECK (gross_sen > withdrawal_fee_sen)
);
CREATE TABLE payout_items (
  batch_id TEXT NOT NULL REFERENCES payout_batches(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  PRIMARY KEY (batch_id, order_id)
);
CREATE UNIQUE INDEX payout_items_one_live ON payout_items (order_id) WHERE active = 1;

-- ── Double-entry ledger ─────────────────────────────────────────────
CREATE TABLE ledger_accounts (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('asset','liability','revenue','expense')),
  per_party INTEGER NOT NULL DEFAULT 0 CHECK (per_party IN (0,1))
);
INSERT INTO ledger_accounts (id, code, kind, per_party) VALUES
  (1,  'asset:billplz_receivable',        'asset',     0),
  (2,  'asset:holding_bank',              'asset',     0),
  (3,  'asset:operating_bank',            'asset',     0),
  (4,  'asset:delyva_credit',             'asset',     0),
  (5,  'liability:buyer_protection_held', 'liability', 1),
  (6,  'liability:seller_payable',        'liability', 1),
  (7,  'liability:payout_in_transit',     'liability', 1),
  (8,  'liability:refund_payable',        'liability', 1),
  (9,  'liability:sst_payable',           'liability', 0),
  (10, 'revenue:commission',              'revenue',   0),
  (11, 'revenue:postage',                 'revenue',   0),
  (12, 'revenue:cancellation_fee',        'revenue',   0),
  (13, 'revenue:withdrawal_fee',          'revenue',   0),
  (14, 'expense:gateway_fees',            'expense',   0),
  (15, 'expense:postage',                 'expense',   0);

CREATE TABLE fee_sweeps (
  id TEXT PRIMARY KEY, period_end INTEGER NOT NULL,
  amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','sent','confirmed')),
  bank_reference TEXT, created_at INTEGER NOT NULL, confirmed_at INTEGER
);

CREATE TABLE ledger_transactions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,      -- posting twice is impossible
  order_id TEXT REFERENCES orders(id),
  refund_id TEXT REFERENCES refunds(id),
  payout_id TEXT REFERENCES payout_batches(id),
  sweep_id TEXT REFERENCES fee_sweeps(id),
  reverses TEXT REFERENCES ledger_transactions(id),
  memo TEXT,
  occurred_at INTEGER NOT NULL
);
CREATE TABLE ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id TEXT NOT NULL REFERENCES ledger_transactions(id),
  account_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
  party_uid TEXT,
  order_id TEXT REFERENCES orders(id),
  amount_sen INTEGER NOT NULL CHECK (amount_sen <> 0),  -- + debit, - credit
  created_at INTEGER NOT NULL
);
CREATE INDEX ledger_entries_acct_party ON ledger_entries (account_id, party_uid);
CREATE INDEX ledger_entries_order ON ledger_entries (order_id);

CREATE TRIGGER ledger_party BEFORE INSERT ON ledger_entries
  WHEN (SELECT per_party FROM ledger_accounts WHERE id = NEW.account_id) <> (NEW.party_uid IS NOT NULL)
  BEGIN SELECT RAISE(ABORT, 'ledger_party_mismatch'); END;
CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON ledger_entries
  BEGIN SELECT RAISE(ABORT, 'ledger_append_only'); END;
CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON ledger_entries
  BEGIN SELECT RAISE(ABORT, 'ledger_append_only'); END;
CREATE TRIGGER ledger_txn_no_update BEFORE UPDATE ON ledger_transactions
  BEGIN SELECT RAISE(ABORT, 'ledger_append_only'); END;
CREATE TRIGGER ledger_txn_no_delete BEFORE DELETE ON ledger_transactions
  BEGIN SELECT RAISE(ABORT, 'ledger_append_only'); END;
-- Balance: SQLite has no deferred triggers, so every batch that posts a
-- transaction ends with:
--   INSERT INTO assert_balanced SELECT COALESCE(SUM(amount_sen),0) = 0
--     FROM ledger_entries WHERE txn_id = ?;

CREATE VIEW account_balances AS
  SELECT a.code, e.party_uid, SUM(e.amount_sen) AS balance_sen
  FROM ledger_entries e JOIN ledger_accounts a ON a.id = e.account_id
  GROUP BY a.code, e.party_uid;

-- ── Outbox (Firestore mirror, notifications) ────────────────────────
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL, payload TEXT NOT NULL,
  created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER, last_error TEXT
);
CREATE INDEX outbox_pending ON outbox (id) WHERE done_at IS NULL;

// Stage 1: record every payment Firestore settles into the ledger database
// (Turso, which is SQLite) as well, without changing what buyers see.
// Firestore is still the source of truth; this runs beside it so the two can
// be reconciled before anything switches.
//
// Each call is one batch (one SQL transaction). The batch ends with an assert
// that the ledger transaction balances, so a half-posted payment can't exist.
// Problems the shadow notices (a card already sold to another order, a second
// paid bill on one order) are recorded, not refused: noticing them is the
// point of stage 1.

import type { D1Like, D1StatementLike } from "./db.ts";

export const ACCOUNTS = {
  billplzReceivable: 1,
  buyerProtectionHeld: 5,
  refundPayable: 8,
} as const;

export interface ShadowItem {
  listingId: string;
  cardName: string;
  unitPriceSen: number;
}

export interface ShadowOrder {
  firestoreId: string;
  source: "cart" | "auction";
  auctionId?: string | null;
  buyerUid: string;
  sellerUid: string;
  items: ShadowItem[];
  subtotalSen: number;
  shippingSen: number;
  totalSen: number;
  deliveryAddress: unknown;
  feeRateBp: number;
  platformFeeSen: number;
  sstSen: number;
  sellerNetSen: number;
}

export interface ShadowPaymentInput {
  billId: string;
  paidSen: number;
  /** Billplz's paid_at string, part of the event's dedupe key. */
  billplzPaidAt: string;
  /** The verified callback fields (no x_signature), kept raw for audit. */
  callback: Record<string, string>;
  order: ShadowOrder;
}

export type ShadowOutcome =
  | "recorded"
  | "recorded_duplicate_payment"
  | "already_recorded";

export interface ShadowResult {
  outcome: ShadowOutcome;
  orderId: string;
  /** Listings another order already holds: the double-sell the design fixes in stage 2. */
  conflicts: { listingId: string; heldByOrder: string | null }[];
}

const isUid = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 128;
const isSen = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1e10;

/** Rejects input the schema would refuse anyway, with a readable reason. */
export const validateShadowInput = (x: any): string | null => {
  if (!x || typeof x !== "object") return "body must be an object";
  if (typeof x.billId !== "string" || !x.billId) return "billId required";
  if (!isSen(x.paidSen) || x.paidSen <= 0) return "paidSen must be a positive integer";
  const o = x.order;
  if (!o || typeof o !== "object") return "order required";
  if (typeof o.firestoreId !== "string" || !o.firestoreId) return "order.firestoreId required";
  if (o.source !== "cart" && o.source !== "auction") return "order.source must be cart or auction";
  if (o.source === "auction" && !o.auctionId) return "order.auctionId required for auctions";
  if (!isUid(o.buyerUid) || !isUid(o.sellerUid)) return "order.buyerUid and sellerUid required";
  if (!Array.isArray(o.items) || o.items.length === 0 || o.items.length > 40) return "order.items must have 1 to 40 items";
  for (const i of o.items) {
    if (!i || typeof i.listingId !== "string" || !i.listingId) return "item.listingId required";
    if (!isSen(i.unitPriceSen) || i.unitPriceSen <= 0) return "item.unitPriceSen must be a positive integer";
  }
  for (const k of ["subtotalSen", "shippingSen", "totalSen", "platformFeeSen", "sstSen", "sellerNetSen"]) {
    if (!isSen(o[k])) return `order.${k} must be a non-negative integer`;
  }
  if (!Number.isInteger(o.feeRateBp) || o.feeRateBp < 0 || o.feeRateBp > 10000) return "order.feeRateBp out of range";
  if (o.totalSen <= 0) return "order.totalSen must be positive";
  return null;
};

export const shadowPayment = async (
  db: D1Like,
  input: ShadowPaymentInput,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<ShadowResult> => {
  const o = input.order;
  const dedupeKey = `billplz:bill.callback:${input.billId}:${input.billplzPaidAt}`;

  // ── Reads (outside the batch; the batch re-checks what matters) ────
  const seen = await db
    .prepare("SELECT outcome FROM provider_events WHERE dedupe_key = ?")
    .bind(dedupeKey)
    .first<{ outcome: string | null }>();
  const existingPayment = await db
    .prepare("SELECT id FROM payments WHERE provider_bill_id = ?")
    .bind(input.billId)
    .first<{ id: string }>();
  const existingOrder = await db
    .prepare("SELECT id FROM orders WHERE legacy_firestore_id = ?")
    .bind(o.firestoreId)
    .first<{ id: string }>();
  if (seen || existingPayment) {
    return { outcome: "already_recorded", orderId: existingOrder?.id ?? "", conflicts: [] };
  }

  const orderId = existingOrder?.id ?? newId();
  const paidAlready = existingOrder
    ? await db
        .prepare("SELECT id FROM payments WHERE order_id = ? AND status = 'paid'")
        .bind(orderId)
        .first<{ id: string }>()
    : null;
  const duplicate = !!paidAlready;

  const conflicts: ShadowResult["conflicts"] = [];
  for (const item of o.items) {
    const lock = await db
      .prepare("SELECT order_id FROM listing_locks WHERE listing_id = ?")
      .bind(item.listingId)
      .first<{ order_id: string | null }>();
    if (lock && lock.order_id !== orderId) conflicts.push({ listingId: item.listingId, heldByOrder: lock.order_id });
  }

  // Keep the shadow's total equal to what Firestore charged: any gap between
  // subtotal + shipping and the total becomes a join fee or a discount.
  const gap = o.totalSen - o.subtotalSen - o.shippingSen;
  const joinFee = gap > 0 ? gap : 0;
  const discount = gap < 0 ? -gap : 0;

  const paymentId = newId();
  const txnId = newId();
  const s: D1StatementLike[] = [];

  s.push(
    db
      .prepare(
        `INSERT INTO provider_events (provider, kind, provider_ref, dedupe_key, signature_ok, payload, received_at)
         VALUES ('billplz', 'bill.callback', ?, ?, 1, ?, ?)`,
      )
      .bind(input.billId, dedupeKey, JSON.stringify(input.callback), now),
  );

  if (!existingOrder) {
    s.push(
      db
        .prepare(
          `INSERT INTO orders (id, legacy_firestore_id, source, auction_id, buyer_uid, seller_uid, status,
             subtotal_sen, shipping_sen, join_fee_sen, discount_sen, fee_rate_bp, platform_fee_sen, sst_sen,
             seller_net_sen, delivery_address, paid_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          orderId, o.firestoreId, o.source, o.auctionId ?? null, o.buyerUid, o.sellerUid,
          o.subtotalSen, o.shippingSen, joinFee, discount, o.feeRateBp, o.platformFeeSen, o.sstSen,
          o.sellerNetSen, JSON.stringify(o.deliveryAddress ?? {}), now, now, now,
        ),
    );
    for (const item of o.items) {
      s.push(
        db
          .prepare(
            `INSERT INTO order_items (id, order_id, listing_id, card_name, unit_price_sen) VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(newId(), orderId, item.listingId, String(item.cardName || "Card").slice(0, 200), item.unitPriceSen),
      );
      // Claim the card unless another order already has it (that's a
      // recorded conflict, not an error, in the shadow stage).
      s.push(
        db
          .prepare(
            `INSERT INTO listing_locks (listing_id, order_id, state, held_until, updated_at)
             VALUES (?, ?, 'sold', NULL, ?) ON CONFLICT (listing_id) DO NOTHING`,
          )
          .bind(item.listingId, orderId, now),
      );
    }
  }

  s.push(
    db
      .prepare(
        `INSERT INTO payments (id, order_id, provider, provider_bill_id, amount_sen, status, idempotency_key, created_at, paid_at)
         VALUES (?, ?, 'billplz', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(paymentId, orderId, input.billId, input.paidSen, duplicate ? "duplicate" : "paid", `bill:${input.billId}`, now, now),
  );

  s.push(
    db
      .prepare(
        `INSERT INTO ledger_transactions (id, kind, source_key, order_id, memo, occurred_at)
         VALUES (?, 'payment_captured', ?, ?, ?, ?)`,
      )
      .bind(txnId, `payment_captured:${input.billId}`, orderId, duplicate ? "second paid bill on one order" : null, now),
  );
  s.push(
    db
      .prepare(`INSERT INTO ledger_entries (txn_id, account_id, amount_sen, created_at) VALUES (?, ?, ?, ?)`)
      .bind(txnId, ACCOUNTS.billplzReceivable, input.paidSen, now),
  );
  s.push(
    duplicate
      ? db
          .prepare(
            `INSERT INTO ledger_entries (txn_id, account_id, party_uid, order_id, amount_sen, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(txnId, ACCOUNTS.refundPayable, o.buyerUid, orderId, -input.paidSen, now)
      : db
          .prepare(
            `INSERT INTO ledger_entries (txn_id, account_id, party_uid, order_id, amount_sen, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(txnId, ACCOUNTS.buyerProtectionHeld, o.sellerUid, orderId, -input.paidSen, now),
  );
  if (duplicate) {
    s.push(
      db
        .prepare(
          `INSERT INTO refunds (id, order_id, payment_id, amount_sen, reason, status, reference_id, requested_at)
           VALUES (?, ?, ?, ?, 'duplicate_payment', 'requested', ?, ?)`,
        )
        .bind(newId(), orderId, paymentId, input.paidSen, `refund:${paymentId}`, now),
    );
  }
  s.push(
    db
      .prepare(`INSERT INTO assert_balanced SELECT COALESCE(SUM(amount_sen), 0) = 0 FROM ledger_entries WHERE txn_id = ?`)
      .bind(txnId),
  );
  const outcome: ShadowOutcome = duplicate ? "recorded_duplicate_payment" : "recorded";
  s.push(
    db
      .prepare(`UPDATE provider_events SET processed_at = ?, outcome = ? WHERE dedupe_key = ?`)
      .bind(now, conflicts.length ? `${outcome}:conflict` : outcome, dedupeKey),
  );

  await db.batch(s);
  return { outcome, orderId, conflicts };
};

// ── Entry point for the Billplz callback ─────────────────────────────

export class LedgerInputError extends Error {}

const RACE = /UNIQUE constraint failed: (provider_events\.dedupe_key|payments\.provider_bill_id|ledger_transactions\.source_key)/;

/**
 * Record a paid Billplz callback that the caller has already verified
 * (server/api/billplz/webhook.post.ts checks the X-Signature first).
 * Throws LedgerInputError for input the schema would refuse.
 */
export const recordBillplzPayment = async (
  db: D1Like,
  input: { callback: Record<string, string>; paidSen: number; order: ShadowOrder },
  now: number,
): Promise<ShadowResult> => {
  const { x_signature: _sig, ...callback } = input.callback ?? {};
  if (callback.paid !== "true") throw new LedgerInputError("callback is not a paid bill");
  const shadowInput = {
    billId: callback.id,
    paidSen: input.paidSen,
    billplzPaidAt: callback.paid_at ?? "",
    callback,
    order: input.order,
  };
  const invalid = validateShadowInput(shadowInput);
  if (invalid) throw new LedgerInputError(invalid);
  try {
    return await shadowPayment(db, shadowInput, now);
  } catch (e: any) {
    // A concurrent retry of the same callback loses the race on a unique key.
    if (RACE.test(String(e?.message ?? e))) return { outcome: "already_recorded", orderId: "", conflicts: [] };
    throw e;
  }
};

// ── Reconciliation read ──────────────────────────────────────────────

export interface LedgerOrderRow {
  firestoreId: string;
  status: string;
  totalSen: number;
  paidSen: number;
  paymentStatus: string;
  billId: string;
  paidAt: number;
}

export const summary = async (db: D1Like, fromMs: number, toMs: number) => {
  const rows = await db
    .prepare(
      `SELECT o.legacy_firestore_id AS firestoreId, o.status, o.total_sen AS totalSen,
              p.amount_sen AS paidSen, p.status AS paymentStatus, p.provider_bill_id AS billId, p.paid_at AS paidAt
         FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE p.paid_at BETWEEN ? AND ?
        ORDER BY p.paid_at LIMIT 2000`,
    )
    .bind(fromMs, toMs)
    .all<LedgerOrderRow>();
  const conflicts = await db
    .prepare(
      `SELECT provider_ref AS billId, outcome, received_at AS at FROM provider_events
        WHERE outcome LIKE '%conflict%' AND received_at BETWEEN ? AND ? ORDER BY received_at LIMIT 500`,
    )
    .bind(fromMs, toMs)
    .all<{ billId: string; outcome: string; at: number }>();
  const balances = await db
    .prepare(`SELECT code, SUM(balance_sen) AS balanceSen FROM account_balances GROUP BY code ORDER BY code`)
    .all<{ code: string; balanceSen: number }>();
  return { orders: rows.results, conflicts: conflicts.results, balances: balances.results };
};

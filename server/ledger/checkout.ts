// Stage 2: hold the cards in the ledger before the buyer is sent to pay.
//
// create-bill prices the order on the server, then calls holdOrder. One batch
// (one SQL transaction) writes the order at its server-worked amounts and
// claims every card in listing_locks as 'held' for this order. The batch
// asserts each claim landed, so a card another live order holds, or one
// already sold, rolls the whole batch back and no bill is made. SQLite runs
// one writer at a time, so two buyers pressing Pay together can't both win.
//
// A hold lapses after HOLD_MS. A lapsed hold can be taken by another order;
// its open bill is voided here and returned so the caller deletes it at
// Billplz, and the first buyer can no longer pay for a card someone else has.
//
// The Billplz callback (shadow.ts) then turns the order paid and the holds
// into 'sold'.

import type { D1Like, D1StatementLike } from "./db.ts";

/** How long a card stays held for one buyer's payment. */
export const HOLD_MS = 30 * 60 * 1000;

export interface HoldItem {
  listingId: string;
  cardName: string;
  unitPriceSen: number;
}

export interface HoldInput {
  firestoreId: string;
  source: "cart" | "auction";
  auctionId?: string | null;
  buyerUid: string;
  sellerUid: string;
  items: HoldItem[];
  subtotalSen: number;
  shippingSen: number;
  totalSen: number;
  deliveryAddress: unknown;
}

export class HoldError extends Error {
  code: "listing_unavailable" | "order_state_changed";
  listings: string[];
  constructor(code: "listing_unavailable" | "order_state_changed", listings: string[] = []) {
    super(code);
    this.code = code;
    this.listings = listings;
  }
}

export interface HoldResult {
  orderId: string;
  holdExpiresAt: number;
  /** Bills of lapsed holds this order took over: delete them at Billplz. */
  displacedBillIds: string[];
}

const isSen = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1e10;

export const validateHoldInput = (o: any): string | null => {
  if (!o || typeof o !== "object") return "order required";
  if (typeof o.firestoreId !== "string" || !o.firestoreId) return "firestoreId required";
  if (o.source !== "cart" && o.source !== "auction") return "source must be cart or auction";
  if (o.source === "auction" && !o.auctionId) return "auctionId required for auctions";
  if (!o.buyerUid || !o.sellerUid) return "buyerUid and sellerUid required";
  if (!Array.isArray(o.items) || o.items.length === 0 || o.items.length > 40) return "items must have 1 to 40 items";
  const ids = new Set<string>();
  for (const i of o.items) {
    if (!i || typeof i.listingId !== "string" || !i.listingId) return "item.listingId required";
    if (ids.has(i.listingId)) return "duplicate listing";
    ids.add(i.listingId);
    if (!isSen(i.unitPriceSen) || i.unitPriceSen <= 0) return "item.unitPriceSen must be a positive integer";
  }
  for (const k of ["subtotalSen", "shippingSen", "totalSen"]) if (!isSen(o[k])) return `${k} must be a non-negative integer`;
  if (o.totalSen <= 0) return "totalSen must be positive";
  const itemsSen = o.items.reduce((s: number, i: HoldItem) => s + i.unitPriceSen, 0);
  if (itemsSen !== o.subtotalSen) return "subtotalSen must equal the items";
  return null;
};

export const holdOrder = async (
  db: D1Like,
  input: HoldInput,
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<HoldResult> => {
  const invalid = validateHoldInput(input);
  if (invalid) throw new Error(`ledger hold: ${invalid}`);
  const o = input;

  const existing = await db
    .prepare("SELECT id, status FROM orders WHERE legacy_firestore_id = ?")
    .bind(o.firestoreId)
    .first<{ id: string; status: string }>();
  if (existing && existing.status !== "awaiting_payment") throw new HoldError("order_state_changed");
  const orderId = existing?.id ?? newId();

  // Who holds each card now. Decided here, re-checked inside the batch.
  const unavailable: string[] = [];
  const displacedOrders = new Set<string>();
  for (const item of o.items) {
    const lock = await db
      .prepare("SELECT order_id, pos_sale_id, state, held_until FROM listing_locks WHERE listing_id = ?")
      .bind(item.listingId)
      .first<{ order_id: string | null; pos_sale_id: string | null; state: string; held_until: number | null }>();
    if (!lock || lock.order_id === orderId) continue;
    if (lock.state === "held" && Number(lock.held_until) <= now) {
      if (lock.order_id) displacedOrders.add(lock.order_id);
      continue;
    }
    unavailable.push(item.listingId);
  }
  if (unavailable.length) throw new HoldError("listing_unavailable", unavailable);

  const displacedBillIds: string[] = [];
  for (const id of displacedOrders) {
    const rows = await db
      .prepare("SELECT provider_bill_id AS billId FROM payments WHERE order_id = ? AND status = 'created' AND provider_bill_id IS NOT NULL")
      .bind(id)
      .all<{ billId: string }>();
    displacedBillIds.push(...rows.results.map((r) => r.billId));
  }

  const holdUntil = now + HOLD_MS;
  const gap = o.totalSen - o.subtotalSen - o.shippingSen;
  const joinFee = gap > 0 ? gap : 0;
  const discount = gap < 0 ? -gap : 0;
  const address = JSON.stringify(o.deliveryAddress ?? {});
  const s: D1StatementLike[] = [];

  if (existing) {
    s.push(
      db
        .prepare(
          `UPDATE orders SET subtotal_sen = ?, shipping_sen = ?, join_fee_sen = ?, discount_sen = ?,
             delivery_address = ?, hold_expires_at = ?, updated_at = ?
           WHERE id = ? AND status = 'awaiting_payment'`,
        )
        .bind(o.subtotalSen, o.shippingSen, joinFee, discount, address, holdUntil, now, orderId),
    );
    s.push(
      db
        .prepare(`INSERT INTO assert_order_state SELECT (SELECT status FROM orders WHERE id = ?) = 'awaiting_payment'`)
        .bind(orderId),
    );
    s.push(db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId));
    // Its earlier holds (the order may have lost a card since) and its earlier
    // bill: the new bill replaces it.
    s.push(db.prepare("DELETE FROM listing_locks WHERE order_id = ? AND state = 'held'").bind(orderId));
    s.push(
      db.prepare("UPDATE payments SET status = 'voided', voided_at = ? WHERE order_id = ? AND status = 'created'").bind(now, orderId),
    );
  } else {
    s.push(
      db
        .prepare(
          `INSERT INTO orders (id, legacy_firestore_id, source, auction_id, buyer_uid, seller_uid, status,
             subtotal_sen, shipping_sen, join_fee_sen, discount_sen, delivery_address, hold_expires_at,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          orderId, o.firestoreId, o.source, o.auctionId ?? null, o.buyerUid, o.sellerUid,
          o.subtotalSen, o.shippingSen, joinFee, discount, address, holdUntil, now, now,
        ),
    );
  }

  for (const id of displacedOrders) {
    s.push(
      db.prepare("UPDATE payments SET status = 'voided', voided_at = ? WHERE order_id = ? AND status = 'created'").bind(now, id),
    );
  }

  for (const item of o.items) {
    s.push(
      db
        .prepare(`INSERT INTO order_items (id, order_id, listing_id, card_name, unit_price_sen) VALUES (?, ?, ?, ?, ?)`)
        .bind(newId(), orderId, item.listingId, String(item.cardName || "Card").slice(0, 200), item.unitPriceSen),
    );
    // Free, or a lapsed hold: take it. Anything else stays and the assert
    // below aborts the batch.
    s.push(
      db
        .prepare(
          `INSERT INTO listing_locks (listing_id, order_id, pos_sale_id, state, held_until, updated_at)
           VALUES (?, ?, NULL, 'held', ?, ?)
           ON CONFLICT (listing_id) DO UPDATE SET order_id = excluded.order_id, pos_sale_id = NULL,
             state = 'held', held_until = excluded.held_until, updated_at = excluded.updated_at
           WHERE listing_locks.state = 'held' AND listing_locks.held_until <= ?`,
        )
        .bind(item.listingId, orderId, holdUntil, now, now),
    );
    s.push(
      db
        .prepare(
          `INSERT INTO assert_listing_free SELECT EXISTS (
             SELECT 1 FROM listing_locks WHERE listing_id = ? AND order_id = ? AND state = 'held')`,
        )
        .bind(item.listingId, orderId),
    );
  }

  try {
    await db.batch(s);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/listing_unavailable/.test(msg)) throw new HoldError("listing_unavailable", o.items.map((i) => i.listingId));
    if (/order_state_changed|illegal_order_transition|order_amounts_frozen/.test(msg)) throw new HoldError("order_state_changed");
    throw e;
  }
  return { orderId, holdExpiresAt: holdUntil, displacedBillIds };
};

/** Record the bill create-bill just made for a held order. */
export const attachBill = async (
  db: D1Like,
  input: { orderId: string; billId: string; amountSen: number },
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO payments (id, order_id, provider, provider_bill_id, amount_sen, status, idempotency_key, created_at)
       VALUES (?, ?, 'billplz', ?, ?, 'created', ?, ?)`,
    )
    .bind(newId(), input.orderId, input.billId, input.amountSen, `bill:${input.billId}`, now)
    .run();
};

/** Let the cards go again, when no bill could be made. */
export const releaseHold = async (db: D1Like, orderId: string): Promise<void> => {
  await db.prepare("DELETE FROM listing_locks WHERE order_id = ? AND state = 'held'").bind(orderId).run();
};

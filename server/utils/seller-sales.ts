// Assembling a seller's counter sales from the two places they're recorded.
//
// It also folds in marketplace orders, because "Sales" answers "what money
// have I concluded", across both channels. Fulfilment — what still needs
// packing, a waybill, a tracking check — is a different question and lives in
// Orders. Splitting the two by purpose rather than by channel means neither
// page is half an answer.
//
// WHY TWO SOURCES FOR COUNTER SALES
// A POS checkout writes a `posSales` receipt and stamps `posSaleId` onto each
// inventory row it sold. But an item can also be marked sold by hand from the
// Items table, which writes the inventory row and no receipt at all. And a QR
// sale sitting in `awaiting_payment` has a receipt while its items aren't sold
// yet.
//
// So neither source is complete on its own:
//   inventory only   → misses unpaid sales, and has no payment method
//   posSales only    → misses every hand-marked sale
//
// This unions them, keyed by sale, with the receipt winning wherever both
// describe the same sale. Live data also contains inventory rows whose
// posSaleId points at a receipt that no longer exists, so a missing receipt
// has to degrade to "reconstruct from the items" rather than drop the sale.

import type { Firestore } from "firebase-admin/firestore";
import type { PosSale, PosSaleLine, PosSaleStatus } from "~/shared/pos-sale";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Marks a sale reconstructed from inventory rather than read from a receipt. */
export type SaleOrigin = "receipt" | "reconstructed" | "order";
export type SaleChannel = "in_person" | "online";

export interface SellerSale extends PosSale {
  origin: SaleOrigin;
  channel: SaleChannel;
  /** Online only: where the fulfilment lives. */
  orderId?: string;
  buyerName?: string | null;
}

/**
 * Order statuses that count as concluded money.
 *
 * Paid onwards: the customer's money has been taken. `pending` and
 * `confirmed` are pre-payment, and a cancelled order is not a sale — counting
 * either would inflate the one figure a seller checks to know what they made.
 */
const CONCLUDED_ORDER_STATUSES = ["paid", "shipped", "delivered"];

const lineFromItem = (id: string, i: any): PosSaleLine => ({
  itemId: id,
  cardId: i.listingId ?? null,
  cardName: i.cardName ?? "Card",
  sub: [i.setName, i.number].filter(Boolean).join(" · "),
  image: i.primaryImage ?? i.stockImageUrl ?? "",
  listPrice: round2(Number(i.listPrice) || 0),
  // Fall back to the asking price: an item marked sold without a figure went
  // for its label as far as anyone can tell, and treating it as free would
  // silently understate the day's takings.
  soldPrice: round2(Number(i.soldPrice ?? i.listPrice) || 0),
});

const totalsFor = (lines: PosSaleLine[]) => {
  const subtotal = round2(lines.reduce((s, l) => s + l.listPrice, 0));
  const total = round2(lines.reduce((s, l) => s + l.soldPrice, 0));
  return { subtotal, total, discountTotal: round2(Math.max(0, subtotal - total)) };
};

export const loadSellerSales = async (
  db: Firestore,
  sellerUid: string,
  limit = 500,
): Promise<SellerSale[]> => {
  const [receiptSnap, itemSnap] = await Promise.all([
    db.collection("posSales").where("sellerUid", "==", sellerUid).limit(limit).get(),
    db
      .collection("inventory")
      .where("userUid", "==", sellerUid)
      .where("status", "==", "sold")
      .limit(limit * 3)
      .get(),
  ]);

  const receipts = new Map<string, any>();
  for (const d of receiptSnap.docs) receipts.set(d.id, d.data());

  // Group the sold items by the receipt they belong to. Hand-marked items get
  // a synthetic key so they still appear as a one-line sale.
  const groups = new Map<string, { id: string; items: PosSaleLine[]; soldAt: number }>();
  for (const d of itemSnap.docs) {
    const i = d.data() as any;
    if (i.saleChannel !== "direct") continue; // online sales live in compiledOrders
    const key = i.posSaleId || `item:${d.id}`;
    const g = groups.get(key) ?? { id: key, items: [], soldAt: 0 };
    g.items.push(lineFromItem(d.id, i));
    g.soldAt = Math.max(g.soldAt, Number(i.soldAt ?? i.updatedAt) || 0);
    groups.set(key, g);
  }

  const out: SellerSale[] = [];

  for (const [key, g] of groups) {
    const receipt = receipts.get(key);
    if (receipt) {
      receipts.delete(key); // claimed; anything left is a sale with no sold items
      out.push({
        id: key,
        sellerUid,
        lines: receipt.lines?.length ? receipt.lines : g.items,
        subtotal: receipt.subtotal ?? totalsFor(g.items).subtotal,
        discountTotal: receipt.discountTotal ?? totalsFor(g.items).discountTotal,
        total: receipt.total ?? totalsFor(g.items).total,
        status: (receipt.status ?? "paid") as PosSaleStatus,
        method: receipt.method ?? "cash",
        createdAt: receipt.createdAt ?? g.soldAt,
        updatedAt: receipt.updatedAt ?? g.soldAt,
        paidAt: receipt.paidAt ?? g.soldAt,
        failedReason: receipt.failedReason,
        origin: "receipt",
        channel: "in_person",
      });
      continue;
    }

    // No receipt: either marked sold by hand, or the receipt is gone. Either
    // way the items are the evidence the sale happened.
    const t = totalsFor(g.items);
    out.push({
      id: key,
      sellerUid,
      lines: g.items,
      ...t,
      status: "paid",
      method: "cash",
      createdAt: g.soldAt,
      updatedAt: g.soldAt,
      paidAt: g.soldAt,
      origin: "reconstructed",
      channel: "in_person",
    });
  }

  // Receipts with no sold items behind them — an unpaid or cancelled sale.
  for (const [id, r] of receipts) {
    out.push({
      id,
      sellerUid,
      lines: r.lines ?? [],
      subtotal: r.subtotal ?? 0,
      discountTotal: r.discountTotal ?? 0,
      total: r.total ?? 0,
      status: (r.status ?? "awaiting_payment") as PosSaleStatus,
      method: r.method ?? "cash",
      createdAt: r.createdAt ?? 0,
      updatedAt: r.updatedAt ?? 0,
      paidAt: r.paidAt,
      failedReason: r.failedReason,
      origin: "receipt",
      channel: "in_person",
    });
  }

  // ── Marketplace orders ────────────────────────────────────────────
  const orderSnap = await db
    .collection("compiledOrders")
    .where("sellerUid", "==", sellerUid)
    .limit(limit)
    .get();

  for (const d of orderSnap.docs) {
    const o = d.data() as any;
    if (!CONCLUDED_ORDER_STATUSES.includes(o.status)) continue;

    const lines: PosSaleLine[] = (o.items ?? []).map((it: any) => ({
      itemId: it.cardId,
      cardId: it.cardId,
      cardName: it.cardName ?? "Card",
      sub: [it.cardSet, it.condition].filter(Boolean).join(" · "),
      image: it.imageUrl ?? "",
      // A marketplace listing sells at its asking price — there's no haggling
      // at checkout, so asked and taken are the same and the discount column
      // stays honestly empty rather than inventing a number.
      listPrice: round2(Number(it.price) || 0),
      soldPrice: round2(Number(it.price) || 0),
    }));

    // Card value only. Postage is the courier's money passing through, not
    // something the seller sold, and mixing it in would make online sales look
    // bigger than counter ones for no reason.
    const cardTotal = round2(Number(o.subtotal) || totalsFor(lines).total);

    out.push({
      id: `order:${d.id}`,
      sellerUid,
      lines,
      subtotal: cardTotal,
      discountTotal: 0,
      total: cardTotal,
      status: "paid",
      method: "online" as any,
      createdAt: o.createdAt ?? 0,
      updatedAt: o.updatedAt ?? o.createdAt ?? 0,
      paidAt: o.paidAt ?? o.createdAt ?? 0,
      origin: "order",
      channel: "online",
      orderId: d.id,
      buyerName: o.buyerName ?? null,
    });
  }

  return out.sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt));
};

/** One sale by id, for the receipt page. Same union, same fallbacks. */
export const loadSellerSale = async (
  db: Firestore,
  sellerUid: string,
  saleId: string,
): Promise<SellerSale | null> =>
  (await loadSellerSales(db, sellerUid)).find((s) => s.id === saleId) ?? null;

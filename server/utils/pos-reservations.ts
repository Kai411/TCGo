// Holding stock while a counter customer pays.
//
// The window is small — a QR payment takes under a minute — but it is exactly
// the window in which the same card is most likely to be bought online, since
// it's sitting in the shop's storefront looking available. Two tills in the
// same shop can also race each other.
//
// So reservations are taken in a Firestore transaction that re-reads every
// document and aborts if ANY of them moved. Partial holds are the failure mode
// worth designing against: a sale that grabs three of four cards leaves one
// card stuck reserved against a sale that never happens.

import type { Firestore } from "firebase-admin/firestore";
import { isAvailable, unavailableReason, POS_RESERVATION_MS } from "~/shared/card-availability";
import type { UnavailableReason } from "~/shared/card-availability";

export interface BlockedItem {
  itemId: string;
  cardId: string | null;
  cardName: string;
  reason: UnavailableReason;
}

export class StockUnavailableError extends Error {
  constructor(readonly blocked: BlockedItem[]) {
    super(
      blocked.length === 1
        ? `${blocked[0]!.cardName} is no longer available.`
        : `${blocked.length} items are no longer available.`,
    );
    this.name = "StockUnavailableError";
  }
}

/**
 * Read-only pre-flight, so the seller finds out BEFORE a QR goes on screen
 * that something in the basket sold online while they were scanning.
 *
 * Advisory only — `reserveItems` re-checks inside its transaction, because
 * anything learned here can be stale by the time the customer taps pay.
 */
export const checkStockAvailability = async (
  db: Firestore,
  itemIds: string[],
  sellerUid: string,
): Promise<BlockedItem[]> => {
  const blocked: BlockedItem[] = [];

  const itemSnaps = await Promise.all(
    itemIds.map((id) => db.collection("inventory").doc(id).get()),
  );

  for (const snap of itemSnaps) {
    if (!snap.exists) {
      blocked.push({
        itemId: snap.id,
        cardId: null,
        cardName: "This item",
        reason: "unavailable",
      });
      continue;
    }
    const item = snap.data() as any;
    // Someone else's stock is never sellable here, whatever its status.
    if (item.userUid !== sellerUid) {
      blocked.push({
        itemId: snap.id,
        cardId: item.listingId ?? null,
        cardName: item.cardName ?? "This item",
        reason: "unavailable",
      });
      continue;
    }
    if (item.status === "sold") {
      blocked.push({
        itemId: snap.id,
        cardId: item.listingId ?? null,
        cardName: item.cardName ?? "This item",
        reason: "sold",
      });
      continue;
    }
    // A listed item's authority is its listing: the online side is what a
    // buyer could have just paid for.
    if (item.listingId) {
      const cardSnap = await db.collection("cards").doc(item.listingId).get();
      if (cardSnap.exists && !isAvailable(cardSnap.data() as any)) {
        blocked.push({
          itemId: snap.id,
          cardId: item.listingId,
          cardName: item.cardName ?? "This item",
          reason: unavailableReason(cardSnap.data() as any) ?? "unavailable",
        });
      }
    }
  }

  return blocked;
};

/**
 * Take the holds. All-or-nothing.
 *
 * @throws StockUnavailableError with the offending items, so the POS can
 *         highlight them in the scanned list instead of just saying "no".
 */
export const reserveItems = async (
  db: Firestore,
  input: { saleId: string; sellerUid: string; itemIds: string[] },
): Promise<{ reservedUntil: number }> => {
  const reservedUntil = Date.now() + POS_RESERVATION_MS;

  await db.runTransaction(async (tx) => {
    const itemRefs = input.itemIds.map((id) => db.collection("inventory").doc(id));
    const itemSnaps = await tx.getAll(...itemRefs);

    const blocked: BlockedItem[] = [];
    const cardRefs: Array<FirebaseFirestore.DocumentReference> = [];

    for (const snap of itemSnaps) {
      const item = snap.data() as any;
      if (!snap.exists || item.userUid !== input.sellerUid || item.status === "sold") {
        blocked.push({
          itemId: snap.id,
          cardId: item?.listingId ?? null,
          cardName: item?.cardName ?? "This item",
          reason: item?.status === "sold" ? "sold" : "unavailable",
        });
        continue;
      }
      // Held by a DIFFERENT sale that hasn't lapsed — the other till wins.
      if (
        item.status === "reserved" &&
        item.reservedForSaleId &&
        item.reservedForSaleId !== input.saleId &&
        (item.reservedUntil ?? 0) > Date.now()
      ) {
        blocked.push({
          itemId: snap.id,
          cardId: item.listingId ?? null,
          cardName: item.cardName ?? "This item",
          reason: "reserved",
        });
        continue;
      }
      if (item.listingId) cardRefs.push(db.collection("cards").doc(item.listingId));
    }

    // Reads must all happen before any write in a Firestore transaction.
    const cardSnaps = cardRefs.length ? await tx.getAll(...cardRefs) : [];
    for (const cardSnap of cardSnaps) {
      if (!cardSnap.exists) continue;
      const card = cardSnap.data() as any;
      if (isAvailable(card)) continue;
      // Ignore a hold this very sale already owns (a retried request).
      if (card.reservedForSaleId === input.saleId) continue;
      const owner = itemSnaps.find((s) => (s.data() as any)?.listingId === cardSnap.id);
      blocked.push({
        itemId: owner?.id ?? cardSnap.id,
        cardId: cardSnap.id,
        cardName: card.cardName ?? "This item",
        reason: unavailableReason(card) ?? "unavailable",
      });
    }

    if (blocked.length) throw new StockUnavailableError(blocked);

    const now = Date.now();
    for (const snap of itemSnaps) {
      tx.update(snap.ref, {
        status: "reserved",
        reservedForSaleId: input.saleId,
        reservedUntil,
        updatedAt: now,
      });
    }
    for (const cardSnap of cardSnaps) {
      if (!cardSnap.exists) continue;
      // `reserved` + reservedUntil is what isAvailable() reads, so this is
      // what actually removes the card from the storefront and blocks
      // create-bill. The listing is NOT marked sold — a failed payment must
      // leave no trace.
      tx.update(cardSnap.ref, {
        status: "reserved",
        reservedForSaleId: input.saleId,
        reservedUntil,
      });
    }
  });

  return { reservedUntil };
};

/**
 * Hand the stock back. Used on payment failure, seller cancellation, and hold
 * expiry.
 *
 * Only clears holds this sale owns: if the hold already lapsed and another
 * till reserved the card, releasing blindly would yank it out from under them.
 */
export const releaseItems = async (db: Firestore, saleId: string): Promise<number> => {
  const items = await db
    .collection("inventory")
    .where("reservedForSaleId", "==", saleId)
    .get();
  const cards = await db.collection("cards").where("reservedForSaleId", "==", saleId).get();

  const batch = db.batch();
  const now = Date.now();
  const { FieldValue } = await import("firebase-admin/firestore");

  for (const d of items.docs) {
    const item = d.data() as any;
    if (item.status !== "reserved") continue; // already sold, or already freed
    batch.update(d.ref, {
      // Back to where it was: an item with a live listing is `listed`.
      status: item.listingId ? "listed" : "in_stock",
      reservedForSaleId: FieldValue.delete(),
      reservedUntil: FieldValue.delete(),
      updatedAt: now,
    });
  }
  for (const d of cards.docs) {
    const card = d.data() as any;
    if (card.status !== "reserved") continue;
    batch.update(d.ref, {
      status: "active",
      reservedForSaleId: FieldValue.delete(),
      reservedUntil: FieldValue.delete(),
    });
  }

  await batch.commit();
  return items.size + cards.size;
};

/**
 * Money's in. Convert the holds into a sale.
 *
 * Mirrors what the Billplz webhook does for an online order, minus escrow:
 * the seller has already been paid directly by the acquirer, so there is no
 * payout to schedule and nothing to settle later.
 */
export const settleItems = async (
  db: Firestore,
  input: { saleId: string; lines: Array<{ itemId: string; soldPrice: number }> },
): Promise<void> => {
  const now = Date.now();
  const { FieldValue } = await import("firebase-admin/firestore");
  const batch = db.batch();

  for (const line of input.lines) {
    const itemRef = db.collection("inventory").doc(line.itemId);
    const snap = await itemRef.get();
    if (!snap.exists) continue;
    const item = snap.data() as any;

    batch.update(itemRef, {
      status: "sold",
      soldAt: now,
      soldPrice: line.soldPrice,
      // "direct" keeps counter sales out of the online revenue figures, which
      // are counted from orders — see InventoryItem.saleChannel.
      saleChannel: "direct",
      posSaleId: input.saleId,
      reservedForSaleId: FieldValue.delete(),
      reservedUntil: FieldValue.delete(),
      updatedAt: now,
    });

    if (item.listingId) {
      batch.update(db.collection("cards").doc(item.listingId), {
        sold: true,
        soldAt: now,
        status: "sold",
        reservedForSaleId: FieldValue.delete(),
        reservedUntil: FieldValue.delete(),
      });
    }
  }

  await batch.commit();
};

/**
 * Sweep holds whose sale never completed.
 *
 * isAvailable() already treats a lapsed hold as available, so this is tidying
 * rather than correctness — but without it, stale `reserved` rows accumulate
 * and the seller's inventory list shows items in a state they can't act on.
 */
export const releaseExpiredReservations = async (
  db: Firestore,
  sellerUid: string,
): Promise<number> => {
  const stale = await db
    .collection("inventory")
    .where("userUid", "==", sellerUid)
    .where("status", "==", "reserved")
    .get();

  const saleIds = new Set<string>();
  for (const d of stale.docs) {
    const item = d.data() as any;
    if ((item.reservedUntil ?? 0) > Date.now()) continue;
    if (item.reservedForSaleId) saleIds.add(item.reservedForSaleId);
  }

  for (const saleId of saleIds) {
    await releaseItems(db, saleId);
    await db
      .collection("posSales")
      .doc(saleId)
      .update({
        status: "cancelled",
        failedReason: "Payment window expired",
        updatedAt: Date.now(),
      })
      .catch(() => {});
  }
  return saleIds.size;
};

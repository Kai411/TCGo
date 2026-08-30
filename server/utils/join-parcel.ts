// Folding a just-paid order into the parcel it was quoted against.
//
// The buyer was charged a small join fee instead of full postage at checkout,
// because /api/shipping/quote found an open parcel from the same seller to the
// same address. This is the other half of that promise: the two orders become
// one, so one label ships one box.
//
// Runs from the payment webhook, not from a seller pressing a button. The
// seller never asked for this and shouldn't have to — from their side an
// order simply arrives with more cards in it.

import type { Firestore } from "firebase-admin/firestore";
import { isOpenParcel } from "~/shared/order-joining";
import { noteError } from "~/server/utils/oplog";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface JoinResult {
  joined: boolean;
  into?: string;
  reason?: string;
}

/**
 * @param orderId the order that has just been paid and carries joinsOrderId
 */
export const joinPaidOrderToParcel = async (
  db: Firestore,
  orderId: string,
): Promise<JoinResult> => {
  const childRef = db.collection("compiledOrders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const childSnap = await tx.get(childRef);
    if (!childSnap.exists) return { joined: false, reason: "Order not found" };
    const child = childSnap.data() as any;

    if (!child.joinsOrderId) return { joined: false, reason: "Not a joining order" };
    if (child.mergedInto) return { joined: false, reason: "Already joined" };

    const parentRef = db.collection("compiledOrders").doc(child.joinsOrderId);
    const parentSnap = await tx.get(parentRef);
    if (!parentSnap.exists) {
      return { joined: false, reason: "The order it was joining no longer exists" };
    }
    const parent = parentSnap.data() as any;

    // The seller may have bought a label between checkout and payment. The
    // parcel is closed and this order has to travel on its own — but it paid
    // a join fee, not postage, so the platform is covering most of that
    // label. Say so loudly rather than letting it vanish into the courier
    // bill.
    if (!isOpenParcel(parent)) {
      noteError({
        area: "shipping",
        severity: "warning",
        code: "parcel.closed_before_join",
        message:
          `Order ${orderId.slice(0, 8)} was quoted a join fee for ` +
          `${child.joinsOrderId.slice(0, 8)}, but that parcel was labelled first.`,
        orderId,
        context: { parentId: child.joinsOrderId, parentStatus: parent.status },
        hint: "The buyer paid a join fee rather than postage, so the platform covers most of this label. Book it as normal.",
      });
      // Clear the link so nothing tries again, and flag it for the seller.
      tx.update(childRef, {
        joinsOrderId: null,
        joinFailed: "The other parcel was already sent",
      });
      return { joined: false, reason: "Parcel already labelled" };
    }

    // Same buyer and seller, or something has gone badly wrong upstream.
    if (parent.buyerUid !== child.buyerUid || parent.sellerUid !== child.sellerUid) {
      return { joined: false, reason: "Parcel belongs to a different buyer or seller" };
    }

    const now = Date.now();
    const items = [...(parent.items ?? []), ...(child.items ?? [])];

    // Money adds up rather than being recomputed. Each order was charged its
    // own commission when it settled, at whatever rate applied then, and
    // combining two parcels is not an occasion to re-price either of them.
    // The child contributes its join fee, not a second postage charge.
    tx.update(parentRef, {
      items,
      subtotal: round2((parent.subtotal || 0) + (child.subtotal || 0)),
      total: round2((parent.total || 0) + (child.total || 0)),
      // The child's join fee is money collected toward this parcel, so it
      // belongs on the parcel's shipping line. Booking keeps it with the
      // platform (it bought the label), which is what pays for the extra
      // weight the join added.
      shipping: round2((parent.shipping || 0) + (child.shipping || 0)),
      platformFee: round2((parent.platformFee || 0) + (child.platformFee || 0)),
      sstAmount: round2((parent.sstAmount || 0) + (child.sstAmount || 0)),
      sellerPayout: round2((parent.sellerPayout || 0) + (child.sellerPayout || 0)),
      joinedOrderIds: [...(parent.joinedOrderIds ?? []), orderId],
      // The parcel is heavier now, so the quote that priced it no longer
      // describes it. Booking re-quotes from scratch; these are cleared so
      // nothing downstream trusts a stale figure.
      shippingQuotedRate: null,
      shippingWeightKg: null,
      updatedAt: now,
    });

    tx.update(childRef, {
      status: "cancelled",
      cancelledAt: now,
      cancelReason: `Combined into order ${child.joinsOrderId.slice(0, 8)}`,
      mergedInto: child.joinsOrderId,
    });

    return { joined: true, into: child.joinsOrderId };
  });
};

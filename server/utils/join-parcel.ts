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
import { isOpenParcel, JOIN_FEE_MYR } from "~/shared/order-joining";
import { findOpenParcelFor } from "~/server/utils/open-parcel";
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

    if (child.mergedInto) return { joined: false, reason: "Already joined" };

    // The link, or the fact that we charged as if there were one.
    //
    // joinsOrderId comes from the browser, and the browser dropped it: the
    // cart held it to render "ships with your existing order" and never
    // forwarded it to the order document. Every joined order was billed
    // RM 1.25 and then given a full label of its own.
    //
    // So the shipping figure is treated as the authority instead. It is
    // written by /api/shipping/quote, which is the same server code that
    // decided a parcel was open — if it charged a join fee, a join was
    // promised, and the client cannot lose that promise on the way here.
    const parentId: string | null =
      child.joinsOrderId ??
      (round2(child.shipping ?? 0) === JOIN_FEE_MYR
        ? (await findOpenParcelFor(db, {
            buyerUid: child.buyerUid,
            sellerUid: child.sellerUid,
            destination: child.deliveryAddress ?? {},
          }))?.id ?? null
        : null);

    if (!parentId) {
      // Charged a join fee with nothing to join is money we undercharged, so
      // it is reported rather than shrugged off.
      if (round2(child.shipping ?? 0) === JOIN_FEE_MYR) {
        noteError({
          area: "shipping",
          severity: "error",
          code: "parcel.join_target_missing",
          message:
            `Order ${orderId.slice(0, 8)} was charged the RM ${JOIN_FEE_MYR.toFixed(2)} ` +
            `join fee but no open parcel could be found to combine it with.`,
          orderId,
          hint: "It will ship on its own label at mostly platform cost. Combine by hand if the other parcel is still unlabelled.",
        });
      }
      return { joined: false, reason: "Not a joining order" };
    }

    const parentRef = db.collection("compiledOrders").doc(parentId);
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
          `${parentId.slice(0, 8)}, but that parcel was labelled first.`,
        orderId,
        context: { parentId, parentStatus: parent.status },
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
      cancelReason: `Combined into order ${parentId.slice(0, 8)}`,
      mergedInto: parentId,
    });

    return { joined: true, into: parentId };
  });
};

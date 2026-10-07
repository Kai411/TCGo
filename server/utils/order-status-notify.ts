// Telling the buyer and seller that an order moved: shipped or delivered.
//
// An order can reach the same status from two places (the courier's scan via
// /api/shipping/track, or a person pressing a button in the browser), and
// both pages poll. So each (order, status) is announced at most once: the
// first caller creates `orderStatusEvents/{orderId}_{status}` and only that
// caller notifies. `create()` fails if the doc exists, which makes the check
// and the claim one atomic step.

import type { Firestore } from "firebase-admin/firestore";
import { notify } from "~/server/utils/notify";
import { noteError } from "~/server/utils/oplog";
import { orderDeliveredBuyer, orderDeliveredSeller, orderShipped } from "~/shared/notifications";
import { announcedStatus } from "~/shared/push";

const EVENTS = "orderStatusEvents";

export const announceOrderStatus = async (
  db: Firestore,
  orderId: string,
  order: { status?: string; buyerUid?: string; sellerUid?: string; sellerName?: string; buyerName?: string; shippingCarrier?: string; shippingCourier?: string },
): Promise<boolean> => {
  const status = announcedStatus(order?.status);
  if (!status) return false;
  try {
    await db.collection(EVENTS).doc(`${orderId}_${status}`).create({ orderId, status, at: Date.now() });
  } catch (e: any) {
    // ALREADY_EXISTS: someone announced it first. Anything else: log and stop,
    // since telling people twice is worse than not at all.
    if (e?.code !== 6) {
      noteError({
        area: "notification",
        severity: "warning",
        code: "notification.status_claim_failed",
        message: `Couldn't record the ${status} announcement for an order: ${e?.message || e}`,
        orderId,
      });
    }
    return false;
  }

  if (status === "shipped") {
    await notify(
      db,
      order.buyerUid,
      orderShipped({
        orderId,
        sellerName: order.sellerName,
        courier: order.shippingCarrier || order.shippingCourier,
      }),
    );
  } else {
    await Promise.all([
      notify(db, order.buyerUid, orderDeliveredBuyer({ orderId })),
      notify(db, order.sellerUid, orderDeliveredSeller({ orderId, buyerName: order.buyerName })),
    ]);
  }
  return true;
};

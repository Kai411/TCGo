// Writing a notification, from the server only.
//
// Every caller is a route that has just done the thing being announced, so
// the notification is a side effect of an event that already happened rather
// than a request someone made. That ordering matters: notify() must never be
// able to fail the operation it describes.
//
// FAILURE IS SWALLOWED, DELIBERATELY.
// A payment that settled and a parcel that was combined are done. If the
// notification write fails, the seller misses a bell — annoying. If it throws
// and takes the webhook down with it, Billplz retries a settled payment.
// Losing a bell is strictly better, so failures are logged and dropped.

import type { Firestore } from "firebase-admin/firestore";
import type { DraftNotification } from "~/shared/notifications";
import { noteError } from "~/server/utils/oplog";

const COLLECTION = "notifications";

/**
 * @param userUid who to tell. No-ops when absent rather than throwing —
 *        callers pull this off an order, and an order missing its seller is
 *        already a bigger problem than a missing bell.
 */
export const notify = async (
  db: Firestore,
  userUid: string | undefined | null,
  draft: DraftNotification,
): Promise<void> => {
  if (!userUid) return;
  try {
    await db.collection(COLLECTION).add({
      userUid,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      href: draft.href ?? null,
      meta: draft.meta ?? {},
      readAt: null,
      createdAt: Date.now(),
    });
  } catch (e: any) {
    noteError({
      area: "notification",
      severity: "warning",
      code: "notification.write_failed",
      message: `Couldn't write a ${draft.kind} notification: ${e?.message || e}`,
      userUid,
      context: { kind: draft.kind },
      hint: "The underlying event still succeeded — only the bell was lost.",
    });
  }
};

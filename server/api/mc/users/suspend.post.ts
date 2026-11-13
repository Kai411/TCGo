// Suspend or restore a member's selling.
//
// Suspending sets users/{uid}.sellingSuspended (the rules' seller gate then
// refuses their new listings and edits, and create-bill refuses payments to
// them) and hides every live listing and auction they have, marked
// hiddenVia: "suspension". Lifting it clears the flag and brings back only
// those listings: one staff hid directly stays hidden.
//
// Buying, chat and their account are untouched. This stops selling, nothing
// else, so a seller can still answer buyers about open orders.

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { notify } from "~/server/utils/notify";
import {
  cleanModerationMessage,
  sellingRestoredNotice,
  sellingSuspendedNotice,
} from "~/shared/moderation";

// Firestore batches cap at 500 writes; stay well under.
const BATCH = 400;

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "listings.moderate");
  const body = (await readBody(event)) as {
    uid?: string;
    suspended?: boolean;
    message?: string;
    reportId?: string;
  };

  const uid = String(body?.uid || "").trim();
  if (!uid || uid.includes("/")) throw createError({ statusCode: 400, message: "uid required" });
  const suspend = body?.suspended !== false;
  const message = cleanModerationMessage(body?.message);
  if (suspend && !message) {
    throw createError({
      statusCode: 400,
      message: "Write a line for the seller saying why. They'll see it in their notifications.",
    });
  }

  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw createError({ statusCode: 404, message: "Member not found" });
  const profile = userSnap.data() as any;
  const name: string = profile.customName || profile.displayName || uid;

  if (suspend && profile.sellingSuspended === true) {
    throw createError({ statusCode: 409, message: "This member's selling is already suspended." });
  }
  if (!suspend && profile.sellingSuspended !== true) {
    throw createError({ statusCode: 409, message: "This member's selling isn't suspended." });
  }

  // The flag first: once it's set, the seller can't relist or edit while the
  // listings are being hidden, so nothing slips through between the writes.
  const now = Date.now();
  if (suspend) {
    await userRef.update({
      sellingSuspended: true,
      sellingSuspendedReason: message,
      sellingSuspendedAt: now,
      sellingSuspendedBy: actor.staffId,
    });
  } else {
    await userRef.update({
      sellingSuspended: false,
      sellingSuspendedReason: FieldValue.delete(),
      sellingSuspendedAt: FieldValue.delete(),
      sellingSuspendedBy: FieldValue.delete(),
    });
  }

  // Their listings. A seller has tens, not thousands, so one read per
  // collection is fine; sold and deleted ones are left as they are.
  const [cards, auctions] = await Promise.all([
    db.collection("cards").where("sellerUid", "==", uid).get(),
    db.collection("auctions").where("sellerUid", "==", uid).get(),
  ]);
  const docs = [...cards.docs, ...auctions.docs];

  const targets = suspend
    ? docs.filter((d) => {
        const l = d.data() as any;
        return l.hidden !== true && !l.sold && l.deletedAt == null;
      })
    : docs.filter((d) => {
        const l = d.data() as any;
        return l.hidden === true && l.hiddenVia === "suspension";
      });

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = db.batch();
    for (const d of targets.slice(i, i + BATCH)) {
      batch.update(
        d.ref,
        suspend
          ? {
              hidden: true,
              hiddenReason: "seller_suspended",
              hiddenMessage: message,
              hiddenAt: now,
              hiddenBy: actor.staffId,
              hiddenVia: "suspension",
            }
          : {
              hidden: false,
              hiddenReason: FieldValue.delete(),
              hiddenMessage: FieldValue.delete(),
              hiddenAt: FieldValue.delete(),
              hiddenBy: FieldValue.delete(),
              hiddenVia: FieldValue.delete(),
            },
      );
    }
    await batch.commit();
  }

  const reportId = String(body?.reportId || "").trim();
  if (reportId && !reportId.includes("/")) {
    await db
      .collection("reports")
      .doc(reportId)
      .update({ actionsTaken: FieldValue.arrayUnion(suspend ? "seller_suspended" : "seller_restored") })
      .catch(() => {});
  }

  await notify(
    db,
    uid,
    suspend
      ? sellingSuspendedNotice({ message, hiddenCount: targets.length })
      : sellingRestoredNotice({ restoredCount: targets.length }),
  );

  noteAction({
    area: "moderation",
    action: suspend ? "seller.suspended" : "seller.restored",
    actor,
    subject: uid,
    summary: suspend
      ? `Suspended selling for ${name} and hid ${targets.length} listing${targets.length === 1 ? "" : "s"}.`
      : `Lifted the selling suspension for ${name} and restored ${targets.length} listing${targets.length === 1 ? "" : "s"}.`,
    detail: { uid, message, listings: targets.length, reportId: reportId || null },
    event,
  });

  return { ok: true, suspended: suspend, listings: targets.length };
});

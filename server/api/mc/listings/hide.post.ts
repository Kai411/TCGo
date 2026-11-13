// Hide or restore a listing (a shop card or an auction).
//
// Hiding writes the hidden* fields with the Admin SDK; the rules stop the
// seller setting or clearing them. A hidden listing drops off the
// marketplace, can't be added to a cart, and create-bill refuses to take
// payment for it (shared/moderation.ts says where each check lives).
//
// Restoring only undoes a hide staff made directly. A listing hidden by a
// seller suspension comes back when the suspension is lifted, so the two
// actions can't fight over the same listing.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { notify } from "~/server/utils/notify";
import { FieldValue } from "firebase-admin/firestore";
import {
  LISTING_COLLECTION,
  cleanModerationMessage,
  isListingReportType,
  listingHiddenNotice,
  listingReasonLabel,
  listingRestoredNotice,
  type ListingKind,
} from "~/shared/moderation";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "listings.moderate");
  const body = (await readBody(event)) as {
    kind?: string;
    id?: string;
    hidden?: boolean;
    reason?: string;
    message?: string;
    reportId?: string;
  };

  const kind: ListingKind | null =
    body?.kind === "auction" ? "auction" : body?.kind === "card" ? "card" : null;
  const id = String(body?.id || "").trim();
  if (!kind || !id || id.includes("/")) {
    throw createError({ statusCode: 400, message: "Which listing? Send kind and id." });
  }
  const hide = body?.hidden !== false;
  const reason = isListingReportType(body?.reason) ? body!.reason! : "listing_other";
  const message = cleanModerationMessage(body?.message);
  if (hide && !message) {
    throw createError({
      statusCode: 400,
      message: "Write a line for the seller saying why. They'll see it in their notifications.",
    });
  }

  const db = getAdminFirestore();
  const ref = db.collection(LISTING_COLLECTION[kind]).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Listing not found" });
  const listing = snap.data() as any;
  const title: string = listing.cardName || listing.title || "this listing";

  if (hide) {
    if (listing.hidden === true) {
      throw createError({ statusCode: 409, message: "This listing is already hidden." });
    }
    await ref.update({
      hidden: true,
      hiddenReason: reason,
      hiddenMessage: message,
      hiddenAt: Date.now(),
      hiddenBy: actor.staffId,
      hiddenVia: "staff",
    });
  } else {
    if (listing.hidden !== true) {
      throw createError({ statusCode: 409, message: "This listing isn't hidden." });
    }
    if (listing.hiddenVia === "suspension") {
      throw createError({
        statusCode: 409,
        message: "This listing was hidden by the seller's suspension. Lift the suspension to bring it back.",
      });
    }
    await ref.update({
      hidden: false,
      hiddenReason: FieldValue.delete(),
      hiddenMessage: FieldValue.delete(),
      hiddenAt: FieldValue.delete(),
      hiddenBy: FieldValue.delete(),
      hiddenVia: FieldValue.delete(),
    });
  }

  // Record it on the report it came from, so the queue shows what was done.
  const reportId = String(body?.reportId || "").trim();
  if (reportId && !reportId.includes("/")) {
    await db
      .collection("reports")
      .doc(reportId)
      .update({ actionsTaken: FieldValue.arrayUnion(hide ? "listing_hidden" : "listing_restored") })
      .catch(() => {});
  }

  await notify(
    db,
    listing.sellerUid,
    hide
      ? listingHiddenNotice({ kind, id, title, reason, message })
      : listingRestoredNotice({ kind, id, title }),
  );

  noteAction({
    area: "moderation",
    action: hide ? "listing.hidden" : "listing.restored",
    actor,
    subject: `${kind}:${id}`,
    summary: hide
      ? `Hid ${kind} "${title}" by ${listing.seller || listing.sellerUid} (${listingReasonLabel(reason)}).`
      : `Restored ${kind} "${title}" by ${listing.seller || listing.sellerUid}.`,
    detail: { kind, id, sellerUid: listing.sellerUid, reason: hide ? reason : null, message, reportId: reportId || null },
    event,
  });

  return { ok: true, hidden: hide };
});

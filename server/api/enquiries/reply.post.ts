// The member answers back on their own open enquiry.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { appendEnquiryMessage, enquiryRef } from "~/server/utils/enquiries";
import { canAddMessage, checkEnquiryMessage, statusAfterMessage } from "~/shared/enquiries";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as { enquiryId?: string; message?: string };
  const msg = checkEnquiryMessage(body?.message);
  if ("error" in msg) throw createError({ statusCode: 400, message: msg.error });

  const db = getAdminFirestore();
  const ref = enquiryRef(db, body?.enquiryId ?? "");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const e = snap.data() as any;
    // Someone else's enquiry reads as missing, not forbidden.
    if (!snap.exists || e.userUid !== caller.uid) {
      throw createError({ statusCode: 404, message: "Enquiry not found" });
    }
    const allowed = canAddMessage(e);
    if (!allowed.ok) throw createError({ statusCode: 409, message: allowed.reason });
    const now = Date.now();
    tx.update(ref, {
      messages: appendEnquiryMessage(e.messages, { by: "member", text: msg.text, at: now }),
      status: statusAfterMessage("member"),
      updatedAt: now,
    });
  });
  return { ok: true };
});

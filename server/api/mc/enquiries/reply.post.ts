// Staff reply to an enquiry, close it, or both.
//
// The member sees the reply in their enquiry history and gets a bell (and a
// push, if they've turned those on). No email: TCGo's mail sending isn't
// verified yet, and the bell is the record either way.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { notify } from "~/server/utils/notify";
import { appendEnquiryMessage, enquiryRef } from "~/server/utils/enquiries";
import { canAddMessage, checkEnquiryMessage, statusAfterMessage } from "~/shared/enquiries";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "reports.resolve");
  const body = (await readBody(event)) as { enquiryId?: string; message?: string; close?: boolean };
  const close = body?.close === true;
  const hasText = String(body?.message ?? "").trim().length > 0;
  if (!hasText && !close) throw createError({ statusCode: 400, message: "Write a reply, or close it." });
  const msg = hasText ? checkEnquiryMessage(body?.message) : null;
  if (msg && "error" in msg) throw createError({ statusCode: 400, message: msg.error });

  const db = getAdminFirestore();
  const ref = enquiryRef(db, body?.enquiryId ?? "");
  const now = Date.now();
  const userUid = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw createError({ statusCode: 404, message: "Enquiry not found" });
    const e = snap.data() as any;
    if (e.status === "closed") throw createError({ statusCode: 409, message: "This enquiry is already closed." });
    const update: Record<string, unknown> = { updatedAt: now };
    if (msg) {
      const allowed = canAddMessage(e);
      if (!allowed.ok) throw createError({ statusCode: 409, message: allowed.reason });
      update.messages = appendEnquiryMessage(e.messages, {
        by: "tcgo",
        text: msg.text,
        at: now,
        staffId: actor.staffId,
        staffName: actor.name ?? null,
      });
      update.status = statusAfterMessage("tcgo");
    }
    if (close) {
      update.status = "closed";
      update.closedAt = now;
    }
    tx.update(ref, update);
    return e.userUid as string;
  });

  if (msg) {
    await notify(db, userUid, {
      kind: "enquiry_reply",
      title: "TCGo replied to your enquiry",
      body: msg.text.slice(0, 200),
      href: "/account/help/enquiries",
      meta: { enquiryId: ref.id },
    });
  }

  noteAction({
    area: "support",
    action: msg ? (close ? "enquiry.replied_closed" : "enquiry.replied") : "enquiry.closed",
    actor,
    subject: ref.id,
    summary: msg ? `Replied to enquiry ${ref.id}${close ? " and closed it" : ""}.` : `Closed enquiry ${ref.id}.`,
    event,
  });

  return { ok: true };
});

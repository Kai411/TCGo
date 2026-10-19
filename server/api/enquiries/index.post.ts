// A member drops us an enquiry from the Help Center.
//
// Signed-in only, so staff know who is asking and the reply has somewhere to
// go (the member's enquiry history and bell). Signed-out visitors email us.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { ENQUIRIES } from "~/server/utils/enquiries";
import { ENQUIRY_OPEN_MAX, validateEnquiry } from "~/shared/enquiries";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const valid = validateEnquiry(await readBody(event));
  if ("error" in valid) throw createError({ statusCode: 400, message: valid.error });

  const db = getAdminFirestore();
  const open = await db
    .collection(ENQUIRIES)
    .where("userUid", "==", caller.uid)
    .where("status", "==", "open")
    .limit(ENQUIRY_OPEN_MAX)
    .get();
  if (open.size >= ENQUIRY_OPEN_MAX) {
    throw createError({
      statusCode: 429,
      message: `You have ${ENQUIRY_OPEN_MAX} enquiries waiting for a reply. We'll get to those first.`,
    });
  }

  // Name and email as they were when asked, for staff. The profile's own
  // display name wins over the sign-in provider's.
  const profile = (await db.collection("users").doc(caller.uid).get()).data() as any;
  const now = Date.now();
  const ref = await db.collection(ENQUIRIES).add({
    userUid: caller.uid,
    userName: profile?.displayName || caller.name || null,
    userEmail: caller.email || null,
    topic: valid.topic,
    orderRef: valid.orderRef,
    status: "open",
    messages: [{ by: "member", text: valid.text, at: now }],
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  });
  return { id: ref.id };
});

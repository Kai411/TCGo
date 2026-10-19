// The signed-in member's own enquiries, newest activity first.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { ENQUIRIES, toMemberEnquiry } from "~/server/utils/enquiries";
import { sortEnquiries } from "~/shared/enquiries";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const snap = await getAdminFirestore()
    .collection(ENQUIRIES)
    .where("userUid", "==", caller.uid)
    .limit(100)
    .get();
  return { enquiries: sortEnquiries(snap.docs.map(toMemberEnquiry)) };
});

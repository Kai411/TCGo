// Staff: members' enquiries. Waiting ones first, then by latest activity.
//
// ?status=closed shows the closed ones instead; the default is everything
// still open or answered, so a reply that went unread by the member stays in
// view until someone closes it.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { ENQUIRIES } from "~/server/utils/enquiries";
import { enquiryTopicLabel, sortEnquiries } from "~/shared/enquiries";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "reports.view");
  const closed = getQuery(event).status === "closed";
  const snap = await getAdminFirestore()
    .collection(ENQUIRIES)
    .where("status", "in", closed ? ["closed"] : ["open", "answered"])
    .limit(200)
    .get();

  const enquiries = snap.docs.map((d) => {
    const e = d.data() as any;
    return {
      id: d.id,
      status: e.status,
      topic: enquiryTopicLabel(e.topic),
      orderRef: e.orderRef ?? null,
      userUid: e.userUid,
      userName: e.userName ?? null,
      userEmail: e.userEmail ?? null,
      messages: (e.messages ?? []).map((m: any) => ({
        by: m.by,
        text: m.text,
        at: m.at,
        staffName: m.staffName ?? null,
      })),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  });
  return { enquiries: sortEnquiries(enquiries, true) };
});

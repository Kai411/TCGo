// Reports for the console.
//
// Served from the server rather than read from the browser because a staff
// account has no Firebase identity at all — the Firestore rules gate reports
// on isAdmin(), which a staff session can never satisfy. Without this route
// the Staff role could see a Reports tab it was structurally unable to load.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "reports.view");

  const snap = await getAdminFirestore()
    .collection("reports")
    .orderBy("createdAt", "desc")
    .limit(300)
    .get();

  return {
    reports: snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
  };
});

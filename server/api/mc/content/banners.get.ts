// Both listing banners for the Content page, hidden or not.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { BANNER_PLACEMENTS, emptyBanner } from "~/shared/site-content";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "content.manage");
  const db = getAdminFirestore();
  const snaps = await db.getAll(...BANNER_PLACEMENTS.map((p) => db.collection("banners").doc(p)));
  return {
    banners: Object.fromEntries(
      snaps.map((s) => [s.id, { ...emptyBanner(), ...((s.data() as any) || {}) }]),
    ),
  };
});

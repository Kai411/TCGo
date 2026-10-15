import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { loadRoles, requireStaff } from "~/server/utils/staff-auth";
import { PERMISSIONS } from "~/shared/staff";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "staff.view");
  const db = getAdminFirestore();
  const roles = await loadRoles(db);

  // How many people each role covers — deleting a role with holders is the
  // mistake this is here to prevent, and showing the count beats an error.
  const staffSnap = await db.collection("staff").get();
  const counts = staffSnap.docs.reduce<Record<string, number>>((acc, d) => {
    const r = (d.data() as any).roleId;
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return {
    catalogue: PERMISSIONS,
    roles: roles.map((r) => ({ ...r, memberCount: counts[r.id] || 0 })),
  };
});

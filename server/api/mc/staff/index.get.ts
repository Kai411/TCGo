import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { effectivePermissions, loadRoles, requireStaff } from "~/server/utils/staff-auth";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "staff.view");
  const db = getAdminFirestore();

  const [snap, roles] = await Promise.all([
    db.collection("staff").orderBy("staffId").get(),
    loadRoles(db),
  ]);
  const roleById = new Map(roles.map((r) => [r.id, r]));

  return {
    roles,
    staff: snap.docs.map((d) => {
      const s = d.data() as any;
      const role = roleById.get(s.roleId) ?? null;
      return {
        staffId: d.id,
        name: s.name ?? d.id,
        email: s.email ?? null,
        roleId: s.roleId,
        roleName: role?.name ?? s.roleId,
        active: s.active !== false,
        mustChangePassword: !!s.mustChangePassword,
        createdAt: s.createdAt ?? null,
        createdBy: s.createdBy ?? null,
        lastLoginAt: s.lastLoginAt ?? null,
        lockedUntil: s.lockedUntil ?? null,
        extraPermissions: s.extraPermissions ?? [],
        deniedPermissions: s.deniedPermissions ?? [],
        // Resolved server-side so the UI shows what the server will actually
        // enforce, rather than re-deriving it and possibly disagreeing.
        permissions: effectivePermissions(role, s),
      };
      // passwordHash is never in this projection. Not "filtered in the UI" —
      // it never leaves the server.
    }),
  };
});

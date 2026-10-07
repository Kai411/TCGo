// Who am I, and what may I do.
//
// The permission list returned here drives what the console renders. That is a
// convenience only — every route re-checks with requireStaff, because a list
// sent to a browser is a list the browser can edit.

import { optionalStaff } from "~/server/utils/staff-auth";
import { PERMISSIONS } from "~/shared/staff";

export default defineEventHandler(async (event) => {
  const who = await optionalStaff(event);
  if (!who) return { signedIn: false as const };
  return {
    signedIn: true as const,
    staffId: who.staffId,
    name: who.name,
    roleId: who.roleId,
    roleName: who.roleName,
    permissions: who.permissions,
    legacy: who.legacy,
    catalogue: PERMISSIONS,
  };
});

// Whether the 24-hour hold after a password change is on, so the screens
// can say "locked until" before someone fills in a form. The routes that
// move money check again for themselves; this is only for display.

import { requireUser } from "~/server/utils/auth";
import { getLockedUntil } from "~/server/utils/security-lock";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  return { lockedUntil: await getLockedUntil(caller.uid) };
});

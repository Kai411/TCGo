// Which kinds of push the signed-in member wants, and whether push is
// available at all (it isn't until the VAPID keys are configured).

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { pushConfigured, readPushPrefs } from "~/server/utils/push";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const prefs = await readPushPrefs(getAdminFirestore(), caller.uid);
  return { available: pushConfigured(), prefs };
});

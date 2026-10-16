// Switch a kind of push on or off for every device the member has.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { SETTINGS, readPushPrefs } from "~/server/utils/push";
import { pickPushPrefs } from "~/shared/push";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const changes = pickPushPrefs(await readBody(event));
  const db = getAdminFirestore();
  if (Object.keys(changes).length) {
    await db
      .collection(SETTINGS)
      .doc(caller.uid)
      .set({ ...changes, updatedAt: Date.now() }, { merge: true });
  }
  return { prefs: await readPushPrefs(db, caller.uid) };
});

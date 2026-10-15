// Stop pushes to this browser. Called when push is turned off and before
// signing out, so a device stops getting a member's notifications once
// they've left it.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { SUBSCRIPTIONS, subscriptionId } from "~/server/utils/push";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as { endpoint?: string };
  const endpoint = String(body?.endpoint || "");
  if (!endpoint) return { ok: true };

  const ref = getAdminFirestore().collection(SUBSCRIPTIONS).doc(subscriptionId(endpoint));
  const snap = await ref.get();
  // Only your own: knowing an endpoint mustn't let you switch off someone else's.
  if (snap.exists && snap.data()?.uid === caller.uid) await ref.delete();
  return { ok: true };
});

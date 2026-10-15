// Register this browser to receive pushes for the signed-in member.
//
// Keyed by the endpoint, not the member: on a shared shop device the next
// person to sign in and turn push on takes the subscription over, so the
// previous seller's orders stop arriving on a phone that isn't theirs.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { SUBSCRIPTIONS, pushConfigured, subscriptionId } from "~/server/utils/push";
import { parsePushSubscription } from "~/shared/push";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  if (!pushConfigured()) {
    throw createError({ statusCode: 503, message: "Push notifications aren't set up yet" });
  }
  const body = (await readBody(event)) as { subscription?: unknown };
  const sub = parsePushSubscription(body?.subscription);
  if (!sub) throw createError({ statusCode: 400, message: "That browser subscription isn't valid" });

  const db = getAdminFirestore();
  const ref = db.collection(SUBSCRIPTIONS).doc(subscriptionId(sub.endpoint));
  const now = Date.now();
  const existing = await ref.get();
  await ref.set({
    uid: caller.uid,
    endpoint: sub.endpoint,
    keys: sub.keys,
    createdAt: existing.exists && existing.data()?.uid === caller.uid ? existing.data()?.createdAt ?? now : now,
    updatedAt: now,
  });
  return { ok: true };
});

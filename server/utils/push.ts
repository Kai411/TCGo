// Sending a push to everything a member has switched notifications on for.
//
// One member can have several devices (a phone, a laptop, the installed app),
// each with its own subscription in `pushSubscriptions`. Their on/off choices
// per category live in `pushSettings/{uid}`. Both collections are server-only:
// the Firestore rules' deny-all covers them, and every read and write goes
// through /api/push/*.
//
// FAILURE IS SWALLOWED, LIKE notify().
// A push describes something that already happened. If the push service is
// down, the member misses a buzz; the message, order or bid still stands.
//
// NOT CONFIGURED = SILENT.
// Without VAPID keys nothing is sent and nothing fails, so the app works the
// same before the keys are added to Netlify as it did before this existed.

import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import webpush from "web-push";
import { noteError } from "~/server/utils/oplog";
import {
  normalizePushPrefs,
  type PushCategory,
  type PushPayload,
  type PushPrefs,
} from "~/shared/push";

export const SUBSCRIPTIONS = "pushSubscriptions";
export const SETTINGS = "pushSettings";

/** Long enough to reach a phone that was off overnight, short enough that a stale "you were outbid" doesn't arrive after the auction. */
const TTL_SECONDS = 12 * 60 * 60;

let configured: boolean | null = null;

export const pushConfigured = (): boolean => {
  if (configured != null) return configured;
  const config = useRuntimeConfig();
  const publicKey = String(config.public.vapidPublicKey || "");
  const privateKey = String(config.vapidPrivateKey || "");
  if (!publicKey || !privateKey) return (configured = false);
  try {
    webpush.setVapidDetails(
      String(config.vapidSubject || "mailto:support@tcgo.shop"),
      publicKey,
      privateKey,
    );
    configured = true;
  } catch (e: any) {
    console.error("[push] VAPID keys rejected:", e?.message || e);
    configured = false;
  }
  return configured;
};

/** Stable doc id for a subscription, so re-subscribing the same browser updates one doc. */
export const subscriptionId = (endpoint: string): string =>
  createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export const readPushPrefs = async (db: Firestore, uid: string): Promise<PushPrefs> => {
  const snap = await db.collection(SETTINGS).doc(uid).get();
  return normalizePushPrefs(snap.data());
};

/**
 * Push to every device `uid` has subscribed, if they want this category.
 *
 * Subscriptions the push service says are gone (404/410: the browser
 * unsubscribed, the app was uninstalled, site data was cleared) are deleted
 * so they aren't retried forever.
 */
export const sendPush = async (
  db: Firestore,
  uid: string | undefined | null,
  category: PushCategory,
  payload: PushPayload,
): Promise<void> => {
  if (!uid || !pushConfigured()) return;
  try {
    const [prefs, subs] = await Promise.all([
      readPushPrefs(db, uid),
      db.collection(SUBSCRIPTIONS).where("uid", "==", uid).limit(10).get(),
    ]);
    if (!prefs[category] || subs.empty) return;

    const body = JSON.stringify(payload);
    const urgency = category === "orders" ? "normal" : "high";
    await Promise.all(
      subs.docs.map(async (d) => {
        const s = d.data();
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            body,
            { TTL: TTL_SECONDS, urgency, topic: payload.tag ? topicFor(payload.tag) : undefined },
          );
        } catch (e: any) {
          const code = e?.statusCode;
          if (code === 404 || code === 410) {
            await d.ref.delete().catch(() => {});
            return;
          }
          throw e;
        }
      }),
    );
  } catch (e: any) {
    noteError({
      area: "notification",
      severity: "warning",
      code: "push.send_failed",
      message: `Couldn't send a ${category} push: ${e?.message || e}`,
      userUid: uid,
      context: { category, statusCode: e?.statusCode ?? null },
      hint: "The event itself still happened — only the push was lost.",
    });
  }
};

/**
 * Web Push topics must be ≤32 URL-safe base64 characters. A topic makes the
 * push service keep only the newest undelivered message per conversation, so
 * a phone that comes back online gets one buzz, not twenty.
 */
const topicFor = (tag: string): string =>
  createHash("sha256").update(tag).digest("base64url").slice(0, 32);

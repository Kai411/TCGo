// Server half of the 24-hour hold after a password change. The rule itself
// lives in shared/security-lock.ts; this reads the two trusted times.

import { getAdminAuth, getAdminFirestore } from "~/server/utils/firebase-admin";
import { lockedUntil, lockMessage } from "~/shared/security-lock";

/** accountSecurity/{uid}: Admin SDK only, no client rule matches it. */
const securityRef = (uid: string) =>
  getAdminFirestore().collection("accountSecurity").doc(uid);

const ms = (utc?: string): number | null => {
  const t = utc ? Date.parse(utc) : NaN;
  return Number.isFinite(t) ? t : null;
};

export const getLockedUntil = async (uid: string, now = Date.now()): Promise<number | null> => {
  const [user, sec] = await Promise.all([
    getAdminAuth().getUser(uid),
    securityRef(uid).get(),
  ]);
  return lockedUntil(
    {
      passwordChangedAt: sec.exists ? (sec.data()?.passwordChangedAt as number) : null,
      tokensValidAfter: ms(user.tokensValidAfterTime),
      createdAt: ms(user.metadata.creationTime),
    },
    now,
  );
};

/** Refuse with a plain "locked until" message while the hold is on. */
export const assertNotLocked = async (uid: string): Promise<void> => {
  const until = await getLockedUntil(uid);
  if (until) {
    throw createError({ statusCode: 423, message: lockMessage(until), data: { lockedUntil: until } });
  }
};

/** Record a password change the server has seen. Only ever moves forward. */
export const recordPasswordChange = async (uid: string, at = Date.now()): Promise<void> => {
  const ref = securityRef(uid);
  await getAdminFirestore().runTransaction(async (tx) => {
    const prev = (await tx.get(ref)).data()?.passwordChangedAt;
    if (typeof prev === "number" && prev >= at) return;
    tx.set(ref, { passwordChangedAt: at }, { merge: true });
  });
};

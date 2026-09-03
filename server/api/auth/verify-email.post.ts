// Confirm an email address with the code that was sent to it.
//
// The client cannot set emailVerified — only the Admin SDK can — which is the
// whole point: the flag means "someone proved they can read mail at this
// address", and a browser is never in a position to prove that.

import { getAdminFirestore, getAdminAuth } from "~/server/utils/firebase-admin";
import { consumeCode, normaliseEmail } from "~/server/utils/auth-codes";

const REFUSAL: Record<string, string> = {
  expired: "That code has expired. Ask for a new one.",
  invalid: "That code isn't right. Check it and try again.",
  exhausted: "Too many wrong attempts. Ask for a new code.",
  none: "That code has expired or was already used. Ask for a new one.",
};

export default defineEventHandler(async (event) => {
  const { email, code } = (await readBody(event)) as { email?: string; code?: string };

  if (!email || !code) {
    throw createError({ statusCode: 400, message: "Email and code are both required." });
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const addr = normaliseEmail(email);

  const result = await consumeCode(db, "verify_email", addr, code.trim());
  if (!result.ok) {
    throw createError({ statusCode: 400, message: REFUSAL[result.reason] ?? REFUSAL.invalid });
  }

  // The code is spent by this point. From here failures are ours, not the
  // user's, so they get a 500 rather than "wrong code" — being told the code
  // was wrong after typing it correctly is how people conclude the product is
  // broken.
  const user = await auth.getUserByEmail(addr).catch(() => null);
  if (!user) {
    throw createError({ statusCode: 404, message: "That account no longer exists." });
  }

  if (!user.emailVerified) {
    await auth.updateUser(user.uid, { emailVerified: true });
    await db
      .collection("users")
      .doc(user.uid)
      .set({ emailVerified: true, emailVerifiedAt: Date.now() }, { merge: true });
  }

  return { verified: true };
});

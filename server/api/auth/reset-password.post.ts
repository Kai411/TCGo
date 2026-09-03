// Set a new password using a code sent to the account's email address.
//
// Two things happen beyond writing the password, and both matter:
//
//   Sessions are revoked. Whoever prompted this reset may be someone who got
//   into the account — leaving their existing session alive would hand them
//   continued access to an account whose password just changed under them.
//
//   The address is marked verified. Reading the code proves control of the
//   mailbox just as firmly as the signup code does, so an account that resets
//   its password is not then asked to prove the same thing again.

import { getAdminFirestore, getAdminAuth } from "~/server/utils/firebase-admin";
import { consumeCode, normaliseEmail } from "~/server/utils/auth-codes";
import { noteAction } from "~/server/utils/oplog";

/** Firebase's own floor is 6; this is deliberately above it. */
export const MIN_PASSWORD_LENGTH = 8;

const REFUSAL: Record<string, string> = {
  expired: "That code has expired. Ask for a new one.",
  invalid: "That code isn't right. Check it and try again.",
  exhausted: "Too many wrong attempts. Ask for a new code.",
  none: "That code has expired or was already used. Ask for a new one.",
};

export default defineEventHandler(async (event) => {
  const { email, code, password } = (await readBody(event)) as {
    email?: string;
    code?: string;
    password?: string;
  };

  if (!email || !code || !password) {
    throw createError({
      statusCode: 400,
      message: "Email, code and a new password are all required.",
    });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const addr = normaliseEmail(email);

  const result = await consumeCode(db, "reset_password", addr, code.trim());
  if (!result.ok) {
    throw createError({ statusCode: 400, message: REFUSAL[result.reason] ?? REFUSAL.invalid });
  }

  const user = await auth.getUserByEmail(addr).catch(() => null);
  if (!user) {
    throw createError({ statusCode: 404, message: "That account no longer exists." });
  }

  await auth.updateUser(user.uid, { password, emailVerified: true });
  await auth.revokeRefreshTokens(user.uid);

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      { emailVerified: true, emailVerifiedAt: Date.now(), passwordChangedAt: Date.now() },
      { merge: true },
    );

  noteAction({
    area: "auth",
    action: "auth.password_reset",
    // The account holder acted on their own account; there is no staff
    // principal here, so the uid is the actor.
    actor: user.uid,
    subject: user.uid,
    summary: "Password reset by emailed code; existing sessions revoked.",
    event,
  });

  return { reset: true };
});

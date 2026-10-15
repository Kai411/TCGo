// Send a verification or password-reset code.
//
// THE REPLY IS ALWAYS THE SAME.
// Whether the address has an account, whether it is already verified, whether
// mail was actually sent — the caller is told "if that address is registered,
// a code is on its way". Anything else turns this route into a way to ask
// "does this person have a TCGo account?", which is exactly the question a
// login form must never answer.
//
// The one exception is the rate limit, which has to be visible or the user
// sits waiting for an email that was never sent. It leaks only that *someone*
// asked for a code for that address recently, which the requester already
// knows because it was probably them.

import { getAdminFirestore, getAdminAuth } from "~/server/utils/firebase-admin";
import { issueCode, normaliseEmail, RateLimited } from "~/server/utils/auth-codes";
import { sendVerificationCode, sendPasswordResetCode } from "~/server/utils/auth-email";
import { mailConfigured } from "~/server/utils/mail";
import { noteError } from "~/server/utils/oplog";

const SAME_ANSWER = {
  sent: true,
  message: "If that address is registered, a code is on its way.",
};

export default defineEventHandler(async (event) => {
  const { email, purpose } = (await readBody(event)) as {
    email?: string;
    purpose?: "verify_email" | "reset_password";
  };

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw createError({ statusCode: 400, message: "Enter a valid email address." });
  }
  if (purpose !== "verify_email" && purpose !== "reset_password") {
    throw createError({ statusCode: 400, message: "Unknown code purpose." });
  }

  if (!mailConfigured()) {
    // Refusing loudly here rather than pretending: with no mail provider the
    // user would wait forever for a code that cannot arrive.
    throw createError({
      statusCode: 503,
      message: "Email isn't configured yet, so codes can't be sent. Sign in with Google for now.",
    });
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const addr = normaliseEmail(email);

  // Does the account exist? Used only to decide whether to actually send —
  // never to shape the response.
  let exists = false;
  let alreadyVerified = false;
  try {
    const user = await auth.getUserByEmail(addr);
    exists = true;
    alreadyVerified = user.emailVerified;
  } catch {
    exists = false;
  }

  // Nothing to send: no account, or a verification code for an address that
  // is already confirmed. Answer as though we did.
  const pointless =
    (purpose === "reset_password" && !exists) ||
    (purpose === "verify_email" && (!exists || alreadyVerified));
  if (pointless) return SAME_ANSWER;

  let code: string;
  try {
    ({ code } = await issueCode(db, purpose, addr));
  } catch (e) {
    if (e instanceof RateLimited) {
      throw createError({
        statusCode: 429,
        message: `Too many codes requested. Try again in about ${Math.ceil(
          e.retryAfterMs / 60000,
        )} minutes.`,
      });
    }
    throw e;
  }

  const mail =
    purpose === "verify_email"
      ? await sendVerificationCode(addr, code)
      : await sendPasswordResetCode(addr, code);

  if (!mail.sent) {
    // The code exists but the message didn't go. Log it for an operator —
    // silently returning success would strand the user with no way to know.
    noteError({
      area: "auth",
      severity: "error",
      code: "auth.code_email_failed",
      message: `Couldn't email a ${purpose} code: ${mail.reason || "unknown"}`,
      context: { purpose },
      hint: "Check the Mailtrap token and sending domain.",
    });
  }

  return SAME_ANSWER;
});

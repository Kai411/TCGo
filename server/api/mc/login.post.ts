// Staff sign-in.
//
// Two properties this route has to hold, both about what it gives away:
//
//   1. A wrong ID and a wrong password are indistinguishable — same message,
//      same shape, and roughly the same time (see burnPasswordTime). Staff IDs
//      are sequential by design, so an endpoint that confirms A0003 exists
//      hands over the shape of the whole org.
//   2. A locked account says it's locked. That leaks a little, but the
//      alternative is someone locked out at 2am with no idea why, and lockout
//      is only reachable by someone already guessing at a real ID.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import {
  burnPasswordTime,
  createSession,
  lockoutRemainingMs,
  recordFailedLogin,
  verifyPassword,
} from "~/server/utils/staff-auth";
import { noteAction, noteError } from "~/server/utils/oplog";
import { isValidStaffId, normaliseStaffId } from "~/shared/staff";

const GENERIC = "That staff ID and password don't match.";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { staffId?: string; password?: string };
  const staffId = normaliseStaffId(String(body?.staffId || ""));
  const password = String(body?.password || "");

  if (!staffId || !password || !isValidStaffId(staffId)) {
    await burnPasswordTime(password);
    throw createError({ statusCode: 401, message: GENERIC });
  }

  const db = getAdminFirestore();
  const ref = db.collection("staff").doc(staffId);
  const snap = await ref.get();
  const staff = snap.data() as any;

  if (!snap.exists || !staff) {
    await burnPasswordTime(password);
    noteError({
      area: "auth",
      severity: "warning",
      code: "staff.login_unknown_id",
      message: `Sign-in attempted with an unknown staff ID (${staffId}).`,
      context: { staffId },
      hint: "Repeated hits from one address are worth blocking upstream.",
    });
    throw createError({ statusCode: 401, message: GENERIC });
  }

  const locked = lockoutRemainingMs(staff);
  if (locked > 0) {
    throw createError({
      statusCode: 429,
      message: `Too many failed attempts. Try again in ${Math.ceil(locked / 60000)} minute(s).`,
    });
  }

  if (staff.active === false) {
    // Deliberately generic: a deactivated account shouldn't confirm it once
    // existed to whoever now has the password.
    await burnPasswordTime(password);
    throw createError({ statusCode: 401, message: GENERIC });
  }

  const ok = await verifyPassword(password, staff.passwordHash);
  if (!ok) {
    await recordFailedLogin(db, staffId, staff.failedAttempts || 0);
    noteError({
      area: "auth",
      severity: "warning",
      code: "staff.login_failed",
      message: `Failed sign-in for ${staffId}.`,
      context: { staffId, attempt: (staff.failedAttempts || 0) + 1 },
    });
    throw createError({ statusCode: 401, message: GENERIC });
  }

  await createSession(event, db, staffId);
  await ref.update({ failedAttempts: 0, lockedUntil: null, lastLoginAt: Date.now() });

  noteAction({
    area: "auth",
    action: "staff.signed_in",
    actor: { staffId, name: staff.name },
    summary: `${staff.name || staffId} signed in.`,
    event,
  });

  return {
    ok: true,
    // The client re-reads /api/mc/me for permissions; this is just enough to
    // render immediately without a second round trip feeling like a stall.
    staffId,
    name: staff.name || staffId,
    mustChangePassword: !!staff.mustChangePassword,
  };
});

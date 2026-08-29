// Change your own password.
//
// Requires the current one even though the session already proves identity:
// it's what stops an unattended logged-in screen becoming a permanent
// takeover. Other sessions are dropped, this one is reissued.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import {
  createSession,
  hashPassword,
  requireStaff,
  revokeAllSessions,
  verifyPassword,
} from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { passwordProblem } from "~/shared/staff";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event);
  if (actor.legacy) {
    throw createError({
      statusCode: 400,
      message: "You're signed in as a marketplace admin, which has no Mint Condition password.",
    });
  }

  const body = (await readBody(event)) as { current?: string; next?: string };
  const current = String(body?.current || "");
  const next = String(body?.next || "");

  const problem = passwordProblem(next, actor.staffId);
  if (problem) throw createError({ statusCode: 400, message: problem });
  if (next === current) {
    throw createError({ statusCode: 400, message: "That's the password you already have." });
  }

  const db = getAdminFirestore();
  const ref = db.collection("staff").doc(actor.staffId);
  const staff = (await ref.get()).data() as any;

  if (!(await verifyPassword(current, staff?.passwordHash))) {
    throw createError({ statusCode: 401, message: "Your current password isn't right." });
  }

  await ref.update({
    passwordHash: await hashPassword(next),
    mustChangePassword: false,
    passwordChangedAt: Date.now(),
  });

  // Everywhere else is signed out, then this browser gets a fresh session —
  // changing a password should end any session you didn't know about.
  await revokeAllSessions(db, actor.staffId);
  await createSession(event, db, actor.staffId);

  noteAction({
    area: "staff",
    action: "staff.password_changed",
    actor,
    subject: actor.staffId,
    summary: `${actor.name} changed their own password.`,
    event,
  });

  return { ok: true };
});

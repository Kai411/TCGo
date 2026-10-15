// Issue a staff account.
//
// The ID is allocated by the server from a per-prefix counter inside a
// transaction. Deriving it from a count of existing documents would reuse
// A0003 after A0003 is deleted, and a reused ID makes the audit trail lie
// about who did what.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { hashPassword, loadRole, requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { formatStaffId, passwordProblem } from "~/shared/staff";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "staff.manage");
  const body = (await readBody(event)) as {
    name?: string;
    email?: string;
    roleId?: string;
    password?: string;
  };

  const name = String(body?.name || "").trim().slice(0, 120);
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 200);
  const roleId = String(body?.roleId || "").trim();
  const password = String(body?.password || "");

  if (!name) throw createError({ statusCode: 400, message: "Name is required." });
  if (!roleId) throw createError({ statusCode: 400, message: "Pick a role." });

  const db = getAdminFirestore();
  const role = await loadRole(db, roleId);
  if (!role) throw createError({ statusCode: 400, message: "That role doesn't exist." });

  const pwProblem = passwordProblem(password);
  if (pwProblem) throw createError({ statusCode: 400, message: pwProblem });

  const passwordHash = await hashPassword(password);

  // Counter and staff document in one transaction: a crash between them would
  // otherwise either burn an ID or hand the same one out twice.
  const staffId = await db.runTransaction(async (tx) => {
    const counterRef = db.collection("staffCounters").doc(role.prefix);
    const counterSnap = await tx.get(counterRef);
    const next = ((counterSnap.data()?.seq as number) || 0) + 1;

    const id = formatStaffId(role.prefix, next);
    const staffRef = db.collection("staff").doc(id);
    if ((await tx.get(staffRef)).exists) {
      // Only reachable if the counter was rolled back by hand. Refuse rather
      // than overwrite a live account.
      throw createError({ statusCode: 409, message: `${id} already exists.` });
    }

    tx.set(counterRef, { seq: next, prefix: role.prefix }, { merge: true });
    tx.set(staffRef, {
      staffId: id,
      name,
      email: email || null,
      roleId,
      passwordHash,
      active: true,
      // The creator knows this password, so it isn't the holder's yet.
      mustChangePassword: true,
      extraPermissions: [],
      deniedPermissions: [],
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: Date.now(),
      createdBy: actor.staffId,
      lastLoginAt: null,
    });
    return id;
  });

  noteAction({
    area: "staff",
    action: "staff.created",
    actor,
    subject: staffId,
    summary: `Created ${staffId} (${name}) as ${role.name}.`,
    detail: { roleId, email: email || null },
    event,
  });

  return { ok: true, staffId };
});

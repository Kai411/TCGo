// Change a staff account: role, status, password, per-person permissions.
//
// Two guards worth naming:
//
//   Self-lockout — you cannot deactivate yourself or move yourself off a role
//   with staff.manage. An admin who demotes themselves by accident leaves an
//   org with no way back in except the legacy Firebase bridge, and that bridge
//   is meant to be closable.
//
//   Session revocation — deactivating, changing a role, or resetting a
//   password drops every session that person holds. Without it, "revoked"
//   means "revoked in twelve hours", which is not what anyone reads it as.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import {
  effectivePermissions,
  hashPassword,
  loadRole,
  requireStaff,
  revokeAllSessions,
} from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { PERMISSION_KEYS, hasPermission, passwordProblem } from "~/shared/staff";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "staff.manage");
  const body = (await readBody(event)) as {
    staffId?: string;
    name?: string;
    email?: string;
    roleId?: string;
    active?: boolean;
    unlock?: boolean;
    password?: string;
    extraPermissions?: string[];
    deniedPermissions?: string[];
  };

  const staffId = String(body?.staffId || "").trim().toUpperCase();
  if (!staffId) throw createError({ statusCode: 400, message: "staffId required" });

  const db = getAdminFirestore();
  const ref = db.collection("staff").doc(staffId);
  const snap = await ref.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "No such staff account." });
  const current = snap.data() as any;

  const isSelf = staffId === actor.staffId;
  const patch: Record<string, unknown> = {};
  const changes: string[] = [];
  let revoke = false;

  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 120);
    if (patch.name !== current.name) changes.push("name");
  }

  if (typeof body.email === "string") {
    patch.email = body.email.trim().toLowerCase().slice(0, 200) || null;
    if (patch.email !== (current.email ?? null)) changes.push("email");
  }

  if (typeof body.roleId === "string" && body.roleId !== current.roleId) {
    const role = await loadRole(db, body.roleId);
    if (!role) throw createError({ statusCode: 400, message: "That role doesn't exist." });
    if (isSelf && !hasPermission(role.permissions, "staff.manage")) {
      throw createError({
        statusCode: 400,
        message:
          "That role can't manage staff, so moving yourself onto it would lock you out of this page. Ask another admin to do it.",
      });
    }
    patch.roleId = body.roleId;
    changes.push(`role → ${role.name}`);
    // The old role's permissions are cached in every live session.
    revoke = true;
  }

  if (typeof body.active === "boolean" && body.active !== (current.active !== false)) {
    if (isSelf && !body.active) {
      throw createError({
        statusCode: 400,
        message: "You can't deactivate your own account.",
      });
    }
    patch.active = body.active;
    changes.push(body.active ? "reactivated" : "deactivated");
    if (!body.active) revoke = true;
  }

  if (body.password) {
    const problem = passwordProblem(body.password, staffId);
    if (problem) throw createError({ statusCode: 400, message: problem });
    patch.passwordHash = await hashPassword(body.password);
    // Set by someone else, so it isn't the holder's password yet — unless the
    // holder set it themselves.
    patch.mustChangePassword = !isSelf;
    patch.failedAttempts = 0;
    patch.lockedUntil = null;
    changes.push("password reset");
    revoke = true;
  }

  for (const field of ["extraPermissions", "deniedPermissions"] as const) {
    const list = body[field];
    if (!Array.isArray(list)) continue;
    // Only known keys — a typo'd permission stored here would look granted in
    // the UI and deny in practice.
    const clean = [...new Set(list.filter((k) => PERMISSION_KEYS.includes(k)))];
    patch[field] = clean;
    if (JSON.stringify(clean) !== JSON.stringify(current[field] ?? [])) {
      changes.push(field === "extraPermissions" ? "extra permissions" : "denied permissions");
      revoke = true;
    }
  }

  // Guard the self-demotion path that per-person denials also open.
  if (isSelf && (patch.deniedPermissions || patch.roleId)) {
    const role = await loadRole(db, (patch.roleId as string) || current.roleId);
    const next = effectivePermissions(role, { ...current, ...patch });
    if (!hasPermission(next, "staff.manage")) {
      throw createError({
        statusCode: 400,
        message: "That change would remove your own access to staff management.",
      });
    }
  }

  // Unlocking is its own field, not a side effect of toggling `active`.
  //
  // It has to be: an account locked out by five wrong passwords is still
  // `active`, so a request that only flips `active` back on changes nothing
  // and returns "unchanged" — leaving the person locked out with an admin who
  // has just been told the problem is fixed. Handled before the empty-patch
  // return below for the same reason.
  if (body.unlock === true) {
    patch.failedAttempts = 0;
    patch.lockedUntil = null;
    changes.push("unlocked");
  }

  // Reactivating implies unlocking — nobody reactivates an account meaning
  // "let them back in, but not for another quarter of an hour".
  if (body.active === true && current.active === false) {
    patch.failedAttempts = 0;
    patch.lockedUntil = null;
  }

  if (!Object.keys(patch).length) return { ok: true, unchanged: true };

  await ref.update(patch);
  const revoked = revoke ? await revokeAllSessions(db, staffId) : 0;

  noteAction({
    area: "staff",
    action: "staff.updated",
    actor,
    subject: staffId,
    summary: `Updated ${staffId}: ${changes.join(", ") || "no visible change"}.`,
    detail: { changes, sessionsRevoked: revoked },
    event,
  });

  return { ok: true, sessionsRevoked: revoked };
});

// Create a role, or rebind which permissions it carries.
//
// Built-ins can be re-permissioned but keep their id and prefix: IDs already
// issued under "AC" have to keep meaning Accounting, so the prefix is fixed
// once anything has been issued with it.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { loadRoles, requireStaff, revokeAllSessions } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import {
  ALL_PERMISSIONS,
  BUILTIN_ROLE_IDS,
  PERMISSION_KEYS,
  hasPermission,
  isValidPrefix,
} from "~/shared/staff";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "roles.manage");
  const body = (await readBody(event)) as {
    id?: string;
    name?: string;
    prefix?: string;
    description?: string;
    permissions?: string[];
  };

  const id = String(body?.id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!id) throw createError({ statusCode: 400, message: "Role id is required." });

  const db = getAdminFirestore();
  const roles = await loadRoles(db);
  const existing = roles.find((r) => r.id === id) ?? null;
  const isBuiltin = BUILTIN_ROLE_IDS.includes(id);

  const permissions = Array.isArray(body.permissions)
    ? [
        ...new Set(
          body.permissions.filter(
            (k) => k === ALL_PERMISSIONS || PERMISSION_KEYS.includes(k),
          ),
        ),
      ]
    : (existing?.permissions ?? []);

  // Don't let the last door close. If this role is the only one that can
  // manage staff and it's being stripped of that, the console becomes
  // unadministrable from inside.
  if (existing && !hasPermission(permissions, "staff.manage")) {
    const othersCanManage = roles.some(
      (r) => r.id !== id && hasPermission(r.permissions, "staff.manage"),
    );
    if (!othersCanManage) {
      throw createError({
        statusCode: 400,
        message:
          "This is the only role that can manage staff. Give another role that permission first.",
      });
    }
  }

  let prefix = existing?.prefix;
  if (!existing) {
    prefix = String(body?.prefix || "").trim().toUpperCase();
    if (!isValidPrefix(prefix)) {
      throw createError({
        statusCode: 400,
        message: "Prefix must be one to three capital letters, e.g. WH.",
      });
    }
    if (roles.some((r) => r.prefix === prefix)) {
      throw createError({
        statusCode: 400,
        message: `Prefix ${prefix} is already used by another role.`,
      });
    }
  } else if (body.prefix && body.prefix.toUpperCase() !== existing.prefix) {
    throw createError({
      statusCode: 400,
      message:
        "A role's prefix can't change — IDs already issued under it would stop matching the role they name.",
    });
  }

  const doc: Record<string, unknown> = {
    id,
    name: String(body?.name || existing?.name || id).trim().slice(0, 60),
    prefix,
    description: String(body?.description ?? existing?.description ?? "").slice(0, 300),
    permissions,
    builtin: isBuiltin,
    updatedAt: Date.now(),
    updatedBy: actor.staffId,
  };
  if (!existing) doc.createdAt = Date.now();

  await db.collection("staffRoles").doc(id).set(doc, { merge: true });

  // Live sessions cache the permission list they were resolved with, so a
  // rebind that removes access has to end them or it doesn't take effect
  // until people happen to sign out.
  let revoked = 0;
  if (existing) {
    const holders = await db.collection("staff").where("roleId", "==", id).get();
    for (const h of holders.docs) revoked += await revokeAllSessions(db, h.id);
  }

  noteAction({
    area: "staff",
    action: existing ? "role.updated" : "role.created",
    actor,
    subject: id,
    summary: existing
      ? `Rebound ${doc.name}: ${permissions.length} permission(s).`
      : `Created role ${doc.name} (${prefix}).`,
    detail: { permissions, sessionsRevoked: revoked },
    event,
  });

  return { ok: true, id, sessionsRevoked: revoked };
});

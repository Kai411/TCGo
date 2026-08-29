import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { BUILTIN_ROLE_IDS } from "~/shared/staff";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "roles.manage");
  const id = String(((await readBody(event)) as any)?.id || "").trim();
  if (!id) throw createError({ statusCode: 400, message: "Role id required." });

  if (BUILTIN_ROLE_IDS.includes(id)) {
    throw createError({
      statusCode: 400,
      message:
        "Built-in roles can't be deleted — remove their permissions instead if you don't want them used.",
    });
  }

  const db = getAdminFirestore();
  // Orphaning staff onto a role that no longer exists would leave them signed
  // in with no permissions and no obvious cause.
  const holders = await db.collection("staff").where("roleId", "==", id).limit(1).get();
  if (!holders.empty) {
    throw createError({
      statusCode: 400,
      message: "Move the people on this role to another one first.",
    });
  }

  await db.collection("staffRoles").doc(id).delete();
  noteAction({
    area: "staff",
    action: "role.deleted",
    actor,
    subject: id,
    summary: `Deleted role ${id}.`,
    event,
  });
  return { ok: true };
});

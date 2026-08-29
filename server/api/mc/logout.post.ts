import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { destroySession, optionalStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const who = await optionalStaff(event);
  await destroySession(event, getAdminFirestore());
  if (who && !who.legacy) {
    noteAction({
      area: "auth",
      action: "staff.signed_out",
      actor: who,
      summary: `${who.name} signed out.`,
      event,
    });
  }
  return { ok: true };
});

// Delete a microsite. Banners that linked to it keep the link (it now shows
// "page not found"), so the console warns before deleting a linked page.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { isValidSlug } from "~/shared/site-content";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "content.manage");
  const slug = String(((await readBody(event)) as any)?.slug || "");
  if (!isValidSlug(slug)) throw createError({ statusCode: 400, message: "Unknown page" });
  await getAdminFirestore().collection("microsites").doc(slug).delete();
  noteAction({ area: "content", action: "microsite.delete", summary: `/p/${slug} deleted`, actor, subject: slug, event });
  return { ok: true };
});

// Every microsite, drafts included, for the Content page and the banner
// link picker. ?slug= returns just that one (the editor and draft preview).

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { isValidSlug } from "~/shared/site-content";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "content.manage");
  const col = getAdminFirestore().collection("microsites");
  const slug = String(getQuery(event).slug || "");
  if (slug) {
    if (!isValidSlug(slug)) throw createError({ statusCode: 404, message: "Page not found" });
    const snap = await col.doc(slug).get();
    if (!snap.exists) throw createError({ statusCode: 404, message: "Page not found" });
    return { microsite: { ...(snap.data() as any), slug } };
  }
  const snap = await col.orderBy("updatedAt", "desc").limit(200).get();
  return {
    microsites: snap.docs.map((d) => {
      const m = d.data() as any;
      // The list doesn't need the article text.
      return { slug: d.id, type: m.type, title: m.title, imageUrl: m.imageUrl, published: !!m.published, updatedAt: m.updatedAt };
    }),
  };
});

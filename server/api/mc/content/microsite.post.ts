// Create or update a microsite. The slug is the document ID (so /p/{slug} is
// one read), which makes a slug change a move: the new doc is created and the
// old one deleted in one transaction, refusing a slug that's already taken.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { isValidSlug, validateMicrosite } from "~/shared/site-content";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "content.manage");
  const body = (await readBody(event)) as Record<string, unknown>;
  const result = validateMicrosite(body as any);
  if ("error" in result) throw createError({ statusCode: 400, message: result.error });
  const site = result.microsite;
  const original = String(body?.originalSlug || "");
  if (original && !isValidSlug(original)) throw createError({ statusCode: 400, message: "Unknown page" });

  const col = getAdminFirestore().collection("microsites");
  const now = Date.now();
  await getAdminFirestore().runTransaction(async (tx) => {
    const target = col.doc(site.slug);
    const targetSnap = await tx.get(target);
    const prevSnap = original && original !== site.slug ? await tx.get(col.doc(original)) : null;
    if (original === site.slug) {
      if (!targetSnap.exists) throw createError({ statusCode: 404, message: "This page was deleted." });
    } else if (targetSnap.exists) {
      throw createError({ statusCode: 409, message: `/p/${site.slug} is already used by another page.` });
    }
    if (prevSnap && !prevSnap.exists) {
      throw createError({ statusCode: 404, message: "This page was deleted." });
    }
    const createdAt =
      (targetSnap.exists && (targetSnap.data() as any)?.createdAt) ||
      (prevSnap?.exists && (prevSnap.data() as any)?.createdAt) ||
      now;
    tx.set(target, { ...site, createdAt, updatedAt: now, updatedBy: actor.staffId });
    if (prevSnap) tx.delete(prevSnap.ref);
  });

  noteAction({
    area: "content",
    action: original ? "microsite.save" : "microsite.create",
    summary: `/p/${site.slug} ${original ? "saved" : "created"}${site.published ? " (published)" : " (draft)"}`,
    actor,
    subject: site.slug,
    detail: original && original !== site.slug ? { movedFrom: original } : undefined,
    event,
  });
  return { microsite: site };
});

// Save one listing banner. The page reads banners/{placement} straight from
// Firestore, so this is the only way content gets there.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import {
  APP_HOSTS,
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  validateBanner,
  type BannerPlacement,
} from "~/shared/site-content";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "content.manage");
  const body = (await readBody(event)) as Record<string, unknown>;
  const placement = String(body?.placement || "") as BannerPlacement;
  if (!BANNER_PLACEMENTS.includes(placement)) {
    throw createError({ statusCode: 400, message: "Unknown banner" });
  }
  const result = validateBanner(body as any, [...APP_HOSTS, getRequestHost(event)]);
  if ("error" in result) throw createError({ statusCode: 400, message: result.error });

  const banner = { ...result.banner, updatedAt: Date.now(), updatedBy: actor.staffId };
  await getAdminFirestore().collection("banners").doc(placement).set(banner);

  noteAction({
    area: "content",
    action: "banner.save",
    summary: `${BANNER_PLACEMENT_LABELS[placement]} banner ${banner.visible ? "shown" : "hidden"}`,
    actor,
    subject: placement,
    event,
  });
  return { banner };
});

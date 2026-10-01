import { timingSafeEqual } from "node:crypto";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { duePayouts, releasePayout } from "~/server/utils/payouts";

// Pays sellers whose Buyer Protection window has closed. Call on a schedule
// (GitHub Actions or a Netlify scheduled function) with
// `Authorization: Bearer $NUXT_CRON_SECRET`.
export default defineEventHandler(async (event) => {
  const secret = String(useRuntimeConfig().cronSecret || "");
  const given = (getHeader(event, "authorization") || "").replace(/^Bearer /i, "");
  const ok = secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw createError({ statusCode: 401, message: "Unauthorized" });

  const db = getAdminFirestore();
  const results: { orderId: string; ok: boolean; error?: string }[] = [];
  for (const id of await duePayouts(db)) {
    try {
      await releasePayout(db, id, "cron");
      results.push({ orderId: id, ok: true });
    } catch (e: any) {
      results.push({ orderId: id, ok: false, error: e?.message || String(e) });
    }
  }
  return { results };
});

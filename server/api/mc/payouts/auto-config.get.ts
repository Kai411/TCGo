import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { DEFAULT_AUTO_PAYOUT } from "~/shared/auto-payout";
import type { AutoPayoutConfig } from "~/shared/auto-payout";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "payouts.view");
  const db = getAdminFirestore();
  const snap = await db.collection("settings").doc("autoPayout").get();
  // Defaults are merged rather than seeded, so a setting added in a later
  // release doesn't read as undefined on an install that predates it.
  const config: AutoPayoutConfig = { ...DEFAULT_AUTO_PAYOUT, ...(snap.data() as any) };

  const since = Date.now() - 86_400_000;
  const runs = await db
    .collection("autoPayoutRuns")
    .orderBy("at", "desc")
    .limit(20)
    .get();
  const recent = runs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  return {
    config,
    recentRuns: recent,
    spentLast24h:
      Math.round(
        recent
          .filter((r) => r.at >= since)
          .reduce((t, r) => t + (r.totalSent || 0), 0) * 100,
      ) / 100,
  };
});

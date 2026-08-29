import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import { DEFAULT_AUTO_PAYOUT, configProblem } from "~/shared/auto-payout";
import type { AutoPayoutConfig } from "~/shared/auto-payout";

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "payouts.automate");
  const body = (await readBody(event)) as Partial<AutoPayoutConfig>;
  const db = getAdminFirestore();

  const current: AutoPayoutConfig = {
    ...DEFAULT_AUTO_PAYOUT,
    ...((await db.collection("settings").doc("autoPayout").get()).data() as any),
  };

  const next: AutoPayoutConfig = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    maxPerPayout: num(body.maxPerPayout, current.maxPerPayout),
    maxPerRun: num(body.maxPerRun, current.maxPerRun),
    dailyCap: num(body.dailyCap, current.dailyCap),
    minAmount: num(body.minAmount, current.minAmount),
    skipReportedSellers:
      typeof body.skipReportedSellers === "boolean"
        ? body.skipReportedSellers
        : current.skipReportedSellers,
    minQueuedAgeMinutes: num(body.minQueuedAgeMinutes, current.minQueuedAgeMinutes),
  };

  const problem = configProblem(next);
  if (problem) throw createError({ statusCode: 400, message: problem });

  await db
    .collection("settings")
    .doc("autoPayout")
    .set({ ...next, updatedAt: Date.now(), updatedBy: actor.staffId }, { merge: true });

  // Turning automation on or off is the change worth finding later, so it's
  // called out rather than buried in a diff of seven numbers.
  const toggled = next.enabled !== current.enabled;
  noteAction({
    area: "payout",
    action: toggled
      ? next.enabled
        ? "autopayout.enabled"
        : "autopayout.disabled"
      : "autopayout.reconfigured",
    actor,
    summary: toggled
      ? `Automatic payouts ${next.enabled ? "ENABLED" : "disabled"}.`
      : "Changed automatic payout limits.",
    detail: { ...next },
    event,
  });

  return { ok: true, config: next };
});

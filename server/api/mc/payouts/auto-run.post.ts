// The automatic payout runner.
//
// This is the only code in the platform that moves money without a person
// clicking at that moment, so it's built to be boring:
//
//   • Off by default, and the enabled flag is checked here as well as in the
//     UI — a scheduler that keeps firing after someone switches it off must
//     do nothing.
//   • Dry run is a first-class mode, not an afterthought. `?dry=1` returns
//     exactly what a real run would send, and sends nothing.
//   • Caps come from decideAutoPayouts (shared/auto-payout.ts), which is
//     pure and unit-tested, so the limits can't quietly stop applying.
//   • Batches are executed one at a time through the same claim-then-send
//     path a human uses, so an overlapping manual click can't double-pay.
//   • Every run writes a record, whether or not it sent anything. A silent
//     runner is indistinguishable from a broken one.
//
// TRIGGERING
// Either a signed-in staff member with payouts.automate (the "Run now"
// button), or a scheduler presenting `x-cron-key` matching NUXT_CRON_SECRET.
// With no secret configured the scheduled path is refused outright rather
// than left open.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import type { StaffPrincipal } from "~/server/utils/staff-auth";
import { executePayoutBatch } from "~/server/utils/execute-payout";
import { logAction, noteError } from "~/server/utils/oplog";
import {
  DEFAULT_AUTO_PAYOUT,
  SKIP_LABELS,
  decideAutoPayouts,
} from "~/shared/auto-payout";
import type { AutoPayoutConfig, CandidateBatch } from "~/shared/auto-payout";

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const cronKey = getHeader(event, "x-cron-key") || "";
  const cronSecret = (config.cronSecret as string) || "";

  let actor: StaffPrincipal | { staffId: string; name: string };
  let scheduled = false;

  if (cronKey) {
    if (!cronSecret || !timingSafeEqual(cronKey, cronSecret)) {
      throw createError({ statusCode: 401, message: "Invalid scheduler key" });
    }
    actor = { staffId: "scheduler", name: "Scheduled run" };
    scheduled = true;
  } else {
    actor = await requireStaff(event, "payouts.automate");
  }

  const dry = getQuery(event).dry === "1" || getQuery(event).dry === "true";
  const db = getAdminFirestore();

  const settings: AutoPayoutConfig = {
    ...DEFAULT_AUTO_PAYOUT,
    ...((await db.collection("settings").doc("autoPayout").get()).data() as any),
  };

  if (!settings.enabled && !dry) {
    return { ok: true, skipped: "Automatic payouts are switched off.", sent: 0 };
  }

  // ── Gather ──────────────────────────────────────────────────────────
  const queuedSnap = await db
    .collection("payouts")
    .where("status", "==", "queued")
    .limit(200)
    .get();

  const candidates: CandidateBatch[] = queuedSnap.docs.map((d) => {
    const p = d.data() as any;
    return {
      id: d.id,
      sellerUid: p.sellerUid,
      amount: p.amount,
      status: p.status,
      autoPayoutSupported: p.autoPayoutSupported,
      requestedAt: p.requestedAt,
      autoAttempts: p.autoAttempts ?? 0,
    };
  });

  // Sellers with a report still awaiting review. Money paid out before a
  // dispute is looked at is money that can't be clawed back.
  let reportedSellerUids = new Set<string>();
  if (settings.skipReportedSellers && candidates.length) {
    const reports = await db
      .collection("reports")
      .where("status", "==", "pending")
      .limit(500)
      .get();
    reportedSellerUids = new Set(
      reports.docs.map((d) => (d.data() as any).reportedUid).filter(Boolean),
    );
  }

  const since = Date.now() - 86_400_000;
  const runsSnap = await db
    .collection("autoPayoutRuns")
    .where("at", ">=", since)
    .get();
  const spentLast24h = runsSnap.docs.reduce(
    (t, d) => t + ((d.data() as any).totalSent || 0),
    0,
  );

  // ── Decide ──────────────────────────────────────────────────────────
  const decision = decideAutoPayouts(candidates, settings, {
    spentLast24h,
    reportedSellerUids,
  });

  const skippedSummary = decision.skipped.map((s) => ({
    payoutId: s.batch.id,
    amount: s.batch.amount,
    reason: s.reason,
    label: SKIP_LABELS[s.reason],
  }));

  if (dry) {
    return {
      ok: true,
      dryRun: true,
      wouldSend: decision.approved.map((b) => ({ payoutId: b.id, amount: b.amount })),
      wouldSkip: skippedSummary,
      total: decision.totalApproved,
      spentLast24h: Math.round(spentLast24h * 100) / 100,
      config: settings,
    };
  }

  // ── Send ────────────────────────────────────────────────────────────
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;
  const sent: { payoutId: string; amount: number; status?: string }[] = [];
  const failed: { payoutId: string; amount: number; error: string }[] = [];

  for (const batch of decision.approved) {
    try {
      const result = await executePayoutBatch(
        db,
        batch.id,
        { staffId: actor.staffId, name: `${actor.name} (auto)` },
        siteUrl,
      );
      if (result.ok) {
        sent.push({ payoutId: batch.id, amount: batch.amount, status: result.status });
      } else {
        failed.push({ payoutId: batch.id, amount: batch.amount, error: result.error || "unknown" });
        // Count the attempt so a batch that keeps bouncing stops being
        // retried forever and gets a human's attention instead.
        await db
          .collection("payouts")
          .doc(batch.id)
          .update({ autoAttempts: (batch.autoAttempts ?? 0) + 1 })
          .catch(() => undefined);
      }
    } catch (e: any) {
      // One bad batch must not abandon the rest of the run.
      failed.push({ payoutId: batch.id, amount: batch.amount, error: e?.message || "threw" });
      noteError({
        area: "payout",
        severity: "critical",
        code: "autopayout.batch_threw",
        message: `Automatic payout of ${batch.id} threw: ${e?.message || e}`,
        payoutId: batch.id,
        error: e,
        hint: "The batch was released back to the queue. Check it by hand before re-enabling.",
      });
    }
  }

  const totalSent = Math.round(sent.reduce((t, s) => t + s.amount, 0) * 100) / 100;

  // ── Record ──────────────────────────────────────────────────────────
  // Written even for an empty run: "the scheduler fired and found nothing" and
  // "the scheduler never fired" look identical without this.
  await db.collection("autoPayoutRuns").add({
    at: Date.now(),
    scheduled,
    actor: actor.staffId,
    totalSent,
    sentCount: sent.length,
    failedCount: failed.length,
    skippedCount: decision.skipped.length,
    sent,
    failed,
    skipped: skippedSummary.slice(0, 50),
    config: settings,
  });

  await logAction({
    area: "payout",
    action: "autopayout.run",
    actor: { staffId: actor.staffId, name: actor.name },
    summary:
      sent.length || failed.length
        ? `Auto-payout: sent ${sent.length} (RM${totalSent.toFixed(2)}), ${failed.length} failed, ${decision.skipped.length} skipped.`
        : `Auto-payout ran with nothing to send (${decision.skipped.length} skipped).`,
    detail: { totalSent, sentCount: sent.length, failedCount: failed.length, scheduled },
    event,
  });

  if (failed.length) {
    noteError({
      area: "payout",
      severity: "error",
      code: "autopayout.partial_failure",
      message: `${failed.length} automatic payout(s) failed this run.`,
      context: { failedCount: failed.length, sentCount: sent.length, totalSent },
      hint: "Failed batches are back in the queue. Two automatic failures and a batch stops retrying.",
    });
  }

  return {
    ok: true,
    sent: sent.length,
    failed: failed.length,
    skipped: decision.skipped.length,
    totalSent,
    details: { sent, failed, skipped: skippedSummary },
  };
});

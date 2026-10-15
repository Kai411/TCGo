// Uphold or dismiss a report.
//
// The trust penalty is applied in the same batch as the verdict: a report
// marked approved with no penalty applied, because the second write failed,
// reads as "handled" forever and nobody goes back to check.
//
// Re-reviewing an already-reviewed report is refused rather than allowed to
// stack penalties — two admins opening the same queue is normal.

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "reports.resolve");
  const body = (await readBody(event)) as {
    reportId?: string;
    verdict?: "approved" | "dismissed";
    penalty?: number;
    note?: string;
  };

  const reportId = String(body?.reportId || "").trim();
  const verdict = body?.verdict === "dismissed" ? "dismissed" : "approved";
  const note = String(body?.note || "").slice(0, 1000);
  if (!reportId) throw createError({ statusCode: 400, message: "reportId required" });

  // Bounded so a slipped decimal can't wipe someone's score in one click.
  const penalty =
    verdict === "approved" ? Math.min(100, Math.max(0, Number(body?.penalty) || 0)) : 0;

  const db = getAdminFirestore();
  const ref = db.collection("reports").doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw createError({ statusCode: 404, message: "Report not found" });
  const report = snap.data() as any;

  if (report.status !== "pending") {
    throw createError({
      statusCode: 409,
      message: `This report was already ${report.status}.`,
    });
  }

  const writes = db.batch();
  writes.update(ref, {
    status: verdict,
    penalty,
    adminNote: note,
    reviewedAt: Date.now(),
    reviewedBy: actor.staffId,
    reviewedByName: actor.name,
  });
  if (penalty > 0 && report.reportedUid) {
    writes.update(db.collection("users").doc(report.reportedUid), {
      trustScore: FieldValue.increment(-Math.abs(penalty)),
    });
  }
  await writes.commit();

  noteAction({
    area: "order",
    action: verdict === "approved" ? "report.upheld" : "report.dismissed",
    actor,
    subject: reportId,
    summary:
      verdict === "approved"
        ? `Upheld a ${report.type} report against ${report.reportedName || report.reportedUid} (−${penalty} trust).`
        : `Dismissed a ${report.type} report against ${report.reportedName || report.reportedUid}.`,
    detail: { reportedUid: report.reportedUid, penalty, type: report.type },
    event,
  });

  return { ok: true, status: verdict, penalty };
});

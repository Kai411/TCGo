// The operations log feed.
//
// Errors and actions are separate collections (see shared/oplog.ts) and this
// serves whichever the caller asks for, newest first, with cursor paging on
// the timestamp. No composite index needed: filters are applied in memory over
// a bounded page rather than as extra `where` clauses, which keeps this
// deployable without touching firestore.indexes.json.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import type { LogArea, LogSeverity } from "~/shared/oplog";

const PAGE = 50;
/** Scan cap, so a heavily-filtered query can't walk the whole collection. */
const MAX_SCAN = 400;

export default defineEventHandler(async (event) => {
  await requireStaff(event, "logs.view");

  const q = getQuery(event);
  const kind = q.kind === "action" ? "action" : "error";
  const area = typeof q.area === "string" && q.area !== "all" ? (q.area as LogArea) : null;
  const severity =
    typeof q.severity === "string" && q.severity !== "all"
      ? (q.severity as LogSeverity)
      : null;
  const unresolvedOnly = q.unresolved === "1" || q.unresolved === "true";
  const before = Number(q.before) || null;

  const db = getAdminFirestore();
  const collection = kind === "action" ? "actionLogs" : "errorLogs";

  let ref = db.collection(collection).orderBy("at", "desc");
  if (before) ref = ref.startAfter(before);

  const snap = await ref.limit(MAX_SCAN).get();

  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  if (area) rows = rows.filter((r) => r.area === area);
  if (kind === "error") {
    if (severity) rows = rows.filter((r) => r.severity === severity);
    if (unresolvedOnly) rows = rows.filter((r) => !r.resolvedAt);
  }

  const page = rows.slice(0, PAGE);

  return {
    kind,
    rows: page,
    // Cursor from the last SCANNED row, not the last returned one — paging off
    // the filtered result would skip everything the filter removed after it.
    nextBefore: snap.size >= MAX_SCAN ? snap.docs[snap.size - 1].get("at") : null,
    scanned: snap.size,
  };
});

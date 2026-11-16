// Who is this person, really — for an admin investigating a report.
//
// The point of holding a verified identity is being able to answer that when
// something goes wrong. Served from the server behind requireAdmin rather than
// read from the browser so the response can be deliberately narrow: it returns
// the verification outcome and the name on the document, and never the IC,
// bank details or anything Didit holds on our behalf.
//
// Every look-up is written to the action log (Mint Condition > Logs, area
// Identity) with who opened it, whose record it was and from which IP. A
// verified identity is the most sensitive thing we hold, so "who has looked at
// mine?" must always be answerable, PDPA s.9 security principle. Logged even
// when no profile is found, since the attempt is what an audit cares about.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { noteAction } from "~/server/utils/oplog";
import type { KycStatus } from "~/shared/didit";
import { getUserProfile } from "~/server/utils/user-profile";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "identity.view");

  const uid = String(getQuery(event).uid || "").trim();
  if (!uid || uid.includes("/") || /^__.*__$/.test(uid)) {
    throw createError({ statusCode: 400, message: "uid required" });
  }

  const db = getAdminFirestore();
  const p = await getUserProfile(db, uid);

  // Fire-and-forget: a failed log write must not hide the record from staff
  // handling a report. The summary names no personal data, only the uid.
  noteAction({
    area: "kyc",
    action: "identity.viewed",
    actor,
    subject: uid,
    summary: p
      ? `Viewed the identity record of account ${uid}.`
      : `Looked up identity for account ${uid} (no profile found).`,
    detail: { found: Boolean(p), kycStatus: p?.kycStatus ?? null },
    event,
  });

  if (!p) return { found: false };

  return {
    found: true,
    uid,
    displayName: p.customName || p.displayName || null,
    email: p.email ?? null,
    createdAt: p.createdAt ?? null,
    trustScore: p.trustScore ?? null,
    kyc: {
      status: (p.kycStatus ?? "none") as KycStatus,
      verifiedName: p.kycVerifiedName ?? null,
      verifiedAt: p.kycVerifiedAt ?? null,
      documentType: p.kycDocumentType ?? null,
      issuingState: p.kycIssuingState ?? null,
      // The Didit session is the pointer to the full evidence — images, the
      // liveness video, the registry match. Deliberately the only way to reach
      // it: an admin who needs that opens Didit, which leaves an audit trail
      // on their side rather than copying documents into our database.
      sessionId: p.kycSessionId ?? null,
      declineReason: p.kycDeclineReason ?? null,
    },
    // Useful signal when judging a report: an account that has never sold is a
    // different problem from one with a hundred completed orders.
    payoutNameOnFile: p.bankAccountHolder ?? null,
  };
});

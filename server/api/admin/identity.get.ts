// Who is this person, really — for an admin investigating a report.
//
// The point of holding a verified identity is being able to answer that when
// something goes wrong. Served from the server behind requireAdmin rather than
// read from the browser so the response can be deliberately narrow: it returns
// the verification outcome and the name on the document, and never the IC,
// bank details or anything Didit holds on our behalf.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireAdmin } from "~/server/utils/auth";
import type { KycStatus } from "~/shared/didit";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const uid = String(getQuery(event).uid || "").trim();
  if (!uid || uid.includes("/") || /^__.*__$/.test(uid)) {
    throw createError({ statusCode: 400, message: "uid required" });
  }

  const db = getAdminFirestore();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return { found: false };

  const p = snap.data() as Record<string, any>;

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

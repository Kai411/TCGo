// Staff approve a payout account held for a name mismatch.
//
// Payouts go only to the verified seller's own account (Seller Policy s.1).
// A bank account in a different name is held rather than refused, because a
// joint or business account looks the same as someone else's. This is the
// "I checked, it's theirs" step: it approves the exact holder name on the
// exact account the seller has saved now. Changing either needs a new
// approval (shared/payout-identity.ts payoutNameApproved).
//
// Logged with who approved it, since this is the decision that lets money
// leave for a name that isn't the verified one.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { getUserProfile, privateProfileRef } from "~/server/utils/user-profile";
import { logAction } from "~/server/utils/oplog";
import { toPayoutRecipient } from "~/shared/payout-details";
import type { PayoutNameApproval } from "~/shared/payout-identity";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "payouts.execute");
  const { uid: rawUid } = (await readBody(event)) as { uid?: string };
  const uid = String(rawUid || "").trim();
  if (!uid || uid.includes("/") || /^__.*__$/.test(uid)) {
    throw createError({ statusCode: 400, message: "uid required" });
  }

  const db = getAdminFirestore();
  const profile = await getUserProfile(db, uid);
  const recipient = toPayoutRecipient(profile as any);
  if (!profile || !recipient) {
    throw createError({ statusCode: 400, message: "This seller has no complete payout account to approve." });
  }

  const approval: PayoutNameApproval = {
    holder: recipient.name,
    bankAccountNumber: recipient.bankAccountNumber,
    approvedAt: Date.now(),
    approvedBy: actor.staffId,
    approvedByName: actor.name ?? null,
  };
  await privateProfileRef(db, uid).set({ payoutNameApproval: approval }, { merge: true });

  // Clear the hold note on queued batches going to this exact account, so the
  // queue stops showing them as held. Execute re-checks the profile anyway.
  const queued = await db
    .collection("payouts")
    .where("sellerUid", "==", uid)
    .where("status", "==", "queued")
    .get();
  const writes = db.batch();
  let cleared = 0;
  for (const d of queued.docs) {
    const p = d.data() as any;
    if (
      p.recipient?.name === approval.holder &&
      p.recipient?.bankAccountNumber === approval.bankAccountNumber
    ) {
      writes.update(d.ref, { identityHold: null, failureReason: null });
      cleared++;
    }
  }
  if (cleared) await writes.commit();

  await logAction({
    area: "payout",
    action: "payout.name_approved",
    actor,
    subject: uid,
    summary: `Approved payouts to "${approval.holder}" (account ending ${approval.bankAccountNumber.slice(-4)}) for a name that differs from the verified ID.`,
    detail: { accountLast4: approval.bankAccountNumber.slice(-4), batchesCleared: cleared },
    event,
  });

  return { ok: true, batchesCleared: cleared };
});

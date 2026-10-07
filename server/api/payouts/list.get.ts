// Admin payout queue. Served from the server (rather than read directly from
// the browser) so full bank details are only ever exposed behind the
// payouts.view permission, regardless of what the Firestore rules allow.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  await requireStaff(event, "payouts.view");
  const db = getAdminFirestore();

  const snap = await db
    .collection("payouts")
    .orderBy("requestedAt", "desc")
    .limit(200)
    .get();
  const payouts = snap.docs.map((d) => ({ ...(d.data() as PayoutBatch), id: d.id }));

  const totals = {
    queued: 0,
    processing: 0,
    paid: 0,
    failed: 0,
  };
  for (const p of payouts) totals[p.status] = Math.round((totals[p.status] + p.amount) * 100) / 100;

  return { payouts, totals };
});

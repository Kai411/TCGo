// Admin sends a queued payout batch.
//
// The actual work lives in server/utils/execute-payout.ts so the automatic
// runner takes the identical path — see the note there about why claiming the
// batch before calling Billplz is what makes double-sending impossible.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireStaff } from "~/server/utils/staff-auth";
import { PayoutClaimError, executePayoutBatch } from "~/server/utils/execute-payout";
import { noteAction } from "~/server/utils/oplog";

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, "payouts.execute");
  const { payoutId } = (await readBody(event)) as { payoutId?: string };
  if (!payoutId) throw createError({ statusCode: 400, message: "payoutId required" });

  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || getRequestURL(event).origin;
  const db = getAdminFirestore();

  let result;
  try {
    result = await executePayoutBatch(db, payoutId, actor, siteUrl);
  } catch (e: any) {
    if (e instanceof PayoutClaimError) {
      throw createError({ statusCode: e.statusCode, message: e.message });
    }
    throw e;
  }

  if (!result.ok) {
    throw createError({ statusCode: 400, message: result.error || "Payout failed" });
  }

  noteAction({
    area: "payout",
    action: "payout.executed",
    actor,
    subject: payoutId,
    summary: `Sent payout ${payoutId} (${result.status}).`,
    detail: { instructionId: result.instructionId, status: result.status },
    event,
  });

  return { ok: true, status: result.status, instructionId: result.instructionId };
});

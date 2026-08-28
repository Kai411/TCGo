// Billplz pushes a Payment Order's terminal status here.
//
// Registered as the collection's callback_url when the batch is executed.
// Without it, Billplz settles the transfer asynchronously and nothing tells
// TCGo — a payout the bank had already paid sat at "pending" on the seller's
// funds page until an admin happened to press Refresh in the admin console.
//
// Deliberately does NOT trust the posted status. The callback tells us *which*
// payment order changed; we then read the authoritative status back from
// Billplz over an authenticated call before touching any money record. That
// makes a forged or replayed callback harmless.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { getMassPaymentInstruction, mapInstructionStatus } from "~/server/utils/billplz";
import { settlePayout } from "~/server/utils/payouts";
import type { PayoutBatch } from "~/shared/payout-ledger";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, any> | undefined;
  // Billplz posts form-encoded; the id key has varied across their APIs.
  const instructionId = String(
    body?.id ?? body?.payment_order_id ?? body?.paymentOrderId ?? "",
  ).trim();

  // Always answer 200. A non-2xx makes Billplz retry, and a callback we can't
  // act on won't become actionable on a retry.
  if (!instructionId) return { ok: true, ignored: "no payment order id" };

  const db = getAdminFirestore();
  const snap = await db
    .collection("payouts")
    .where("billplzInstructionId", "==", instructionId)
    .limit(1)
    .get();

  if (snap.empty) return { ok: true, ignored: "unknown payment order" };

  const doc = snap.docs[0]!;
  const batch = { ...(doc.data() as PayoutBatch), id: doc.id };
  if (batch.status === "paid" || batch.status === "failed") {
    return { ok: true, status: batch.status, unchanged: true };
  }

  // Authoritative read — never the posted value.
  const instruction = await getMassPaymentInstruction(instructionId);
  const mapped = mapInstructionStatus(instruction.status);

  if (mapped === "processing") {
    await doc.ref.update({ billplzStatus: instruction.status ?? null });
    return { ok: true, status: "processing", raw: instruction.status };
  }

  await settlePayout(db, doc.ref, batch, mapped, {
    rawStatus: instruction.status,
    failureReason:
      mapped === "failed" ? `Billplz reported "${instruction.status}"` : undefined,
  });
  return { ok: true, status: mapped, raw: instruction.status };
});

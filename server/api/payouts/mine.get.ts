// A seller's own payout history.
//
// Served from the server rather than read straight from Firestore so the
// response shape is controlled — and so the account number can be masked. The
// seller knows their own account, but there's no reason to ship it in full to
// the browser on every page load.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import type { PayoutBatch } from "~/shared/payout-ledger";

const maskAccount = (n: string | undefined): string => {
  const v = (n ?? "").trim();
  if (v.length <= 4) return v;
  return `••••${v.slice(-4)}`;
};

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const db = getAdminFirestore();

  const snap = await db
    .collection("payouts")
    .where("sellerUid", "==", caller.uid)
    .limit(100)
    .get();

  const payouts = snap.docs
    .map((d) => {
      const p = { ...(d.data() as PayoutBatch), id: d.id };
      return {
        ...p,
        recipient: {
          ...p.recipient,
          bankAccountNumber: maskAccount(p.recipient?.bankAccountNumber),
        },
      };
    })
    // Sorted here rather than in the query: an orderBy on a filtered field
    // needs a composite index, and this collection is small per seller.
    .sort((a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0));

  return { payouts };
});

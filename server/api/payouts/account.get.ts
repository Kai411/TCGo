import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import type { PayoutAccount } from "~/server/utils/billplz";

const mask = (s: string) => (s.length <= 4 ? s : `${"•".repeat(s.length - 4)}${s.slice(-4)}`);

// The seller's own payout account, masked. Bank details live in
// payoutAccounts/{uid}, which Firestore rules keep away from every client.
export default defineEventHandler(async (event) => {
  const token = await requireUser(event);
  const snap = await getAdminFirestore().collection("payoutAccounts").doc(token.uid).get();
  if (!snap.exists) return { account: null };
  const a = snap.data() as PayoutAccount & { updatedAt: number };
  return {
    account: {
      bankCode: a.bankCode,
      holderName: a.holderName,
      accountNumber: mask(a.accountNumber),
      identityNumber: mask(a.identityNumber),
      updatedAt: a.updatedAt,
    },
  };
});

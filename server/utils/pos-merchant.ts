// Which HitPay account a seller's counter takings land in.
//
// Read from the seller's own user doc rather than config, because the
// whole point of the platform model is that each shop is paid into its
// own bank account — TCGo's key is only the fallback, and a fallback
// that pays the platform instead of the shop is a thing worth being
// explicit about.

import type { Firestore } from "firebase-admin/firestore";
import type { MerchantCredential } from "~/server/utils/pos-payment";

export const sellerMerchant = async (
  db: Firestore,
  sellerUid: string,
): Promise<MerchantCredential> => {
  const snap = await db.collection("users").doc(sellerUid).get();
  const user = (snap.data() ?? {}) as any;
  return {
    // OAuth wins when both exist: it's scoped and the merchant can
    // revoke it themselves.
    accessToken: user.hitpayAccessToken || undefined,
    apiKey: user.hitpayMerchantKey || undefined,
  };
};

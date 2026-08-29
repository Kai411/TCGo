// Seller verification ("KYC") — the gate for selling on TCGo.
//
// Deliberately NOT document KYC (no IC uploads): a seller is "verified" when
// their profile carries everything the platform needs to pay them and ship
// for them:
//   1. a mobile number (order and delivery contact),
//   2. a Malaysian bank account (Billplz payouts / manual transfer),
//   3. a pickup address (courier collection / shipment origin).
//
// Bank accounts in MY require IC to open, so the bank-account requirement is
// a real-identity anchor in itself.
//
// Since then, document verification has been added on top (Didit — MyKad or
// passport plus a face scan). Both are required: the bank account is what
// makes a payout possible at all, and the identity check is what stops
// someone selling under a name that isn't theirs before any money moves.

import { computed } from "vue";
import { kycGatePassed } from "~/shared/didit";
export { payoutDetailsComplete } from "~/shared/payout-details";
import { payoutDetailsComplete } from "~/shared/payout-details";

// State list lives in shared/ so Nitro can use it too (the Delyva quote API
// wants full state names, not the short codes we store). Re-exported here so
// existing imports from this composable keep working.
export { MY_STATES, stateName } from "~/shared/my-states";

export const useSellerKyc = () => {
  const { profile, loading } = useMyProfile();

  const missing = computed<string[]>(() => {
    const p = profile.value;
    if (!p) return ["profile"];
    const out: string[] = [];
    // No-op while KYC_REQUIRED is false — see shared/didit.ts.
    if (!kycGatePassed(p.kycStatus)) out.push("identity verification");
    if (!p.whatsappNumber && !p.phone) out.push("contact number");
    if (!payoutDetailsComplete(p)) out.push("bank account");
    if (!p.pickupAddress1 || !p.pickupPostcode || !p.pickupCity || !p.pickupState)
      out.push("pickup address");
    return out;
  });

  const sellerReady = computed(
    () => !!profile.value && missing.value.length === 0,
  );

  return { sellerReady, missing, kycLoading: loading };
};

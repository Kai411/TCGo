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
// the real-identity anchor without us touching documents.

import { computed } from "vue";
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

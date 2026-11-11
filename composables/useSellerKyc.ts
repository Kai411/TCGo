// Whether this member can sell — the one answer every screen uses.
//
// It is the four-step seller setup (shared/onboarding.ts): a verified
// identity, contact and pickup address, a bank account with IC number, and
// how parcels are handed over. Before this, four screens each had their own
// checklist (this file skipped the handover step, and the Account page looked
// for a timestamp only the old /seller/verify form wrote), so one account
// could be a seller on one screen and not on the next.

import { computed } from "vue";
import { SELLER_STEPS, sellerOnboardingState } from "~/shared/onboarding";
export { payoutDetailsComplete } from "~/shared/payout-details";

// State list lives in shared/ so Nitro can use it too (the Delyva quote API
// wants full state names, not the short codes we store). Re-exported here so
// existing imports from this composable keep working.
export { MY_STATES, stateName } from "~/shared/my-states";

export const useSellerKyc = () => {
  const { profile, loading } = useMyProfile();

  const setup = computed(() => sellerOnboardingState(profile.value));

  /** Titles of the setup steps still to do, in order. */
  const missing = computed<string[]>(() =>
    setup.value.remaining.map(
      (id) => SELLER_STEPS.find((s) => s.id === id)?.title.toLowerCase() ?? id,
    ),
  );

  const sellerReady = computed(() => !!profile.value && setup.value.complete);

  return { sellerReady, missing, setup, kycLoading: loading };
};

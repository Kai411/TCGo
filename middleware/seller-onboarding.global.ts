// Selling requires setup; browsing and buying do not.
//
// Separate from onboarding.global because it guards a different thing at a
// different bar. That one covers the whole marketplace and asks for an email
// and an address. This one covers /seller/* only, and asks for the things
// that have to exist before someone can take a stranger's money and ship them
// a card: a verified identity, a bank account, an address to collect from,
// and how parcels get handed over.
//
// It runs on entering the dashboard rather than at each action. Blocking the
// individual buttons — which is what the code did before — means a seller
// discovers a requirement at the worst possible moment, having already
// photographed and priced a card.

import {
  isSellerOnboardingExempt,
  sellerOnboardingState,
} from "~/shared/onboarding";

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;
  if (!to.path.startsWith("/seller")) return;

  const { user, authLoading } = useAuth();
  const { profile, loading } = useMyProfile();

  if (authLoading.value || loading.value) return;
  // Signed out is the buyer gate's business, and the page's own sign-in
  // prompt handles it. Redirecting here would fight both.
  if (!user.value) return;

  const state = sellerOnboardingState(profile.value);

  // Finished sellers never see the flow again — checked before the exemption
  // list, because /seller/onboarding is on it.
  if (to.path === "/seller/onboarding" && state.complete) {
    return navigateTo("/seller");
  }

  if (isSellerOnboardingExempt(to.path)) return;
  if (state.complete) return;

  return navigateTo({
    path: "/seller/onboarding",
    query: to.fullPath !== "/seller" ? { next: to.fullPath } : undefined,
  });
});

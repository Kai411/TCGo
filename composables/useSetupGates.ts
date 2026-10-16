// Where setup sends someone, decided in one place.
//
// The two route middlewares call these on every navigation. They can only
// decide once auth and the profile have loaded, and on a hard refresh or a
// link opened straight into a page, neither has loaded when the first
// navigation runs — so the middleware lets it through. plugins/setup-gates
// asks the same question again the moment loading finishes, which is what
// closes that gap. Pages no longer carry redirects of their own.

import type { RouteLocationNormalized, RouteLocationRaw } from "vue-router";
import {
  isOnboardingExempt,
  isSellerArea,
  isSellerOnboardingExempt,
  needsConfirmedEmail,
  onboardingState,
  sellerOnboardingState,
} from "~/shared/onboarding";

type To = Pick<RouteLocationNormalized, "path" | "fullPath" | "query">;

const safeNext = (next: unknown): string =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

/**
 * False while auth or the profile is still loading: redirecting on a
 * half-loaded profile would bounce a set-up member to setup on every refresh.
 */
export const setupGatesReady = (): boolean => {
  const { authLoading } = useAuth();
  const { loading } = useMyProfile();
  return !authLoading.value && !loading.value;
};

/** The buyer side: consent everywhere, a confirmed email where it acts. */
export const buyerGateRedirect = (to: To): RouteLocationRaw | null => {
  const { user } = useAuth();
  const { profile } = useMyProfile();
  // Signed out is never redirected. Browsing is open, and pages that need
  // an account ask for one themselves (useSignInGate).
  if (!user.value) return null;

  const verified = !!user.value.emailVerified;
  const state = onboardingState(profile.value, verified);

  // Nothing left to do here: back to wherever they were headed.
  if (to.path === "/onboarding" && state.complete) return safeNext(to.query.next);
  if (isOnboardingExempt(to.path)) return null;

  const needsEmail = !verified && needsConfirmedEmail(to.path);
  if (!state.blocking && !needsEmail) return null;
  return {
    path: "/onboarding",
    query: to.fullPath !== "/" ? { next: to.fullPath } : undefined,
  };
};

/** The seller side: the four setup steps before any /seller page. */
export const sellerGateRedirect = (to: To): RouteLocationRaw | null => {
  if (!isSellerArea(to.path)) return null;
  const { user } = useAuth();
  const { profile } = useMyProfile();
  if (!user.value) return null;

  const state = sellerOnboardingState(profile.value);
  // Finished sellers never see the flow again — checked before the exemption
  // list, because /seller/onboarding is on it.
  if (to.path === "/seller/onboarding" && state.complete) return safeNext(to.query.next ?? "/seller");
  if (isSellerOnboardingExempt(to.path) || state.complete) return null;
  return {
    path: "/seller/onboarding",
    query: to.fullPath !== "/seller" ? { next: to.fullPath } : undefined,
  };
};

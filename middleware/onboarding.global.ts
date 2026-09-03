// Nobody uses the marketplace with setup half-finished.
//
// This replaces the beta programme's banner, which only nagged: it could be
// dismissed, and the account it was nagging about could buy and sell anyway.
// A required step that can be dismissed is not a required step.
//
// WHAT IT DOES NOT DO
// It never blocks a signed-out visitor. Browsing is open — see
// useSignInGate() — and a gate that demanded an account to look at cards
// would be a worse product for no safety gain.
//
// It also never runs before auth and profile have settled. Redirecting on a
// half-loaded profile would bounce a fully set-up user to /onboarding on
// every hard refresh, which looks exactly like the app losing their data.

import { isOnboardingExempt, onboardingState } from "~/shared/onboarding";

export default defineNuxtRouteMiddleware((to) => {
  // Server-side there is no signed-in user to judge; the client re-runs this
  // the moment auth resolves.
  if (import.meta.server) return;

  const { user, authLoading } = useAuth();
  const { profile, loading } = useMyProfile();

  if (authLoading.value || loading.value) return;
  if (!user.value) return;
  if (isOnboardingExempt(to.path)) return;

  const state = onboardingState(profile.value, !!user.value.emailVerified);
  if (state.complete) return;

  return navigateTo({
    path: "/onboarding",
    // So finishing setup returns them to whatever they were trying to open.
    query: to.fullPath !== "/" ? { next: to.fullPath } : undefined,
  });
});

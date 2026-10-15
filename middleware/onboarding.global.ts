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

  const state = onboardingState(profile.value, !!user.value.emailVerified);

  // Finished accounts never see the setup screen again.
  //
  // Checked BEFORE the exemption list, because /onboarding is on that list —
  // it has to be, or the gate would bounce people away from the page it sends
  // them to. Without this, signing in again showed a completed checklist and
  // a "You're all set" screen nobody asked for.
  if (to.path === "/onboarding" && state.complete) {
    const next = typeof to.query.next === "string" ? to.query.next : "";
    // Same-site only: `next` arrives from the URL, so a full URL here would
    // make this an open redirect.
    return navigateTo(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }

  if (isOnboardingExempt(to.path)) return;
  if (state.complete) return;

  return navigateTo({
    path: "/onboarding",
    // So finishing setup returns them to whatever they were trying to open.
    query: to.fullPath !== "/" ? { next: to.fullPath } : undefined,
  });
});

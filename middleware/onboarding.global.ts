// Consent before anything; a confirmed email before anything done in
// someone's name (paying, selling, messaging). The decision itself lives in
// composables/useSetupGates.ts.
//
// WHAT IT DOES NOT DO
// It never blocks a signed-out visitor. Browsing is open — see
// useSignInGate() — and a gate that demanded an account to look at cards
// would be a worse product for no safety gain.
//
// It does not stop browsing for a missing email code or address. Those only
// matter once someone buys, sells or messages (see NEEDED_TO_BUY in
// shared/onboarding.ts).
//
// It also never runs before auth and profile have settled. Redirecting on a
// half-loaded profile would bounce a fully set-up user to /onboarding on
// every hard refresh, which looks exactly like the app losing their data.

export default defineNuxtRouteMiddleware((to) => {
  // Server-side there is no signed-in user to judge; the client re-runs this
  // the moment auth resolves (plugins/setup-gates.client.ts).
  if (import.meta.server) return;
  if (!setupGatesReady()) return;
  const target = buyerGateRedirect(to);
  if (target) return navigateTo(target);
});

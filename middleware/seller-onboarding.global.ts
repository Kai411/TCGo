// Selling requires setup; browsing and buying do not.
//
// Separate from onboarding.global because it guards a different thing at a
// different bar. That one covers the whole marketplace and asks for consent,
// and a confirmed email for paying, selling and messaging. This one covers /seller/* only, and asks for the things
// that have to exist before someone can take a stranger's money and ship them
// a card: a verified identity, a bank account, an address to collect from,
// and how parcels get handed over.
//
// It runs on entering the dashboard rather than at each action. Blocking the
// individual buttons — which is what the code did before — means a seller
// discovers a requirement at the worst possible moment, having already
// photographed and priced a card.

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;
  if (!setupGatesReady()) return;
  const target = sellerGateRedirect(to);
  if (target) return navigateTo(target);
});

// Central feature flags.
//
// PREMIUM_ENABLED — master switch for the Premium membership feature. While
// false, every public-facing premium surface is hidden: the Pricing nav link,
// the shop PremiumBanner, the "Go Premium" CTAs + premium badge on profiles,
// the membership section on the user's own profile, the scanner upgrade
// prompts, and the /pricing page itself (redirects home).
//
// The underlying tier logic, Stripe routes, and scan-quota code are left
// intact, so flipping this back to `true` fully restores the feature with no
// other changes.
export const PREMIUM_ENABLED = false;

export const useFeatureFlags = () => ({
  premiumEnabled: PREMIUM_ENABLED,
});

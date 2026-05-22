// Suppress Nuxt 3.13's "'manifest-route-rule' middleware already exists"
// warning. With ssr:false, Nuxt's manifest-route-rule middleware tries to
// register itself on every navigation, spamming hundreds of warnings per
// browsing session and grinding the dev event loop down. The middleware
// itself works correctly — only the warning is bogus.
//
// Filed against Nuxt upstream — remove this plugin when the warning is
// gone from Nuxt's middleware loader.

export default defineNuxtPlugin(() => {
  if (typeof console === "undefined") return;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("'manifest-route-rule' middleware already exists")
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

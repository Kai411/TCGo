// Registers the @vite-pwa/nuxt service worker. The module's
// auto-injection doesn't fire under ssr:false, so we register manually
// from a client-only plugin once Nuxt is hydrated.
//
// Skipped in dev: the SW caches Vite module chunks and then serves them
// across hot-reloads, which makes Nuxt auto-imports randomly resolve
// to undefined ("useAuth is not defined" in setup). Run-once unregister
// for anyone who already has the dev SW installed.
export default defineNuxtPlugin(() => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.dev) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const r of regs) r.unregister();
      })
      .catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[pwa] service worker registration failed:", err);
    });
  });
});

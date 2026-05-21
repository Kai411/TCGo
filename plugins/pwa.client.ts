// Registers the @vite-pwa/nuxt service worker. The module's
// auto-injection doesn't fire under ssr:false, so we register manually
// from a client-only plugin once Nuxt is hydrated.
export default defineNuxtPlugin(() => {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[pwa] service worker registration failed:", err);
    });
  });
});

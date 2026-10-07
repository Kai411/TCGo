/**
 * Stop the page itself from zooming on phones and tablets, so the app feels
 * installed rather than like a web page. Photos still zoom in their own
 * viewer (components/ImageLightbox.vue).
 *
 * The viewport meta in nuxt.config.ts covers Android and the zoom iOS does
 * when an input gets focus. iOS Safari ignores `user-scalable=no`, so its
 * pinch is cancelled here, and `touch-action` in assets/css/tailwind.css
 * stops double-tap zoom. Desktop browser zoom (Ctrl/⌘ +) is untouched, and
 * so is trackpad pinch in desktop Safari: this only runs on touch screens.
 */
export default defineNuxtPlugin(() => {
  if (!window.matchMedia("(pointer: coarse)").matches) return;

  // WebKit-only gesture events: preventing them cancels Safari's pinch zoom.
  const stop = (e: Event) => e.preventDefault();
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, stop, { passive: false });
  }
});

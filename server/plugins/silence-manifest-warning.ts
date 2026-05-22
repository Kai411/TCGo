// Companion to plugins/silence-manifest-warning.client.ts — same filter,
// applied to the Node.js dev-server console.
//
// The Nuxt 3.13 "'manifest-route-rule' middleware already exists" warning
// fires hundreds of times per browsing session. Each warn is a sync
// console call that blocks the event loop, dragging dev-server response
// time from ~50ms to 8 seconds.
//
// Remove when Nuxt fixes the duplicate registration.

export default defineNitroPlugin(() => {
  if (typeof console === "undefined") return;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const str = args.map(String).join(" ");
    if (str.includes("'manifest-route-rule' middleware already exists")) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

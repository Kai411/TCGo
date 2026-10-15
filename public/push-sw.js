// Push handling, pulled into the PWA's generated service worker with
// workbox.importScripts (see nuxt.config.ts). Plain JS on purpose: it runs in
// the service worker, outside the Nuxt build.
//
// The server sends { title, body, url, tag } — see shared/push.ts.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/";

  event.waitUntil(
    (async () => {
      // Already looking at it (an open chat, the order page) in a focused
      // window: the page updates itself, so a buzz would only be noise.
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const watching = open.some((c) => {
        try {
          return c.focused && new URL(c.url).pathname === url.split("?")[0];
        } catch (e) {
          return false;
        }
      });
      if (watching) return;

      await self.registration.showNotification(data.title || "TCGo", {
        body: data.body || "",
        icon: "/tcgo_sprites.png",
        badge: "/favicon.ico",
        tag: data.tag || undefined,
        // A new message in the same chat still buzzes, even though it
        // replaces the last one on screen.
        renotify: !!data.tag,
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const target = new URL(url, self.location.origin).href;
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse a TCGo window if there is one rather than stacking new tabs.
      for (const c of open) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) {
            try {
              await c.navigate(target);
            } catch (e) {}
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// The browser rotated the subscription (rare, but Firefox does it). There's no
// signed-in user in a service worker to re-register with, so the app does it
// on its next load: usePush() re-sends the current subscription whenever push
// is on.

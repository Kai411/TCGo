// Push notifications on this device: can it, has the member allowed it, and
// switching it on and off. The server side is server/utils/push.ts.
//
// Module-level state like useNotifications: the settings card and the bell's
// prompt must agree about whether this device is on.
//
// Why each "can't" state exists:
//   unsupported   — no Push API (older browsers, in-app browsers like
//                   Instagram's), or no service worker (dev builds).
//   needs-install — iPhone/iPad in a browser tab. Apple only allows web push
//                   once the site is on the Home Screen.
//   denied        — the member blocked notifications for tcgo.shop. Only the
//                   browser's own site settings can undo that.

import { computed, ref } from "vue";
import { DEFAULT_PUSH_PREFS, type PushCategory, type PushPrefs } from "~/shared/push";

export type PushState =
  | "loading"
  | "unavailable"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

const state = ref<PushState>("loading");
const prefs = ref<PushPrefs>({ ...DEFAULT_PUSH_PREFS });
const busy = ref(false);
const error = ref("");
let loadedFor: string | null = null;

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
  // iPadOS reports itself as a Mac.
  (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** The VAPID public key as the bytes PushManager.subscribe() wants. */
const keyBytes = (base64url: string): Uint8Array => {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** The PWA's worker, or null if there isn't one (dev builds have none). */
const registration = async (): Promise<ServiceWorkerRegistration | null> => {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return await navigator.serviceWorker.ready;
};

export const usePush = () => {
  const { user } = useAuth();
  const { authedFetch } = useAuthedFetch();
  const config = useRuntimeConfig();
  const publicKey = String(config.public.vapidPublicKey || "");

  /** Work out this device's state, and re-send the subscription if it's on. */
  const refresh = async () => {
    error.value = "";
    if (!user.value) {
      state.value = "off";
      loadedFor = null;
      return;
    }
    if (!publicKey) return void (state.value = "unavailable");
    if (isIos() && !isStandalone()) return void (state.value = "needs-install");
    if (!supported()) return void (state.value = "unsupported");
    if (Notification.permission === "denied") return void (state.value = "denied");

    const reg = await registration();
    if (!reg) return void (state.value = "unsupported");
    const sub = await reg.pushManager.getSubscription();

    if (loadedFor !== user.value.uid) {
      try {
        const res = await authedFetch<{ available: boolean; prefs: PushPrefs }>("/api/push/settings");
        prefs.value = res.prefs;
        if (!res.available) return void (state.value = "unavailable");
        loadedFor = user.value.uid;
      } catch {
        // Settings are a nicety; the on/off state below still stands.
      }
    }

    if (sub && Notification.permission === "granted") {
      // Re-register every load: it's how a subscription the browser rotated,
      // or one another account on this device took over, gets put right.
      authedFetch("/api/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } }).catch(() => {});
      state.value = "on";
    } else {
      state.value = "off";
    }
  };

  const enable = async () => {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      // Must be the first await after the tap: Safari only shows the
      // permission prompt in direct response to a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        state.value = permission === "denied" ? "denied" : "off";
        return;
      }
      const reg = await registration();
      if (!reg) {
        state.value = "unsupported";
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      await authedFetch("/api/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
      state.value = "on";
    } catch (e: any) {
      error.value = e?.data?.message || e?.message || "Couldn't turn on notifications";
    } finally {
      busy.value = false;
    }
  };

  /** Stop pushes to this device. Other devices are left as they are. */
  const disable = async () => {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      const reg = supported() ? await registration() : null;
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await authedFetch("/api/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      state.value = "off";
    } catch (e: any) {
      error.value = e?.message || "Couldn't turn off notifications";
    } finally {
      busy.value = false;
    }
  };

  /**
   * Before signing out: this device stops getting this member's pushes. The
   * browser subscription is dropped too, so the next person to sign in starts
   * from off rather than inheriting it.
   */
  const forgetDevice = async () => {
    if (!supported() || !user.value) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      await authedFetch("/api/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    } catch {
      // Signing out must never be blocked by this.
    } finally {
      state.value = "off";
      loadedFor = null;
    }
  };

  const setPref = async (key: PushCategory, value: boolean) => {
    const before = prefs.value[key];
    prefs.value = { ...prefs.value, [key]: value };
    try {
      const res = await authedFetch<{ prefs: PushPrefs }>("/api/push/settings", {
        method: "POST",
        body: { [key]: value },
      });
      prefs.value = res.prefs;
    } catch (e: any) {
      prefs.value = { ...prefs.value, [key]: before };
      error.value = e?.data?.message || "Couldn't save that";
    }
  };

  return {
    state,
    prefs,
    busy,
    error,
    isOn: computed(() => state.value === "on"),
    canEnable: computed(() => state.value === "off"),
    refresh,
    enable,
    disable,
    forgetDevice,
    setPref,
  };
};

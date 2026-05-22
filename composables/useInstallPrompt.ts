// PWA install prompt state.
//
// Two platforms, two flows:
//   - Chrome / Edge / Android: browser fires `beforeinstallprompt`; we stash
//     the event and call `prompt()` when the user taps Install.
//   - iOS Safari: no API. We detect the device and show instructions
//     (Share button → Add to Home Screen) instead.
//
// Once dismissed, we sit quiet for 14 days so we're not nagging on every
// page load. The hide is shared across the SPA via a single global ref.

const STORAGE_KEY = "tcgo-install-dismissed-at";
const QUIET_DAYS = 14;
const QUIET_MS = QUIET_DAYS * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const installedStandalone = ref(false);
const dismissedAt = ref<number>(0);
const wired = ref(false);

const isIos = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

const isIosSafari = () => {
  if (!isIos()) return false;
  const ua = navigator.userAgent || "";
  // Chrome iOS = CriOS, Firefox iOS = FxiOS, Edge iOS = EdgiOS — none can A2HS a PWA.
  return !/CriOS|FxiOS|EdgiOS/.test(ua);
};

const checkStandalone = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if ((navigator as any).standalone === true) return true;
  return false;
};

const loadDismissed = () => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
};

export const useInstallPrompt = () => {
  if (!wired.value && typeof window !== "undefined") {
    wired.value = true;
    installedStandalone.value = checkStandalone();
    dismissedAt.value = loadDismissed();

    window.addEventListener("beforeinstallprompt", (e: Event) => {
      e.preventDefault();
      deferredPrompt.value = e as BeforeInstallPromptEvent;
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt.value = null;
      installedStandalone.value = true;
    });

    // The standalone media query can flip mid-session if the user A2HS-es
    // and then comes back via a deep link in the installed app.
    try {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener?.("change", (ev) => {
        if (ev.matches) installedStandalone.value = true;
      });
    } catch {
      // older Safari — ignore
    }
  }

  const recentlyDismissed = computed(
    () => Date.now() - dismissedAt.value < QUIET_MS,
  );

  const canPromptNatively = computed(() => deferredPrompt.value !== null);

  const shouldOfferInstall = computed(() => {
    if (installedStandalone.value) return false;
    if (recentlyDismissed.value) return false;
    if (canPromptNatively.value) return true;
    if (isIosSafari()) return true;
    return false;
  });

  const promptInstall = async () => {
    const evt = deferredPrompt.value;
    if (!evt) return null;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      deferredPrompt.value = null;
      if (choice.outcome === "dismissed") dismiss();
      return choice.outcome;
    } catch {
      return null;
    }
  };

  const dismiss = () => {
    dismissedAt.value = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(dismissedAt.value));
    } catch {
      // localStorage blocked — accept the next-load reappearance
    }
  };

  return {
    isIos: computed(isIos),
    isIosSafari: computed(isIosSafari),
    installedStandalone: computed(() => installedStandalone.value),
    canPromptNatively,
    shouldOfferInstall,
    promptInstall,
    dismiss,
  };
};

import { onMounted, onUnmounted, ref } from "vue";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "tcgo-theme";

/**
 * The default is LIGHT, not "system". A visitor who has never touched the theme
 * toggle gets the light UI even on a dark-mode OS — dark is opt-in only.
 *
 * Consequence: an absent storage key now means "never chosen" rather than
 * "follow the system", so `setTheme` persists "system" instead of clearing the
 * key. Without that, choosing System would be indistinguishable from unset and
 * would silently resolve back to light.
 *
 * Keep this rule in sync with the pre-paint script in nuxt.config.ts.
 */
const DEFAULT_THEME: Theme = "light";

const theme = ref<Theme>(DEFAULT_THEME);
const resolved = ref<"light" | "dark">("light");

/**
 * Marketing surfaces pin the document to light while they are mounted. Held as
 * a count rather than a boolean so overlapping holds can't release each other
 * early during a route transition, when the incoming layout mounts before the
 * outgoing one unmounts.
 */
const lightHolds = ref(0);

let initialized = false;

const systemPrefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (t: Theme) => {
  if (typeof window === "undefined") return;

  const next =
    lightHolds.value > 0
      ? "light"
      : t === "system"
        ? systemPrefersDark()
          ? "dark"
          : "light"
        : t;

  resolved.value = next;
  document.documentElement.classList.toggle("dark", next === "dark");
};

const init = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const stored = localStorage.getItem(STORAGE_KEY);
  theme.value =
    stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : DEFAULT_THEME;

  applyTheme(theme.value);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (theme.value === "system") applyTheme("system");
    });
};

export const useTheme = () => {
  init();

  const setTheme = (t: Theme) => {
    theme.value = t;
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  };

  const toggle = () => {
    setTheme(resolved.value === "dark" ? "light" : "dark");
  };

  return { theme, resolved, setTheme, toggle };
};

/**
 * Pins the document to light for as long as the calling component is mounted,
 * then restores the visitor's own theme on unmount.
 *
 * Used by the landing layout: the marketing pages are a light-only surface, so
 * a visitor who picked dark inside the marketplace still sees them in light
 * rather than getting `.dark` variants bleeding through `.surface` and friends.
 */
export const useLightOnlySurface = () => {
  init();

  onMounted(() => {
    lightHolds.value++;
    applyTheme(theme.value);
  });

  onUnmounted(() => {
    lightHolds.value = Math.max(0, lightHolds.value - 1);
    applyTheme(theme.value);
  });
};

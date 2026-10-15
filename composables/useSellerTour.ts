// Seller-dashboard onboarding tour state.
//
// The tour itself (overlay, spotlight, copy) lives in
// components/SellerOnboardingTour.vue and is mounted once by layouts/seller.vue.
// This composable is the tiny shared switch that lets any seller page start it
// (the dashboard auto-starts it on a seller's first visit) and lets the sidebar
// "Take the tour" button replay it later.

const STORAGE_KEY = "tcgo:seller-tour:v1";

export const useSellerTour = () => {
  const active = useState<boolean>("seller-tour-active", () => false);

  const hasSeen = (): boolean => {
    if (!import.meta.client) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === "done";
    } catch {
      return true;
    }
  };

  const markSeen = () => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      /* private mode etc. — the tour simply shows again next time */
    }
  };

  const start = () => {
    active.value = true;
  };

  /** Called on finish *and* on skip — either way the seller has made a choice. */
  const stop = () => {
    active.value = false;
    markSeen();
  };

  /** Auto-start for first-time sellers; no-op if they've already seen it. */
  const startIfNew = () => {
    if (!hasSeen()) start();
  };

  return { active, start, stop, startIfNew, hasSeen };
};

// Whether to show someone what changed since they were last here.
//
// The note itself lives in components/WhatsNewSheet.vue, mounted once by
// layouts/default.vue. This is the small shared switch: what to show, and the
// record of having shown it. Same shape as useSellerTour.

import {
  APP_VERSION,
  RELEASES,
  unseenReleases,
  type Release,
} from "~/shared/releases";

const STORAGE_KEY = "tcgo:whats-new:last-seen";

export const useWhatsNew = () => {
  const open = useState<boolean>("whats-new-open", () => false);
  const showing = useState<Release[]>("whats-new-showing", () => []);

  const lastSeen = (): string | null => {
    if (!import.meta.client) return APP_VERSION; // Never open during SSR.
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode, or storage blocked. Treat as up to date rather than
      // reopening the same note on every page load.
      return APP_VERSION;
    }
  };

  const markSeen = () => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      /* nothing to do — the note simply shows again next visit */
    }
  };

  /**
   * Open on the full history, from the settings link.
   *
   * Deliberately not filtered by what they have seen — someone who went
   * looking for this wants the list, not an empty sheet saying they are up
   * to date.
   */
  const openAll = () => {
    showing.value = [...RELEASES];
    open.value = true;
    markSeen();
  };

  /** Show automatically, only when there is something they have not seen. */
  const showIfUnseen = () => {
    const pending = unseenReleases(lastSeen());
    if (!pending.length) return;
    showing.value = pending;
    open.value = true;
  };

  /** Dismissing is acknowledgement — it does not come back. */
  const dismiss = () => {
    open.value = false;
    markSeen();
  };

  return { open, showing, showIfUnseen, openAll, dismiss, markSeen };
};

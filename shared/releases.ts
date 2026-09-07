// What we tell people changed, and when.
//
// WRITE THESE FOR A BUYER OR SELLER, NOT FOR US.
//
// A release note says what someone can now do, in the words they would use.
// It never names how anything works inside: no services, no data stores, no
// scheduled jobs, no payment providers, no internal money handling, no
// architecture. Those are our operations, and they belong in commit messages
// and code comments — where they already are.
//
// The rule is enforced, not just described: test/releases.test.ts fails the
// build if a note mentions anything on the forbidden list. If you find
// yourself wanting to explain a mechanism to justify a change, the note is
// too detailed — say what it does for them and stop.
//
//   Good  "Search by the number printed on the card."
//   Bad   "Card numbers now query their own column instead of the name index."

export interface Release {
  /** Semver-ish; only the numeric ordering matters here. */
  version: string;
  /** ISO date, for display. */
  date: string;
  /** A few words, shown as the heading. */
  title: string;
  /** One line each, in the reader's language. */
  notes: string[];
}

/** Newest first. The head of this list is the version the app reports. */
export const RELEASES: Release[] = [
  {
    version: "1.1.0",
    date: "2026-09-07",
    title: "Find cards faster",
    notes: [
      "Search by the number printed on the card — try “pikachu 012”, “gg44” or “tg05”.",
      "Use the short set names you already say out loud — “pikachu ssp”, “reshiram rc”, “charizard tg”.",
      "Search results keep loading as you scroll, so there is nothing to click for more.",
      "New sets are added within a day of release.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-30",
    title: "Orders you can follow",
    notes: [
      "Follow a delivery from the moment it is placed through to arrival.",
      "Orders combined into one parcel now show as a single delivery.",
      "Sign in with an email address and password.",
      "Save more than one delivery address and choose which is your default.",
    ],
  },
];

export const APP_VERSION = RELEASES[0]!.version;

/** Numeric compare: 1.10.0 is above 1.9.0, which a string compare gets wrong. */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
};

/** How many notes to show at once, however long someone has been away. */
export const MAX_SHOWN = 3;

/**
 * The releases someone has not been told about yet.
 *
 * Nothing stored means either a brand-new visitor or someone who was here
 * before this existed; both get the current release only. Showing a first-time
 * visitor the whole history would be noise, and showing a returning user
 * nothing would waste the one release they actually missed.
 */
export const unseenReleases = (lastSeen: string | null | undefined): Release[] => {
  if (!lastSeen) return RELEASES.slice(0, 1);
  return RELEASES.filter((r) => compareVersions(r.version, lastSeen) > 0).slice(
    0,
    MAX_SHOWN,
  );
};

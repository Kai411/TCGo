// The 24-hour hold on money and payout details after a password change.
//
// Someone who takes over an account usually changes the password first, then
// points the payouts at their own bank. So for a day after any password
// change, the actions that move money out or redirect it are refused: editing
// payout bank details and requesting a payout. Browsing, buying, bidding,
// selling and chat carry on as normal. The real owner gets the reset email,
// notices, and has a day to get in touch before anything can leave.
//
// The decision is made on the server from two times it trusts:
//
//   passwordChangedAt  written by our own routes (accountSecurity/{uid}, which
//                      only the Admin SDK can touch) when a change goes
//                      through the app.
//   tokensValidAfter   Firebase's own "sessions before this are dead" time.
//                      Firebase moves it forward whenever the password
//                      changes, including through the emailed reset link,
//                      which happens on Firebase's page, outside the app. It
//                      also moves on a manual session revoke or an email
//                      change, which deserve the same hold.
//
// A brand-new account has tokensValidAfter at its creation time, so anything
// within the first few minutes of the account counts as "created", not
// "changed", or every new seller would wait a day to add their bank.
//
// Shared by the server and the tests. Keep it dependency-free.

export const SECURITY_LOCK_MS = 24 * 60 * 60 * 1000;

/** tokensValidAfter this close to account creation is the creation itself. */
export const CREATION_GRACE_MS = 10 * 60 * 1000;

export interface SecurityTimes {
  /** ms; our own record of a password change. */
  passwordChangedAt?: number | null;
  /** ms; Firebase's tokensValidAfterTime. */
  tokensValidAfter?: number | null;
  /** ms; Firebase's account creation time. */
  createdAt?: number | null;
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/** When the latest password change (or equivalent) happened, or 0 for never. */
export const lastSecurityChange = (t: SecurityTimes): number => {
  const recorded = num(t.passwordChangedAt);
  const revoked = num(t.tokensValidAfter);
  const created = num(t.createdAt);
  const revokedCounts = revoked > 0 && (!created || revoked > created + CREATION_GRACE_MS);
  return Math.max(recorded, revokedCounts ? revoked : 0);
};

/** The time the hold lifts, or null when there is no hold right now. */
export const lockedUntil = (t: SecurityTimes, now: number): number | null => {
  const changed = lastSecurityChange(t);
  if (!changed) return null;
  const until = changed + SECURITY_LOCK_MS;
  return until > now ? until : null;
};

/** "21 Oct, 3:40 pm", in Malaysia time whatever the server's zone. */
export const formatLockTime = (ms: number): string =>
  new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(ms))
    .replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());

/** The sentence shown wherever a locked action is refused. */
export const lockMessage = (until: number): string =>
  `Your password was changed recently, so payouts and bank details are locked until ${formatLockTime(until)} to keep your money safe.`;

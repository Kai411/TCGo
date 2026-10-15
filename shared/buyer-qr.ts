// The QR a buyer shows at a counter so their receipt can be emailed.
//
// Follows the scheme the inventory labels already use — `tcgo:inv:<id>` — so
// the POS scanner can tell at a glance which kind of code it just read and
// ignore anything foreign without a round trip.
//
// WHAT IT CARRIES, AND WHAT IT DELIBERATELY DOESN'T
// ────────────────────────────────────────────────
// The uid, and nothing else. Not the email.
//
// A QR is a photograph waiting to happen: it gets screenshotted, printed on a
// loyalty card, left face-up on a counter. An email address encoded in one is
// leaked permanently and cannot be withdrawn. A uid is only useful to someone
// who can also authenticate as a seller against our API, and that exchange is
// logged — so the buyer keeps a way to be forgotten and we keep a record of
// who asked.

/** Same shape as tcgo:inv: — see pages/seller/labels.vue. */
export const BUYER_QR_PREFIX = "tcgo:u:";

export const buyerQrPayload = (uid: string): string => `${BUYER_QR_PREFIX}${uid}`;

/**
 * The uid inside a buyer QR, or null for anything else.
 *
 * Null rather than throwing: the POS camera reads whatever is in front of it,
 * including inventory labels, a customer's boarding pass and the shop's own
 * DuitNow standee. A scanner that throws on the wrong code is a scanner that
 * breaks when someone waves the wrong thing at it.
 */
export const parseBuyerQr = (raw: string | null | undefined): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(BUYER_QR_PREFIX)) return null;
  const uid = trimmed.slice(BUYER_QR_PREFIX.length).trim();
  // Firebase uids are 28 alphanumerics today, but the length isn't contractual
  // — so this checks shape, not size, and lets the lookup decide if it exists.
  if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) return null;
  return uid;
};

/**
 * Good enough to send a receipt to.
 *
 * Deliberately loose. This gates a convenience — an emailed receipt — not
 * access to anything, and a clever regex that rejects a real address is worse
 * here than a lax one that lets a typo through to a bounce.
 */
export const isPlausibleEmail = (value: string | null | undefined): boolean =>
  typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value.trim());

export const normaliseEmail = (value: string): string => value.trim().toLowerCase();

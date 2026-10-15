// How long a listing stays live, and what "deleted" means.
//
// TWO RULES
// ─────────
//   A listing goes off the marketplace 3 months after it was listed. The card
//   stays in the seller's inventory — it is unlisted, not gone — so relisting
//   is one action rather than re-entering the card.
//
//   Deleting a listing hides it; it never removes the document. Sold history,
//   dispute evidence and the audit trail all point at listings, and a hard
//   delete turns those into dangling references.
//
// COMPUTED, NOT SWEPT
// ───────────────────
// Expiry is derived at read time from `listedAt`, not written by a scheduled
// job — because there is no scheduler in this stack, so a job-based design
// would simply never expire anything. This mirrors how a lapsed POS hold
// already reads as available in shared/card-availability.ts: the truth is a
// function of the timestamp, and any sweeper is tidying rather than
// correctness.
//
// A sweeper can still be added later to write `status: "expired"` so sellers
// see it in their own lists; nothing here depends on it having run.

/** A listing is live on the marketplace for 3 months. */
export const LISTING_TTL_DAYS = 90;
export const LISTING_TTL_MS = LISTING_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Warn the seller this far out, so a relist is a choice and not a surprise. */
export const LISTING_EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shape-tolerant, like AvailabilityView: the same predicates run against
 * admin-SDK documents on the server and typed Cards in the browser.
 */
export interface LifecycleView {
  /** When it went live. Absent on listings that predate the field. */
  listedAt?: number | null;
  /** When the document was created — the fallback for those. */
  createdAt?: number | null;
  /** Set by a soft delete. The document stays; this hides it. */
  deletedAt?: number | null;
  status?: string | null;
}

/**
 * The clock a listing's life is measured from.
 *
 * Falls back to createdAt so listings made before `listedAt` existed expire on
 * a sensible date rather than all at once the moment this ships — or, worse,
 * never, which is what returning 0 would do.
 */
export const listedAtOf = (card: LifecycleView): number =>
  card.listedAt ?? card.createdAt ?? 0;

export const expiresAt = (card: LifecycleView): number | null => {
  const from = listedAtOf(card);
  return from > 0 ? from + LISTING_TTL_MS : null;
};

/** Past its 3 months. Says nothing about whether it sold. */
export const isExpired = (card: LifecycleView, now: number = Date.now()): boolean => {
  // An explicit status wins over the clock: a seller who relisted or a
  // sweeper that already ran should not be second-guessed by arithmetic.
  if (card.status === "expired") return true;
  const at = expiresAt(card);
  return at !== null && now >= at;
};

/** Soft-deleted. Never shown to anyone, still readable internally. */
export const isDeleted = (card: LifecycleView): boolean => card.deletedAt != null;

/** Days left, for the seller's own lists. Null when it has no clock. */
export const daysUntilExpiry = (
  card: LifecycleView,
  now: number = Date.now(),
): number | null => {
  const at = expiresAt(card);
  if (at === null) return null;
  return Math.max(0, Math.ceil((at - now) / (24 * 60 * 60 * 1000)));
};

/** Close enough to expiry to be worth telling the seller about. */
export const isExpiringSoon = (card: LifecycleView, now: number = Date.now()): boolean => {
  const at = expiresAt(card);
  if (at === null || isExpired(card, now)) return false;
  return at - now <= LISTING_EXPIRY_WARNING_MS;
};

/**
 * Should this listing appear on the marketplace at all?
 *
 * Deliberately separate from isAvailable(): that answers "can it be bought"
 * (sold, reserved), this answers "should it be shown" (deleted, expired). A
 * card can fail either independently, and merging them would mean a buyer's
 * "sold out" message and a seller's "expired" message came from one flag.
 */
export const isListable = (card: LifecycleView, now: number = Date.now()): boolean =>
  !isDeleted(card) && !isExpired(card, now);

export const listableOnly = <T extends LifecycleView>(cards: T[], now: number = Date.now()): T[] =>
  cards.filter((c) => isListable(c, now));

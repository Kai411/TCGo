// One definition of "can this card still be bought online".
//
// The Card model carries two overlapping notions of sold-ness: the original
// `sold` boolean and the newer `status` lifecycle that was meant to replace
// it. Every surface in the app filtered on `sold` alone, so the extra states
// the schema already declared — "reserved", "pending_payment" — had no effect
// whatsoever: a card in either state stayed visible and stayed buyable.
//
// That gap is what the POS needs closed. While a counter customer is paying by
// QR, the same card must not be sellable online, and the block has to hold for
// the ~2 minutes the payment is in flight rather than being an optimistic
// front-end filter.
//
// Read both fields, everywhere, through here.

/** Lifecycle states in which a card is NOT purchasable. */
const UNAVAILABLE_STATUSES = new Set([
  "reserved",
  "pending_payment",
  "sold",
  "cancelled",
  "expired",
]);

/**
 * Shape-tolerant on purpose: this runs against Firestore documents on the
 * server (plain objects, admin SDK) as well as typed Cards in the client.
 */
export interface AvailabilityView {
  sold?: boolean;
  status?: string | null;
  reservedUntil?: number | null;
}

/** Held for an in-flight POS payment, and the hold hasn't lapsed yet. */
export const isReserved = (card: AvailabilityView): boolean => {
  if (card.status !== "reserved" && card.status !== "pending_payment") return false;
  // A reservation with no expiry is treated as live; see releaseExpired() for
  // the sweeper that cleans these up.
  if (card.reservedUntil == null) return true;
  return card.reservedUntil > Date.now();
};

/**
 * True only when the card can be added to a cart and paid for.
 *
 * A lapsed reservation reads as available again — the POS releases holds
 * explicitly, but a seller who closes the tab mid-payment must not strand the
 * card forever, and no sweeper is guaranteed to have run yet.
 */
export const isAvailable = (card: AvailabilityView): boolean => {
  if (card.sold) return false;
  if (!card.status) return true; // legacy docs predate the lifecycle field
  if (!UNAVAILABLE_STATUSES.has(card.status)) return true;
  // Reserved is the one unavailable state that heals on its own.
  return (card.status === "reserved" || card.status === "pending_payment") && !isReserved(card);
};

/** Convenience for `.filter()` over typed cards. */
export const availableOnly = <T extends AvailabilityView>(cards: T[]): T[] =>
  cards.filter(isAvailable);

/**
 * Why a card can't be bought, for messages shown to a seller at the counter.
 * Distinguishes "someone else already bought this" from "you're mid-sale on
 * another till", which need different responses.
 */
export type UnavailableReason = "sold" | "reserved" | "unavailable";

export const unavailableReason = (card: AvailabilityView): UnavailableReason | null => {
  if (isAvailable(card)) return null;
  if (card.sold || card.status === "sold") return "sold";
  if (isReserved(card)) return "reserved";
  return "unavailable";
};

/** How long a POS payment holds its cards before the hold lapses. */
export const POS_RESERVATION_MS = 10 * 60 * 1000;

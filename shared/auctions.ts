// Auction settlement constants and state, shared by the settle route and the
// auction UI so both describe the same lifecycle.
//
// Lifecycle after the clock runs out:
//   ended, has a winner   → pending_payment  (compiled order created, FPX due)
//   winner pays           → sold
//   winner doesn't pay    → expired          (order cancelled, card relisted)
//   ended, no bids        → expired

export type AuctionStatus =
  | "active"
  | "reserved"
  | "pending_payment"
  | "sold"
  | "cancelled"
  | "expired";

// How long a winner has to complete payment before the result is voided.
export const AUCTION_PAYMENT_WINDOW_HOURS = 48;
export const AUCTION_PAYMENT_WINDOW_MS = AUCTION_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000;

export const auctionHasEnded = (endsAt: number | undefined, now = Date.now()) =>
  typeof endsAt === "number" && now >= endsAt;

// Terminal states — settlement should never re-run on these.
export const AUCTION_SETTLED_STATUSES: AuctionStatus[] = ["sold", "cancelled", "expired"];

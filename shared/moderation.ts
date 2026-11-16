// Listing reports and staff moderation: Hide listing and Suspend selling.
//
// WHO WRITES WHAT
// A member files a report from the browser (Firestore rules let them create a
// pending report about someone else). Everything after that is staff work
// done through /api/mc/* with the Admin SDK: hiding a listing writes the
// hidden* fields on cards/{id} or auctions/{id}, suspending writes the
// sellingSuspended* fields on users/{uid}. The rules forbid members from
// setting or clearing any of those fields, so a seller can't undo either.
//
// WHERE IT BITES
//   - isListable() and isAvailable() treat a hidden listing as gone, so it
//     drops off the marketplace and can't be added to a cart.
//   - create-bill refuses to take payment for a hidden listing or a
//     suspended seller, so an order made before the takedown can't be paid.
//   - The rules' seller gate refuses new listings and edits from a suspended
//     seller.
//   - Suspending also hides the seller's live listings, marked as hidden by
//     the suspension, and lifting it brings back only those.

import type { DraftNotification } from "~/shared/notifications";

/**
 * Reasons a member can give for reporting a listing. `penalty` is the trust
 * points staff are offered when they uphold one, like REPORT_TYPES.
 */
export const LISTING_REPORT_REASONS = [
  {
    value: "listing_counterfeit",
    penalty: 25,
    label: "Fake or counterfeit",
    hint: "A proxy, reprint or fake card sold as real.",
  },
  {
    value: "listing_prohibited",
    penalty: 10,
    label: "Not allowed on TCGo",
    hint: "Resealed packs, weapons, adult items or anything else the rules ban.",
  },
  {
    value: "listing_misdescribed",
    penalty: 5,
    label: "Wrong description or photos",
    hint: "Condition, grade, edition or photos don't match the card.",
  },
  {
    value: "listing_stolen",
    penalty: 25,
    label: "Stolen or someone else's photos",
    hint: "The card or the photos belong to someone else.",
  },
  {
    value: "listing_other",
    penalty: 5,
    label: "Something else",
    hint: "Tell us what's wrong in the box below.",
  },
] as const;

export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number]["value"];

export const isListingReportType = (type: unknown): type is ListingReportReason =>
  LISTING_REPORT_REASONS.some((r) => r.value === type);

export const listingReasonLabel = (type: string): string =>
  type === "seller_suspended"
    ? "Seller suspended"
    : (LISTING_REPORT_REASONS.find((r) => r.value === type)?.label ?? type);

export type ListingKind = "card" | "auction";

export const LISTING_COLLECTION: Record<ListingKind, "cards" | "auctions"> = {
  card: "cards",
  auction: "auctions",
};

export const listingHref = (kind: ListingKind, id: string): string =>
  kind === "auction" ? `/auctions/${id}` : `/cards/${id}`;

/**
 * Fields only staff write on a listing. Mirrored in firestore.rules
 * (moderationListingFields), which stops owners setting or changing them.
 */
export const LISTING_MODERATION_FIELDS = [
  "hidden",
  "hiddenReason",
  "hiddenMessage",
  "hiddenAt",
  "hiddenBy",
  "hiddenVia",
] as const;

/** Fields only staff write on a profile. Mirrored in firestore.rules. */
export const SUSPENSION_FIELDS = [
  "sellingSuspended",
  "sellingSuspendedReason",
  "sellingSuspendedAt",
  "sellingSuspendedBy",
] as const;

export interface ModerationView {
  hidden?: boolean | null;
}

/** Taken down by TCGo staff, directly or by suspending the seller. */
export const isHiddenByStaff = (listing: ModerationView | null | undefined): boolean =>
  listing?.hidden === true;

export const isSellingSuspended = (
  profile: { sellingSuspended?: boolean | null } | null | undefined,
): boolean => profile?.sellingSuspended === true;

/** How long the message to the seller may be. Shown in their bell. */
export const MODERATION_MESSAGE_MAX = 300;

/** Trim and bound what staff typed for the seller. */
export const cleanModerationMessage = (raw: unknown): string =>
  String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MODERATION_MESSAGE_MAX);

/**
 * Pull a listing out of a link or path staff pasted (…/cards/{id} or
 * …/auctions/{id}). A bare id is refused: it doesn't say which collection.
 */
export const parseListingRef = (
  raw: string,
): { kind: ListingKind; id: string } | null => {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/\/(cards|auctions)\/([A-Za-z0-9_-]{6,})/);
  if (m) return { kind: m[1] === "auctions" ? "auction" : "card", id: m[2]! };
  return null;
};

// ── What the seller is told ─────────────────────────────────────────────
//
// Plain words, and always why: a seller who finds a listing gone with no
// reason assumes a bug and relists it. The staff message goes in the body
// as written; the help link is where they can ask about it.

const HELP_HREF = "/account/help";

export const listingHiddenNotice = (input: {
  kind: ListingKind;
  id: string;
  title: string;
  reason: string;
  message: string;
}): DraftNotification => ({
  kind: "listing_hidden",
  audience: "seller",
  title: `TCGo took down ${input.title || "your listing"}`,
  body:
    `Reason: ${listingReasonLabel(input.reason)}.` +
    (input.message ? ` ${input.message}` : "") +
    " Buyers can't see or pay for it. Reply through Help if you think this is a mistake.",
  href: HELP_HREF,
  meta: { listingKind: input.kind, listingId: input.id, reason: input.reason },
});

export const listingRestoredNotice = (input: {
  kind: ListingKind;
  id: string;
  title: string;
}): DraftNotification => ({
  kind: "listing_restored",
  audience: "seller",
  title: `${input.title || "Your listing"} is back on TCGo`,
  body: "TCGo reviewed it and put it back on the marketplace.",
  href: listingHref(input.kind, input.id),
  meta: { listingKind: input.kind, listingId: input.id },
});

export const sellingSuspendedNotice = (input: {
  message: string;
  hiddenCount: number;
}): DraftNotification => ({
  kind: "selling_suspended",
  audience: "seller",
  title: "TCGo paused your selling",
  body:
    (input.message ? `${input.message} ` : "") +
    (input.hiddenCount > 0
      ? `Your ${input.hiddenCount} live listing${input.hiddenCount === 1 ? " is" : "s are"} hidden and you can't list or take payments until this is lifted.`
      : "You can't list or take payments until this is lifted.") +
    " Reply through Help to ask about it.",
  href: HELP_HREF,
  meta: { hiddenCount: input.hiddenCount },
});

export const sellingRestoredNotice = (input: { restoredCount: number }): DraftNotification => ({
  kind: "selling_restored",
  audience: "seller",
  title: "You can sell on TCGo again",
  body:
    input.restoredCount > 0
      ? `TCGo lifted the pause and put ${input.restoredCount} listing${input.restoredCount === 1 ? "" : "s"} back on the marketplace.`
      : "TCGo lifted the pause on your selling.",
  href: "/seller",
  meta: { restoredCount: input.restoredCount },
});

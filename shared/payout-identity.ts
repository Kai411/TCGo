// Who a payout may go to.
//
// Seller Policy s.1 promises payouts only to the seller's own account, and
// sending money to whoever's name a seller types is the money-mule pattern
// banks and Billplz screen for. So every payout is checked against the
// identity Didit verified:
//
//   • BLOCK  the seller is no longer verified, or staff suspended selling.
//            No payout can be requested or sent until that changes.
//   • HOLD   the bank account is in a name that doesn't loosely match the
//            verified name. Joint and business accounts look like this too,
//            so it's not refused: the payout waits until staff approve that
//            exact name and account in the identity panel.
//
// The request route, the staff Send button and the automatic runner all call
// checkPayoutIdentity, so none of them can skip it. Pure and dependency-free
// so the tests can pin it down.

import { isKycVerified, type KycStatus } from "~/shared/didit";

export interface PayoutNameApproval {
  /** The account holder name staff approved, exactly as saved. */
  holder: string;
  /** The account it was approved for. A new account needs a new approval. */
  bankAccountNumber: string;
  approvedAt: number;
  approvedBy: string;
  approvedByName?: string | null;
}

export interface PayoutIdentityProfile {
  kycStatus?: KycStatus | string | null;
  kycVerifiedName?: string | null;
  /** Set by staff moderation (server-written only). */
  sellingSuspended?: boolean | null;
  payoutNameApproval?: PayoutNameApproval | null;
}

export type PayoutIdentityResult =
  | { ok: true }
  | { ok: false; kind: "block"; reason: "kyc_not_verified" | "selling_suspended"; message: string }
  | { ok: false; kind: "hold"; reason: "name_mismatch"; message: string };

// Words that appear on one side and not the other without meaning a different
// person: patronymic links (bin, binti, a/l, a/p once split) and titles.
// Single letters are dropped too, since initials and "A/L" come out as those.
const FILLER = new Set([
  "BIN", "BINTI", "BINTE", "BTE", "BT", "BN", "AL", "AP",
  "MR", "MRS", "MS", "MISS", "MDM", "DR",
]);

/** Upper-case name tokens with punctuation, accents and filler removed. */
export const nameTokens = (name: string | null | undefined): string[] =>
  String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !FILLER.has(t));

/**
 * Whether a bank account holder name is plausibly the verified person.
 *
 * Loose on purpose. Banks truncate long names, drop "bin", and people write
 * "Tan Ah Kow" as "TAN AHKOW"; flagging those would train staff to approve
 * without looking. What it does catch is a different person's name.
 *
 * Matches when the names are the same after normalising, the same with the
 * spaces removed, or when every word of the shorter one (two words or more)
 * appears in the longer one, allowing the last word to be cut short the way
 * banks cut a name to fit a field.
 */
export const namesLooselyMatch = (
  verified: string | null | undefined,
  holder: string | null | undefined,
): boolean => {
  const a = nameTokens(verified);
  const b = nameTokens(holder);
  if (!a.length || !b.length) return false;
  if (a.join("") === b.join("")) return true;

  // Every word of `short` (two or more) is in `long`; the last may be cut.
  const covers = (short: string[], long: string[]) => {
    if (short.length < 2 || short.length > long.length) return false;
    const pool = [...long];
    return short.every((t, i) => {
      const last = i === short.length - 1;
      const at = pool.findIndex((p) => p === t || (last && t.length >= 3 && p.startsWith(t)));
      if (at === -1) return false;
      pool.splice(at, 1);
      return true;
    });
  };
  return covers(a, b) || covers(b, a);
};

/** Staff approved this exact holder name on this exact account. */
export const payoutNameApproved = (
  approval: PayoutNameApproval | null | undefined,
  recipient: { name: string; bankAccountNumber: string },
): boolean =>
  !!approval &&
  approval.holder === recipient.name &&
  approval.bankAccountNumber === recipient.bankAccountNumber;

export const PAYOUT_IDENTITY_MESSAGES = {
  kyc_not_verified:
    "Payouts need a verified identity. Verify your identity again in Seller settings, then request the payout.",
  selling_suspended:
    "Payouts are paused while your selling account is suspended. Contact TCGo through the Help Center.",
  name_mismatch:
    "The bank account name doesn't match the name on your verified ID, so our team will check it before the money is sent.",
} as const;

export const checkPayoutIdentity = (
  profile: PayoutIdentityProfile | null | undefined,
  recipient: { name: string; bankAccountNumber: string },
): PayoutIdentityResult => {
  if (profile?.sellingSuspended === true) {
    return {
      ok: false,
      kind: "block",
      reason: "selling_suspended",
      message: PAYOUT_IDENTITY_MESSAGES.selling_suspended,
    };
  }
  if (!isKycVerified((profile?.kycStatus ?? null) as KycStatus | null)) {
    return {
      ok: false,
      kind: "block",
      reason: "kyc_not_verified",
      message: PAYOUT_IDENTITY_MESSAGES.kyc_not_verified,
    };
  }
  // A verification from before the name was kept has nothing to compare
  // against, so it's held the same way rather than waved through.
  if (
    !namesLooselyMatch(profile?.kycVerifiedName, recipient.name) &&
    !payoutNameApproved(profile?.payoutNameApproval, recipient)
  ) {
    return {
      ok: false,
      kind: "hold",
      reason: "name_mismatch",
      message: PAYOUT_IDENTITY_MESSAGES.name_mismatch,
    };
  }
  return { ok: true };
};

/**
 * The IC a payout is sent with.
 *
 * The one Didit read off the MyKad wins: it's server-written and the seller
 * can't replace it. The typed one is used only for a seller whose
 * verification didn't yield a MyKad number (or predates keeping it).
 */
export const payoutIdentityNumber = (p: {
  kycIdentityNumber?: string | null;
  identityNumber?: string | null;
} | null | undefined): string =>
  String(p?.kycIdentityNumber || p?.identityNumber || "").replace(/[\s-]/g, "");

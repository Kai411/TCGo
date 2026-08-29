// Didit identity verification — shared constants and status handling.
//
// The workflow id is deliberately NOT an environment variable: it's
// per-session configuration chosen in the create-session body, not a secret.
// Keeping it here means the server route and any future workflow (a lighter
// one for buyers, say) read from one list.

// ── THE SWITCH ────────────────────────────────────────────────────────
//
// Set to false to stop requiring identity verification before someone can
// sell. Everything else stays wired up: the webhook still records decisions,
// the card still lets people verify voluntarily, and admins still see who
// verified. Only the *gate* is lifted.
//
// Flipping this back to true does NOT re-gate the database on its own —
// firestore.rules carries its own kycRequired() switch, and rules have to be
// deployed. Change both, together, or the browser and the database will
// disagree about who's allowed to sell.
export const KYC_REQUIRED = false;

export const DIDIT_BASE = "https://verification.didit.me";

/** "Compliance workflow" — ID document + liveness + face match. */
export const DIDIT_KYC_WORKFLOW_ID = "dbd8c518-dc97-4fc7-ab73-f1cff1c87bfe";

/** Reject webhooks whose timestamp is further than this from now (replay guard). */
export const DIDIT_WEBHOOK_MAX_SKEW_SECONDS = 300;

// Exact, case-sensitive session status literals from Didit.
export type DiditStatus =
  | "Not Started"
  | "In Progress"
  | "Awaiting User"
  | "In Review"
  | "Approved"
  | "Declined"
  | "Resubmitted"
  | "Abandoned"
  | "Expired"
  | "Kyc Expired";

// What we store on the user profile. Deliberately a smaller set than Didit's:
// the profile only needs to answer "can this person sell", so the transient
// states collapse into one "in progress".
export type KycStatus =
  | "none"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "declined"
  | "expired";

/**
 * Map a Didit status onto our profile state.
 *
 * Returning null means "no profile change" — used for the noisy progress
 * events that would otherwise churn the user document on every step of the
 * hosted flow without telling us anything new.
 */
export const kycStatusFor = (status: string): KycStatus | null => {
  switch (status) {
    case "Approved":
      return "verified";
    case "Declined":
      return "declined";
    case "In Review":
      return "pending_review";
    case "Resubmitted":
    case "In Progress":
    case "Awaiting User":
      return "in_progress";
    // A previously verified user whose KYC aged out is NOT the same as one who
    // never verified — they must re-verify, so this can't collapse to "none".
    case "Kyc Expired":
      return "expired";
    case "Expired":
    case "Abandoned":
      // The session died without a decision. Fall back so the user can retry;
      // it must not read as declined, which sounds like a rejection.
      return "none";
    default:
      return null;
  }
};

/** Only a completed, approved verification counts. */
export const isKycVerified = (s: KycStatus | undefined | null): boolean =>
  s === "verified";

/**
 * Whether this profile may sell.
 *
 * Separate from isKycVerified on purpose: "has verified" is a fact about the
 * person and stays true regardless, while "may sell" is a policy that
 * KYC_REQUIRED can relax. Call sites that gate access want this one.
 */
export const kycGatePassed = (s: KycStatus | undefined | null): boolean =>
  !KYC_REQUIRED || isKycVerified(s);

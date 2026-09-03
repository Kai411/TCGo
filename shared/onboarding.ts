// What a new account must finish before it can buy or sell.
//
// One definition, read by the middleware that blocks, the page that collects,
// and any screen that wants to show progress — so "you still need X" and the
// thing that actually stops you can never disagree.
//
// BUYING ASKS FOR TWO THINGS
//   1. Confirm the email      — proves the address can receive the code
//   2. Delivery address       — nothing can be quoted or shipped without one
//
// Identity verification is NOT here. Buying is the low-risk direction: money
// leaves the buyer and cards come back, and demanding a document scan to spend
// money is the fastest way to lose someone who has not yet seen the product
// work. It is required to SELL — see SELLER_STEPS below, where money flows the
// other way.
//
// NOT PHONE. There is no SMS provider on this project, so a phone number is
// collected as contact detail and never verified. The old beta program gated
// on a WhatsApp check that could not actually be performed.

import { isKycVerified, type KycStatus } from "~/shared/didit";

export type OnboardingStepId = "email" | "address";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  /** What the user gets by finishing it — not what we get. */
  blurb: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "email",
    title: "Confirm your email",
    blurb: "So we can send order updates and receipts.",
  },
  {
    id: "address",
    title: "Delivery address",
    blurb: "Where your cards get sent. Shipping is quoted from it.",
  },
];

/** The subset of a profile these checks read. Shape-tolerant like the rest. */
export interface OnboardingView {
  deliveryName?: string | null;
  deliveryPhone?: string | null;
  deliveryAddress1?: string | null;
  deliveryPostcode?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  kycStatus?: string | null;
}

/**
 * Enough of an address to quote a courier and print a label.
 *
 * address2 is deliberately absent: a unit number is optional in Malaysia and
 * demanding one blocks anyone in a landed house.
 */
export const hasDeliveryAddress = (p: OnboardingView | null | undefined): boolean =>
  !!(
    p?.deliveryName?.trim() &&
    p?.deliveryPhone?.trim() &&
    p?.deliveryAddress1?.trim() &&
    p?.deliveryPostcode?.trim() &&
    p?.deliveryCity?.trim() &&
    p?.deliveryState?.trim()
  );

/**
 * Reads through isKycVerified rather than comparing a string here.
 *
 * Didit reports "Approved"; kycStatusFor() maps that to the stored value
 * "verified". Writing `=== "approved"` in this file — which is what it said
 * first — is a check that can never pass, and it would have made onboarding
 * impossible to finish rather than failing loudly.
 */
export const hasIdentity = (p: OnboardingView | null | undefined): boolean =>
  isKycVerified(p?.kycStatus as KycStatus | undefined);

export interface OnboardingState {
  /** Steps still outstanding, in the order they should be done. */
  remaining: OnboardingStepId[];
  /** The one to show now. Null when there's nothing left. */
  current: OnboardingStepId | null;
  complete: boolean;
  /** 0–100, for a progress bar. */
  percent: number;
}

/**
 * @param emailVerified from the Auth token, not the profile document — the
 *        token is the only place it can't be forged from the client.
 */
export const onboardingState = (
  p: OnboardingView | null | undefined,
  emailVerified: boolean,
): OnboardingState => {
  const done: Record<OnboardingStepId, boolean> = {
    email: emailVerified,
    address: hasDeliveryAddress(p),
  };
  const remaining = ONBOARDING_STEPS.filter((s) => !done[s.id]).map((s) => s.id);
  const finished = ONBOARDING_STEPS.length - remaining.length;
  return {
    remaining,
    current: remaining[0] ?? null,
    complete: remaining.length === 0,
    percent: Math.round((finished / ONBOARDING_STEPS.length) * 100),
  };
};

/**
 * Routes reachable with setup unfinished.
 *
 * Kept deliberately small, and it must include everything needed to FINISH —
 * plus the way out. A gate that traps someone with no route to sign out is
 * worse than no gate: they can't fix it and they can't leave.
 */
const OPEN_PREFIXES = [
  "/onboarding",
  "/login",
  "/landing",
  "/privacy-policy",
  "/terms",
  "/update-notice",
];

export const isOnboardingExempt = (path: string): boolean =>
  OPEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

// ── Selling ───────────────────────────────────────────────────────────
//
// A different bar, because money flows the other way. A buyer spends their
// own money; a seller receives someone else's, and ships a thing that has to
// arrive. So this asks for identity, a bank account, somewhere to collect
// from, and how they hand parcels over.
//
// eKYC lives HERE rather than in buyer onboarding. The bank account is
// already a real-identity anchor — you need an IC to open one in Malaysia —
// but it proves an account exists, not that the person holding it is who
// they say. That gap is what matters before money moves.
//
// RESUMABLE BY CONSTRUCTION.
// There is no stored cursor. Each step writes its own fields as it completes,
// and the current step is derived from what is still missing — so closing the
// tab and coming back lands exactly where they left off, and a step that was
// finished can never be asked for twice.

export type SellerStepId = "identity" | "contact" | "bank" | "handover";

export interface SellerStep {
  id: SellerStepId;
  title: string;
  blurb: string;
}

export const SELLER_STEPS: SellerStep[] = [
  {
    id: "identity",
    title: "Verify your identity",
    blurb: "Your MyKad and a selfie. Buyers see a Verified badge.",
  },
  {
    id: "contact",
    title: "Contact and pickup address",
    blurb: "Where couriers collect, and how buyers reach you.",
  },
  {
    id: "bank",
    title: "Bank account",
    blurb: "Where your sales get paid out.",
  },
  {
    id: "handover",
    title: "How you send parcels",
    blurb: "Drop-off or collection — it decides which rates you're quoted.",
  },
];

export interface SellerOnboardingView extends OnboardingView {
  phone?: string | null;
  whatsappNumber?: string | null;
  pickupAddress1?: string | null;
  pickupPostcode?: string | null;
  pickupCity?: string | null;
  pickupState?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  identityNumber?: string | null;
  handoverPreference?: string | null;
}

export const hasSellerContact = (p: SellerOnboardingView | null | undefined): boolean =>
  !!(
    (p?.phone?.trim() || p?.whatsappNumber?.trim()) &&
    p?.pickupAddress1?.trim() &&
    p?.pickupPostcode?.trim() &&
    p?.pickupCity?.trim() &&
    p?.pickupState?.trim()
  );

/**
 * Everything Billplz needs to send a payout.
 *
 * Mirrors payoutDetailsComplete() in shared/payout-details.ts, which is the
 * authority at payout time. Kept as a plain field check here so this module
 * stays dependency-light for the middleware; the two must agree, and the
 * test suite asserts that they do.
 */
export const hasBankDetails = (p: SellerOnboardingView | null | undefined): boolean =>
  !!(
    p?.bankCode?.trim() &&
    p?.bankAccountNumber?.trim() &&
    p?.bankAccountHolder?.trim() &&
    p?.identityNumber?.trim()
  );

export const hasHandover = (p: SellerOnboardingView | null | undefined): boolean =>
  p?.handoverPreference === "dropoff" || p?.handoverPreference === "pickup";

export interface SellerOnboardingState {
  remaining: SellerStepId[];
  current: SellerStepId | null;
  complete: boolean;
  percent: number;
}

export const sellerOnboardingState = (
  p: SellerOnboardingView | null | undefined,
): SellerOnboardingState => {
  const done: Record<SellerStepId, boolean> = {
    identity: hasIdentity(p),
    contact: hasSellerContact(p),
    bank: hasBankDetails(p),
    handover: hasHandover(p),
  };
  const remaining = SELLER_STEPS.filter((s) => !done[s.id]).map((s) => s.id);
  const finished = SELLER_STEPS.length - remaining.length;
  return {
    remaining,
    current: remaining[0] ?? null,
    complete: remaining.length === 0,
    percent: Math.round((finished / SELLER_STEPS.length) * 100),
  };
};

/**
 * Seller routes reachable before setup is finished.
 *
 * The onboarding page itself, and settings — because a seller who needs to
 * correct something they already entered should not have to finish a flow to
 * reach the form that fixes it.
 */
const SELLER_OPEN = ["/seller/onboarding", "/seller/settings", "/seller/verify"];

export const isSellerOnboardingExempt = (path: string): boolean =>
  SELLER_OPEN.some((p) => path === p || path.startsWith(p + "/"));

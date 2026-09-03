// What a new account must finish before it can buy or sell.
//
// One definition, read by the middleware that blocks, the page that collects,
// and any screen that wants to show progress — so "you still need X" and the
// thing that actually stops you can never disagree.
//
// THREE STEPS, IN THIS ORDER
//   1. Confirm the email      — proves the address can receive the code
//   2. Delivery address       — nothing can be quoted or shipped without one
//   3. Identity (eKYC)        — Didit; required before money moves
//
// Ordered by cost to the user, cheapest first: a code they already have in
// their inbox, then a form, then a document scan. Someone who abandons at
// step 3 has still given us a usable account.
//
// NOT PHONE. There is no SMS provider on this project, so a phone number is
// collected as contact detail and never verified. The old beta program gated
// on a WhatsApp check that could not actually be performed.

import { isKycVerified, type KycStatus } from "~/shared/didit";

export type OnboardingStepId = "email" | "address" | "identity";

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
  {
    id: "identity",
    title: "Verify your identity",
    blurb: "A quick ID check. Keeps the marketplace free of fake accounts.",
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
    identity: hasIdentity(p),
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

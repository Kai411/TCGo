// Facts the legal pages quote: who runs TCGo, how to reach us, and the
// numbers each policy promises.
//
// ONE PLACE TO FILL IN
// ────────────────────
// Every [BRACKETED] value below is a placeholder that must be replaced
// before launch. The four policy pages (/terms, /privacy-policy,
// /refund-policy, /seller-policy) read from here, so a value typed once is
// right everywhere.
//
// Numbers the app already enforces (commission, cancellation window, payout
// hold, auction payment window, refund fee) are imported from the files
// that enforce them, so a policy can never promise one thing while the code
// does another. Numbers the code does NOT enforce yet are policy defaults
// and are marked as such: change them here if you decide differently.
//
// Bump LEGAL_VERSION whenever the wording of any policy changes in a way a
// user should be told about.
//
// DRAFTS, NOT LEGAL ADVICE. Have a Malaysian lawyer review before launch.

import { CANCEL_GRACE_MINUTES } from "~/shared/order-windows";
import { PAYOUT_HOLD_DAYS } from "~/shared/payouts";
import { AUCTION_PAYMENT_WINDOW_HOURS } from "~/shared/auctions";
import {
  MARKETPLACE_MONTHLY,
  POS_PLATFORM_RATE,
  STANDARD_RATE,
  WITHDRAWAL_FEE,
} from "~/shared/pricing";
import { REFUND_FEE_CAP, REFUND_FEE_RATE } from "~/shared/refunds";
import { HIGH_VALUE_THRESHOLD } from "~/shared/photo-policy";
import { SELLER_REPLY_BUSINESS_DAYS } from "~/shared/order-problems";

export const LEGAL_VERSION = "2026-10-07";
export const LEGAL_EFFECTIVE_DATE = "7 October 2026";

// ── Who we are (placeholders) ─────────────────────────────────────────
export const OPERATOR = {
  /** Name exactly as registered with SSM. */
  legalName: "[BUSINESS NAME AS REGISTERED WITH SSM]",
  /** SSM registration number. */
  registrationNo: "[SSM REGISTRATION NO.]",
  /** Registered business address. */
  address: "[REGISTERED BUSINESS ADDRESS, MALAYSIA]",
  /** General and order support. */
  supportEmail: "[SUPPORT EMAIL]",
  /** Privacy requests and the Data Protection Officer, if appointed. */
  privacyEmail: "[PRIVACY EMAIL]",
  /** Optional phone or WhatsApp line for complaints. */
  phone: "[SUPPORT PHONE / WHATSAPP]",
} as const;

// ── Numbers the app already enforces ──────────────────────────────────
const pct = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;
const rm = (n: number) => `RM ${n.toFixed(2)}`;

export const POLICY_NUMBERS = {
  commission: pct(STANDARD_RATE),
  posFee: pct(POS_PLATFORM_RATE),
  withdrawalFee: rm(WITHDRAWAL_FEE),
  premiumMonthly: rm(MARKETPLACE_MONTHLY),
  cancelMinutes: CANCEL_GRACE_MINUTES,
  cancelFeePercent: pct(REFUND_FEE_RATE),
  cancelFeeCap: rm(REFUND_FEE_CAP),
  /** Days after delivery before an order's money can go to the seller. */
  payoutHoldDays: PAYOUT_HOLD_DAYS,
  auctionPayHours: AUCTION_PAYMENT_WINDOW_HOURS,
  highValuePhotoThreshold: `RM ${HIGH_VALUE_THRESHOLD}`,
  /** Business days a seller is asked to answer a reported problem. */
  sellerReplyBusinessDays: SELLER_REPLY_BUSINESS_DAYS,
} as const;

// ── Policy defaults (not enforced by code yet; change if you decide) ──
export const POLICY_DEFAULTS = {
  /**
   * Days after delivery a buyer has to report a problem. Matches the payout
   * hold so a claim always arrives before the seller is paid.
   */
  claimWindowDays: PAYOUT_HOLD_DAYS,
  /** Business days a seller has to ship after the cancellation window closes. */
  shipWithinBusinessDays: 2,
  /** Business days for TCGo to send an approved refund. */
  refundWithinBusinessDays: 7,
  /** Days a buyer has to send back an item after a return is approved. */
  returnShipDays: 5,
  /** Floor of TCGo's liability cap, in RM. */
  liabilityFloorRm: 100,
  /** Minimum age to hold an account without a parent or guardian. */
  minimumAge: 18,
  /** Days of notice before a material change to these terms takes effect. */
  changeNoticeDays: 14,
} as const;

export const LEGAL_LINKS = [
  { to: "/terms", label: "Terms of Use" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/seller-policy", label: "Seller Policy" },
] as const;

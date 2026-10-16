// "Report a problem": what a buyer can raise about a paid order, and how it
// moves from there.
//
// THE ORDER OF THINGS
// ───────────────────
// 1. The buyer reports it. The order's money is held from that moment, so
//    the seller can't be paid while it's open.
// 2. Buyer and seller sort it out between themselves first. The seller can
//    reply, or agree to a full refund. The buyer can say it's resolved.
// 3. Only if they can't agree does either of them ask TCGo to step in. TCGo
//    then decides one thing: whether the held money goes back to the buyer
//    or on to the seller.
//
// This mirrors the Refund Policy. Change one, change the other.
//
// Shared by the order page (client), the problem routes (server) and the
// tests. Dependency-light for Nitro.

import { PAYOUT_HOLD_DAYS, PAYOUT_HOLDING_PROBLEM_STATUSES } from "~/shared/payouts";
import { graceEndsAt } from "~/shared/order-windows";

/**
 * Days after delivery a buyer can report a problem. Equal to the payout
 * hold, so a report always lands while the money is still with TCGo.
 */
export const CLAIM_WINDOW_DAYS = PAYOUT_HOLD_DAYS;
export const CLAIM_WINDOW_MS = CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Business days the seller is asked to reply within. Policy, not enforced. */
export const SELLER_REPLY_BUSINESS_DAYS = 2;

export const PROBLEM_DETAILS_MAX = 1000;
export const PROBLEM_MESSAGE_MAX = 1000;
/** Messages kept on the order. Enough for a real conversation, bounded. */
export const PROBLEM_MESSAGES_MAX = 30;

export const PROBLEM_REASONS = [
  { code: "not_received", label: "My order hasn't arrived" },
  { code: "not_as_described", label: "It's not as described (wrong card, worse condition, missing items)" },
  { code: "counterfeit", label: "I think it's fake" },
  { code: "damaged", label: "It arrived damaged" },
  { code: "not_shipped", label: "The seller hasn't shipped it" },
  { code: "other", label: "Something else" },
] as const;

export type ProblemReasonCode = (typeof PROBLEM_REASONS)[number]["code"];

export const problemReasonLabel = (code: string | undefined): string =>
  PROBLEM_REASONS.find((r) => r.code === code)?.label ?? "Other";

/**
 * open           buyer reported it; buyer and seller talking
 * refund_agreed  seller agreed to refund in full; TCGo sends it
 * escalated      one of them asked TCGo to decide
 * resolved       buyer says it's sorted; money goes to the seller as normal
 * refunded       TCGo decided (or the seller agreed) the buyer gets it back
 * released       TCGo decided the seller keeps it
 */
export type ProblemStatus =
  | "open"
  | "refund_agreed"
  | "escalated"
  | "resolved"
  | "refunded"
  | "released";

export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = {
  open: "Open: buyer and seller are sorting it out",
  refund_agreed: "Seller agreed to a refund",
  escalated: "TCGo is reviewing",
  resolved: "Resolved",
  refunded: "Refund approved",
  released: "Closed: payment released to the seller",
};

export interface ProblemMessage {
  by: "buyer" | "seller" | "tcgo";
  text: string;
  at: number;
}

export interface OrderProblem {
  status: ProblemStatus;
  reasonCode: ProblemReasonCode;
  details: string;
  openedAt: number;
  messages?: ProblemMessage[];
  escalatedAt?: number | null;
  escalatedBy?: "buyer" | "seller" | null;
  closedAt?: number | null;
  /** TCGo's note when it decides an escalated problem. */
  decisionNote?: string | null;
}

export const isProblemActive = (p: { status?: string } | null | undefined): boolean =>
  PAYOUT_HOLDING_PROBLEM_STATUSES.includes(p?.status ?? "");

interface ReportableOrder {
  status?: string | null;
  paymentMethod?: string | null;
  paidAt?: number | null;
  createdAt?: number | null;
  deliveredAt?: number | null;
  shipmentOrderNo?: string | null;
  payoutStatus?: string | null;
  refundStatus?: string | null;
  problem?: { status?: string } | null;
}

/**
 * Whether the buyer can report a problem now, and if not, why not.
 *
 * The server runs the same check, so the button and the route always agree.
 */
export const canReportProblem = (
  o: ReportableOrder | null | undefined,
  now = Date.now(),
): { ok: boolean; reason?: string } => {
  if (!o) return { ok: false, reason: "Order not found." };
  if (o.paymentMethod !== "billplz") {
    return { ok: false, reason: "Only orders paid through TCGo checkout are covered by Buyer Protection." };
  }
  if (o.problem && o.problem.status) {
    return { ok: false, reason: "A problem has already been reported for this order." };
  }
  if (o.refundStatus) return { ok: false, reason: "This order has already been refunded." };
  if (["queued", "processing", "paid"].includes(o.payoutStatus ?? "")) {
    return { ok: false, reason: "The seller has already been paid for this order. Contact support." };
  }

  if (o.status === "delivered") {
    if (!o.deliveredAt) return { ok: true };
    if (now > o.deliveredAt + CLAIM_WINDOW_MS) {
      return {
        ok: false,
        reason: `Problems can be reported up to ${CLAIM_WINDOW_DAYS} days after delivery. Contact support if the item is fake.`,
      };
    }
    return { ok: true };
  }
  if (o.status === "shipped") return { ok: true };
  if (o.status === "paid" || o.status === "confirmed") {
    // Inside the cancellation window, cancelling is the quicker fix.
    const ends = graceEndsAt(o);
    if (ends != null && now < ends && !o.shipmentOrderNo) {
      return { ok: false, reason: "You can still cancel this order yourself." };
    }
    return { ok: true };
  }
  return { ok: false, reason: "This order can't have a problem reported." };
};

export type ProblemAction = "reply" | "agree_refund" | "escalate" | "resolve";

/** What each side may do next. */
export const problemActionsFor = (
  p: { status?: string } | null | undefined,
  role: "buyer" | "seller",
): ProblemAction[] => {
  if (p?.status === "open") {
    return role === "seller"
      ? ["reply", "agree_refund", "escalate"]
      : ["reply", "resolve", "escalate"];
  }
  if (p?.status === "escalated") {
    // Still talking is fine, and a buyer may withdraw. A seller agreeing to
    // refund settles it without TCGo having to decide.
    return role === "seller" ? ["reply", "agree_refund"] : ["reply", "resolve"];
  }
  return [];
};

export const validateProblemReport = (body: {
  reasonCode?: string;
  details?: string;
}): string | null => {
  if (!PROBLEM_REASONS.some((r) => r.code === body.reasonCode)) return "Choose what went wrong.";
  const details = String(body.details ?? "").trim();
  if (details.length < 10) return "Tell us a bit more about what happened.";
  if (details.length > PROBLEM_DETAILS_MAX) return `Keep it under ${PROBLEM_DETAILS_MAX} characters.`;
  return null;
};

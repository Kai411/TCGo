// Refunds for orders the buyer cancels after paying.
//
// Billplz has no refund API, so a refund is a Billplz Payment Order back to the
// buyer's own bank account. Only the buyer can supply those details, which is
// why cancelling a paid order is the buyer's action and collects them.
//
// Shared by the buyer's cancel form (client) and the cancel route (server) so
// both apply exactly the same rules. Dependency-light for Nitro.

import { bankByCode, checkBankAccount, normaliseAccountNumber } from "~/shared/banks";

/**
 * Deducted from a buyer-initiated refund.
 *
 * Recovers what the cancellation costs TCGo: RM 1.25 Billplz collected when
 * the buyer paid, plus RM 1.25 for the Payment Order that sends the money back.
 * Never more than the order total, so a refund can't go negative.
 */
export const REFUND_PROCESSING_FEE = 2.5;

export const CANCEL_REASONS = [
  { code: "changed_mind", label: "I changed my mind" },
  { code: "ordered_by_mistake", label: "I ordered by mistake" },
  { code: "found_better_price", label: "I found a better price elsewhere" },
  { code: "wrong_address", label: "I need to change the delivery address" },
  { code: "seller_slow", label: "The seller is taking too long to ship" },
  { code: "other", label: "Other" },
] as const;

export type CancelReasonCode = (typeof CANCEL_REASONS)[number]["code"];

export const cancelReasonLabel = (code: string | undefined): string =>
  CANCEL_REASONS.find((r) => r.code === code)?.label ?? "";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What the buyer paid, the fee, and what they get back. */
export const refundBreakdown = (orderTotal: number) => {
  const total = round2(Math.max(0, Number(orderTotal) || 0));
  const fee = round2(Math.min(REFUND_PROCESSING_FEE, total));
  return { total, fee, amount: round2(total - fee) };
};

// ── IC (MyKad) ────────────────────────────────────────────────────────
//
// Format-only, like the bank account check: 12 digits, the first six a
// plausible YYMMDD. It catches typos; it can't prove the IC belongs to the
// account holder.

export const normaliseIc = (raw: string | undefined): string =>
  (raw ?? "").replace(/[^0-9]/g, "");

export const checkIc = (raw: string | undefined): { ok: boolean; error?: string } => {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "IC number is required" };
  if (/[^0-9\s-]/.test(value)) return { ok: false, error: "IC number should contain digits only" };
  const digits = normaliseIc(value);
  if (digits.length !== 12) return { ok: false, error: "IC number must be 12 digits" };
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, error: "IC number doesn't look right — check the first 6 digits" };
  }
  return { ok: true };
};

// ── The form ──────────────────────────────────────────────────────────

export interface RefundForm {
  reasonCode: string;
  reasonNote: string;
  holderName: string;
  identityNumber: string;
  bankCode: string;
  bankAccountNumber: string;
}

export const emptyRefundForm = (): RefundForm => ({
  reasonCode: "",
  reasonNote: "",
  holderName: "",
  identityNumber: "",
  bankCode: "",
  bankAccountNumber: "",
});

export const OTHER_REASON_MAX = 300;

/** Field → message. Empty means the form can be submitted. */
export const validateRefundForm = (f: Partial<RefundForm> | null | undefined) => {
  const errors: Partial<Record<keyof RefundForm, string>> = {};
  const form = { ...emptyRefundForm(), ...(f ?? {}) };

  if (!CANCEL_REASONS.some((r) => r.code === form.reasonCode)) {
    errors.reasonCode = "Choose a reason";
  } else if (form.reasonCode === "other") {
    const note = form.reasonNote.trim();
    if (!note) errors.reasonNote = "Tell us why you're cancelling";
    else if (note.length > OTHER_REASON_MAX) errors.reasonNote = `Keep it under ${OTHER_REASON_MAX} characters`;
  }

  const name = form.holderName.trim();
  if (!name) errors.holderName = "Account holder name is required";
  else if (name.length < 3) errors.holderName = "Enter the full name on the bank account";

  const ic = checkIc(form.identityNumber);
  if (!ic.ok) errors.identityNumber = ic.error;

  if (!bankByCode(form.bankCode)) errors.bankCode = "Choose your bank";

  const acct = checkBankAccount(form.bankAccountNumber, form.bankCode);
  if (!acct.ok) errors.bankAccountNumber = acct.error;

  return errors;
};

/** The recipient as stored for staff and sent to Billplz. */
export const toRefundRecipient = (f: RefundForm) => ({
  name: f.holderName.trim(),
  identityNumber: normaliseIc(f.identityNumber),
  bankCode: f.bankCode,
  bankAccountNumber: normaliseAccountNumber(f.bankAccountNumber),
});

/** Last four digits, for anywhere an account or IC is shown. */
export const maskTail = (value: string | undefined, keep = 4): string => {
  const v = String(value ?? "");
  return v.length <= keep ? v : `•••• ${v.slice(-keep)}`;
};

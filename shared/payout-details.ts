// Whether a seller's profile carries everything Billplz Mass Payment needs to
// transfer money to them. Shared by the KYC gate (client) and the payout
// routes (server) so a seller can never reach "available funds" without the
// details we'd need to actually send it.

import { resolveBankCode, bankByCode } from "~/shared/banks";

export interface PayoutProfile {
  bankCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  identityNumber?: string;
}

export interface PayoutRecipient {
  bankCode: string;
  bankAccountNumber: string;
  name: string;
  identityNumber: string;
  // False for banks whose Billplz code we haven't confirmed — those need a
  // manual transfer rather than an automated instruction.
  autoPayoutSupported: boolean;
}

export const payoutDetailsComplete = (p: PayoutProfile | null | undefined): boolean =>
  !!p &&
  !!resolveBankCode(p.bankCode, p.bankName) &&
  !!p.bankAccountNumber &&
  !!p.bankAccountHolder &&
  !!p.identityNumber;

// Returns null when the profile is incomplete — callers must treat that as
// "cannot pay this seller yet", never as a reason to guess.
export const toPayoutRecipient = (
  p: PayoutProfile | null | undefined,
): PayoutRecipient | null => {
  if (!payoutDetailsComplete(p)) return null;
  const code = resolveBankCode(p!.bankCode, p!.bankName)!;
  return {
    bankCode: code,
    bankAccountNumber: String(p!.bankAccountNumber).replace(/[\s-]/g, ""),
    name: String(p!.bankAccountHolder).trim(),
    identityNumber: String(p!.identityNumber).replace(/[\s-]/g, ""),
    autoPayoutSupported: bankByCode(code)?.payoutSupported ?? false,
  };
};

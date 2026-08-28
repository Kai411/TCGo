// Malaysian banks with their Billplz bank codes.
//
// The code is what Billplz's Mass Payment API expects as `bank_code` — the
// bank's SWIFT/BIC. Shared by the seller KYC form (which stores the code on
// the profile) and the payout server routes (which send it to Billplz).
//
// Kept dependency-free so both the browser bundle and Nitro can import it.
//
// ⚠️ The four digital banks at the bottom (GX, Boost, AEON, KAF) are newer than
// the rest and their codes are not confirmed against Billplz's live bank list.
// Verify them in the Billplz dashboard before enabling payouts to those banks —
// `payoutSupported: false` keeps them selectable for display but blocks
// automated payout until confirmed.

export interface MyBank {
  code: string; // Billplz bank_code (SWIFT/BIC)
  name: string;
  payoutSupported: boolean;
  /** Sandbox-only test bank — never offered against production Billplz. */
  sandboxOnly?: boolean;
}

/**
 * Billplz's sandbox test bank. A Payment Order to this code settles as a
 * success; ANY other bank_code in sandbox is forced to fail, so payouts can't
 * be exercised end-to-end without it.
 */
export const SANDBOX_BANK_CODE = "DUMMYBANKVERIFIED";

export const MY_BANKS: MyBank[] = [
  { code: "MBBEMYKL", name: "Maybank", payoutSupported: true },
  { code: "CIBBMYKL", name: "CIMB Bank", payoutSupported: true },
  { code: "PBBEMYKL", name: "Public Bank", payoutSupported: true },
  { code: "RHBBMYKL", name: "RHB Bank", payoutSupported: true },
  { code: "HLBBMYKL", name: "Hong Leong Bank", payoutSupported: true },
  { code: "ARBKMYKL", name: "AmBank", payoutSupported: true },
  { code: "BIMBMYKL", name: "Bank Islam", payoutSupported: true },
  { code: "BKRMMYKL", name: "Bank Rakyat", payoutSupported: true },
  { code: "BSNAMYK1", name: "Bank Simpanan Nasional", payoutSupported: true },
  { code: "OCBCMYKL", name: "OCBC Bank", payoutSupported: true },
  { code: "UOVBMYKL", name: "UOB Bank", payoutSupported: true },
  { code: "HBMBMYKL", name: "HSBC Bank", payoutSupported: true },
  { code: "SCBLMYKX", name: "Standard Chartered", payoutSupported: true },
  { code: "PHBMMYKL", name: "Affin Bank", payoutSupported: true },
  { code: "MFBBMYKL", name: "Alliance Bank", payoutSupported: true },
  { code: "BMMBMYKL", name: "Bank Muamalat", payoutSupported: true },
  { code: "AGOBMYKL", name: "Agrobank", payoutSupported: true },
  { code: "CITIMYKL", name: "Citibank", payoutSupported: true },
  { code: "KFHOMYKL", name: "Kuwait Finance House", payoutSupported: true },
  { code: "RJHIMYKL", name: "Al Rajhi Bank", payoutSupported: true },
  { code: "AFBQMYKL", name: "MBSB Bank", payoutSupported: true },
  // Unverified codes — see the note at the top of this file.
  { code: "GXSPMYKL", name: "GXBank", payoutSupported: false },
  { code: "BSTBMYKL", name: "Boost Bank", payoutSupported: false },
  { code: "AEONMYKL", name: "AEON Bank", payoutSupported: false },
  { code: "KAFBMYKL", name: "KAF Digital Bank", payoutSupported: false },
  // Sandbox only — filtered out of the production picker by banksFor().
  {
    code: SANDBOX_BANK_CODE,
    name: "Dummy Bank (sandbox test)",
    payoutSupported: true,
    sandboxOnly: true,
  },
];

/**
 * Banks to offer in the picker. The sandbox test bank appears only when
 * running against Billplz sandbox, so it can't be selected in production.
 */
export const banksFor = (sandbox: boolean): MyBank[] =>
  MY_BANKS.filter((b) => (b.sandboxOnly ? sandbox : true));

// ── Account number validation ─────────────────────────────────────────
//
// Deliberately format-only. There is no free account-ownership check: Billplz
// has no verification endpoint, and real name-to-account matching is a paid
// bank service. So this catches typos and nothing more — a well-formed number
// can still belong to the wrong person, which is why the payout flow also
// records the holder name for the bank to match on.
//
// Kept loose on purpose. Malaysian account lengths vary by bank AND by account
// age (Maybank alone has 12- and 14-digit formats in circulation), so a strict
// per-bank length would reject legitimate sellers — a far worse failure than
// letting a typo through to a transfer that simply bounces.
export const ACCOUNT_MIN_DIGITS = 8;
export const ACCOUNT_MAX_DIGITS = 20;

export interface AccountCheck {
  ok: boolean;
  /** Blocking problem — the form should refuse to submit. */
  error?: string;
}

export const checkBankAccount = (
  raw: string | undefined,
  bankCode?: string,
): AccountCheck => {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Account number is required" };

  // The sandbox test bank ignores the account number entirely.
  if (bankCode === SANDBOX_BANK_CODE) return { ok: true };

  if (/[^0-9\s-]/.test(value)) {
    return { ok: false, error: "Account number should contain digits only" };
  }
  const digits = value.replace(/[\s-]/g, "");
  if (digits.length < ACCOUNT_MIN_DIGITS) {
    return { ok: false, error: `Too short — Malaysian accounts are at least ${ACCOUNT_MIN_DIGITS} digits` };
  }
  if (digits.length > ACCOUNT_MAX_DIGITS) {
    return { ok: false, error: `Too long — Malaysian accounts are at most ${ACCOUNT_MAX_DIGITS} digits` };
  }
  return { ok: true };
};

/** Digits only — what actually gets sent to Billplz. */
export const normaliseAccountNumber = (raw: string | undefined): string =>
  (raw ?? "").replace(/[^0-9]/g, "");

export const bankByCode = (code: string | undefined): MyBank | undefined =>
  MY_BANKS.find((b) => b.code === code);

export const bankName = (code: string | undefined): string =>
  bankByCode(code)?.name || code || "";

// Legacy profiles stored the bank's display name in `bankName` before codes
// existed. Resolve either shape to a code so old sellers don't have to re-enter
// anything they already gave us.
export const resolveBankCode = (
  bankCode: string | undefined,
  legacyName: string | undefined,
): string | undefined => {
  if (bankCode && bankByCode(bankCode)) return bankCode;
  if (!legacyName) return undefined;
  const norm = legacyName.trim().toLowerCase();
  return MY_BANKS.find((b) => b.name.toLowerCase() === norm)?.code;
};

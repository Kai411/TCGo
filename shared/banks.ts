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
}

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
];

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

// Who the seller is, as buyers see it on a listing or auction.
//
// WHY THIS EXISTS
// ───────────────
// Malaysia's Consumer Protection (Electronic Trade Transactions) Regulations
// expect a marketplace to show buyers who they are buying from. The Seller
// Policy (s.1, s.2) already promised it: a name or business name, an SSM
// number for businesses, and a way to make contact through TCGo. Until this
// file, listings only said "Sold by @username".
//
// WHAT IS SHOWN (kai's default, pending a lawyer's review)
//   business   → the business name and SSM number the seller typed
//   individual → the name on their verified MyKad, only with their consent
//
// WHERE IT LIVES
//   sellerDisclosures/{uid}   written only by the server
//                             (/api/account/seller-disclosure, the Didit
//                             webhook) and read through
//                             /api/sellers/{uid}/disclosure, so signed-out
//                             visitors see it too and no rules paste is
//                             needed for it to show.
//   users/{uid}.sellerType    so the owner's app knows the setup step is done.
//
// Shared by the client, the server and the tests. Keep it dependency-free.

export type SellerType = "individual" | "business";

export const SELLER_DISCLOSURES = "sellerDisclosures";

/**
 * Bump when the consent wording in SellerDisclosureForm changes in a way
 * sellers must agree to again. Stored with each consent record.
 */
export const SELLER_DISCLOSURE_VERSION = "2026-11-12";

/** What /api/sellers/{uid}/disclosure returns, and what listings render. */
export interface SellerDisclosure {
  type: SellerType;
  /** Verified MyKad name (individual) or registered business name. */
  name: string;
  /** Businesses only. */
  ssmNumber?: string | null;
}

export const isSellerType = (v: unknown): v is SellerType =>
  v === "individual" || v === "business";

/** The owner's profile has answered the "individual or business" step. */
export const hasSellerType = (p: { sellerType?: unknown } | null | undefined): boolean =>
  isSellerType(p?.sellerType);

/**
 * An SSM number, tidied for storage and display, or "" if it isn't one.
 *
 * Two shapes are in use:
 *   - 12 digits since October 2019, for every entity, including older ones
 *     that were renumbered: year, two-digit entity type, six-digit serial
 *     (202403123456).
 *   - The older numbers many sellers still quote: digits and a check letter
 *     for companies (123456-A), and for enterprises often a state prefix too
 *     (JM0123456-X). Stored with the dash before the check letter.
 */
export const normaliseSsm = (raw: unknown): string => {
  const s = String(raw ?? "").toUpperCase().replace(/[\s.]/g, "");
  if (!s) return "";
  const digits = s.replace(/-/g, "");
  if (/^(18|19|20)\d{2}0[1-9]\d{6}$/.test(digits)) return digits;
  const old = /^([A-Z]{0,3}\d{4,9})-?([A-Z])$/.exec(s);
  if (old) return `${old[1]}-${old[2]}`;
  return "";
};

export const BUSINESS_NAME_MAX = 120;

/** Collapse spacing; "" when too short or too long to be a real name. */
export const normaliseBusinessName = (raw: unknown): string => {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= BUSINESS_NAME_MAX ? s : "";
};

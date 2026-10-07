// Personal data that must never sit on the public profile document.
//
// WHY THIS EXISTS
// ───────────────
// users/{uid} is readable by every signed-in user, because public profile
// pages and listings show another member's name, photo, trust score and
// verified badge, and Firestore cannot hide individual fields on read. That
// made IC numbers, bank accounts, home addresses and phone numbers readable
// by anyone with an account: a PDPA problem, not a style one.
//
// So these fields live in users/{uid}/private/profile instead, which only
// the owner and admins can read. The owner's app merges the two documents
// back together (useMyProfile), and the server reads both through
// getUserProfile(), so code that reads `profile.bankAccountNumber` keeps
// working without knowing where the field is stored.
//
// Shared by the client, the server and the tests. Keep it dependency-free.

/** users/{uid}/private/{PRIVATE_PROFILE_DOC} */
export const PRIVATE_PROFILE_DOC = "profile";

/** Fields the owner writes themselves. Mirrored in firestore.rules. */
export const OWNER_PRIVATE_FIELDS = [
  // Payouts and refunds
  "identityNumber",
  "bankAccountNumber",
  "bankAccountHolder",
  // Contact
  "email",
  "phone",
  "whatsappNumber",
  // Where they live and ship from
  "addresses",
  "deliveryName",
  "deliveryPhone",
  "deliveryAddress1",
  "deliveryAddress2",
  "deliveryPostcode",
  "deliveryCity",
  "deliveryState",
  "pickupAddress1",
  "pickupAddress2",
  "pickupPostcode",
  "pickupCity",
  "pickupState",
] as const;

/** Fields only the server writes (identity results, merchant credentials). */
export const SERVER_PRIVATE_FIELDS = [
  "kycVerifiedName",
  "kycDocumentType",
  "kycIssuingState",
  "kycDeclineReason",
  "hitpayAccessToken",
  "hitpayMerchantKey",
] as const;

export const PRIVATE_FIELDS: readonly string[] = [
  ...OWNER_PRIVATE_FIELDS,
  ...SERVER_PRIVATE_FIELDS,
];

const PRIVATE_SET = new Set(PRIVATE_FIELDS);

export const isPrivateField = (key: string): boolean => PRIVATE_SET.has(key);

type Data = Record<string, unknown>;

/**
 * Split a profile write into the part for the public document and the part
 * for the private one.
 *
 * Adds `hasContact` to the public part whenever a contact number is written,
 * so the public profile can still say "Contact added" without the number.
 */
export const splitProfileWrite = (data: Data): { pub: Data; priv: Data } => {
  const pub: Data = {};
  const priv: Data = {};
  for (const [k, v] of Object.entries(data)) {
    if (isPrivateField(k)) priv[k] = v;
    else pub[k] = v;
  }
  const contactKeys = ["phone", "whatsappNumber"].filter((k) => k in priv);
  if (contactKeys.length) {
    const any = contactKeys.some((k) => !!String(priv[k] ?? "").trim());
    // A single blank field doesn't prove there's no number left on file, so
    // only clear the flag when every contact field is being blanked at once.
    if (any) pub.hasContact = true;
    else if (contactKeys.length === 2) pub.hasContact = false;
  }
  return { pub, priv };
};

/** Private fields still sitting on a public document (legacy data). */
export const legacyPrivateFields = (pub: Data | null | undefined): Data => {
  const out: Data = {};
  if (!pub) return out;
  for (const k of PRIVATE_FIELDS) {
    if (pub[k] !== undefined) out[k] = pub[k];
  }
  return out;
};

/**
 * The full profile: public fields, then private ones on top.
 *
 * Legacy copies on the public document are used only where the private
 * document has nothing, so a profile reads correctly before and after it has
 * been migrated.
 */
export const mergeProfile = <T extends Data>(
  pub: T | null | undefined,
  priv: Data | null | undefined,
): T | null => {
  if (!pub && !priv) return null;
  const merged: Data = { ...(pub ?? {}) };
  for (const [k, v] of Object.entries(priv ?? {})) {
    if (v !== undefined) merged[k] = v;
  }
  return merged as T;
};

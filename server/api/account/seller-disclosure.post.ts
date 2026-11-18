// Save what buyers see as the seller: individual or registered business.
//
// Through the server, not a direct Firestore write, because an individual's
// listings show the name from their verified MyKad. The browser can't be
// trusted to copy that name across, so the server reads it from the private
// profile (written only by the Didit webhook) and publishes it here, only
// once the seller has ticked the consent box. See shared/seller-disclosure.ts.

import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "~/server/utils/auth";
import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { getUserProfile } from "~/server/utils/user-profile";
import { isKycVerified } from "~/shared/didit";
import {
  SELLER_DISCLOSURES,
  SELLER_DISCLOSURE_VERSION,
  isSellerType,
  normaliseBusinessName,
  normaliseSsm,
} from "~/shared/seller-disclosure";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;

  const type = body.type;
  if (!isSellerType(type)) {
    throw createError({ statusCode: 400, message: "Choose individual or registered business." });
  }
  if (body.consent !== true) {
    throw createError({ statusCode: 400, message: "Tick the box to agree these details are shown to buyers." });
  }

  const db = getAdminFirestore();
  let name = "";
  let ssmNumber: string | null = null;

  if (type === "business") {
    name = normaliseBusinessName(body.businessName);
    if (!name) {
      throw createError({ statusCode: 400, message: "Add the business name exactly as registered with SSM." });
    }
    ssmNumber = normaliseSsm(body.ssmNumber);
    if (!ssmNumber) {
      throw createError({
        statusCode: 400,
        message: "That doesn't look like an SSM number. New numbers are 12 digits, e.g. 202403123456.",
      });
    }
  } else {
    const profile = (await getUserProfile(db, caller.uid)) ?? {};
    name = String(profile.kycVerifiedName ?? "").trim();
    if (!isKycVerified(profile.kycStatus) || !name) {
      throw createError({
        statusCode: 409,
        message: "Verify your identity first. Your listings show the name on your MyKad.",
      });
    }
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection(SELLER_DISCLOSURES).doc(caller.uid), {
    type,
    name,
    ssmNumber,
    consentVersion: SELLER_DISCLOSURE_VERSION,
    consentedAt: now,
    updatedAt: now,
  });
  batch.set(db.collection("users").doc(caller.uid), { sellerType: type }, { merge: true });
  // The consent itself, next to the PDPA ones, so it can be shown later
  // exactly what was agreed and when.
  batch.set(db.collection("users").doc(caller.uid).collection("consents").doc(), {
    version: SELLER_DISCLOSURE_VERSION,
    acceptedAt: now,
    source: "seller-disclosure",
    sellerType: type,
  });
  await batch.commit();

  return { type, name, ssmNumber };
});

// What buyers see as the seller on a listing or auction page.
//
// Public on purpose: the disclosure must reach signed-out visitors too, and
// users/{uid} is readable only when signed in. Returns only the fields in
// SellerDisclosure (never the consent record), or null when the seller hasn't
// answered the step yet. See shared/seller-disclosure.ts.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import {
  SELLER_DISCLOSURES,
  isSellerType,
  type SellerDisclosure,
} from "~/shared/seller-disclosure";

export default defineEventHandler(async (event): Promise<SellerDisclosure | null> => {
  const uid = getRouterParam(event, "uid") ?? "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw createError({ statusCode: 400, message: "Bad seller id" });
  }
  const snap = await getAdminFirestore().collection(SELLER_DISCLOSURES).doc(uid).get();
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const d = snap.exists ? snap.data() : null;
  if (!d || !isSellerType(d.type) || !d.name) return null;
  return {
    type: d.type,
    name: String(d.name),
    ssmNumber: d.type === "business" ? String(d.ssmNumber ?? "") || null : null,
  };
});

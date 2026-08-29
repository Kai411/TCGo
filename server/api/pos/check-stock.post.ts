// Pre-flight for the POS basket: is everything the seller scanned still sellable?
//
// Called when the seller taps Pay, before any QR appears. The point is to fail
// at the moment the seller can still do something about it — pull the card out
// of the pile — rather than after the customer has their phone out.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { checkStockAvailability, releaseExpiredReservations } from "~/server/utils/pos-reservations";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const { itemIds } = (await readBody(event)) as { itemIds?: string[] };

  if (!Array.isArray(itemIds) || !itemIds.length) {
    throw createError({ statusCode: 400, message: "itemIds required" });
  }
  if (itemIds.length > 200) {
    throw createError({ statusCode: 400, message: "Too many items in one sale" });
  }

  const db = getAdminFirestore();

  // Clear the seller's own lapsed holds first, so an abandoned sale from ten
  // minutes ago doesn't report its cards as unavailable to this one.
  await releaseExpiredReservations(db, caller.uid).catch(() => {});

  const blocked = await checkStockAvailability(db, itemIds, caller.uid);
  return { ok: blocked.length === 0, blocked };
});

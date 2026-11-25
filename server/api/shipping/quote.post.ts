// Live shipping quote for a cart group, one seller at a time.
//
// The cart calls this per seller (each has a different pickup postcode) with
// the buyer's saved delivery address, to show the price before checkout.
// Placing the order quotes again on the server (/api/orders/place) and that is
// the figure the order carries, so nothing returned here is trusted later.
//
// Authenticated because it reveals a seller's pickup postcode.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { quoteShippingForBuyer } from "~/server/utils/shipping";

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const body = (await readBody(event)) as {
    sellerUid?: string;
    itemCount?: number;
    destination?: { postcode?: string; city?: string; state?: string; address1?: string };
  };
  const { sellerUid, destination } = body;
  if (!sellerUid) throw createError({ statusCode: 400, message: "sellerUid required" });
  if (!destination?.postcode || !destination?.state) {
    throw createError({ statusCode: 400, message: "Delivery address required" });
  }

  const result = await quoteShippingForBuyer(getAdminFirestore(), {
    buyerUid: caller.uid,
    sellerUid,
    itemCount: Math.max(1, Number(body.itemCount) || 1),
    destination,
  });
  if (!result.available) {
    if (result.reason === "no_pickup_address") {
      throw createError({ statusCode: 400, message: "This seller hasn't set a pickup address yet" });
    }
    return { available: false, reason: "No courier serves this route right now." };
  }
  const q = result.quote;
  if (q.joinsOrderId) {
    return {
      available: true,
      shipping: q.shipping,
      joinsOrderId: q.joinsOrderId,
      joinsOrderShortId: q.joinsOrderId.slice(0, 8),
      joinFee: q.shipping,
      courier: q.courier,
      serviceId: q.serviceId,
      serviceCode: q.serviceCode,
      quotedRate: 0,
    };
  }
  return {
    available: true,
    shipping: q.shipping,
    weightKg: q.weightKg,
    quotedRate: q.quotedRate,
    serviceId: q.serviceId,
    serviceCode: q.serviceCode,
    courier: q.courier,
  };
});

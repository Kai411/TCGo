// Live shipping quote for a cart group, one seller at a time.
//
// The cart calls this per seller (each has a different pickup postcode) with
// the buyer's saved delivery address. Returns the price the buyer will actually
// be charged — cheapest usable courier plus the buffer from shared/shipping-quote.
//
// Authenticated because it reveals a seller's pickup postcode. The raw rate and
// the chosen service are returned too so the order can record what it was
// priced against.

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaQuote } from "~/server/utils/delyva";
import { parcelWeightKg } from "~/shared/parcel";
import { stateName } from "~/shared/my-states";
import { quoteForOrder, type HandoverPreference } from "~/shared/shipping-quote";

export default defineEventHandler(async (event) => {
  await requireUser(event);
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

  const db = getAdminFirestore();
  const sellerSnap = await db.collection("users").doc(sellerUid).get();
  const seller = sellerSnap.data() as any;
  if (!seller?.pickupPostcode || !seller?.pickupState) {
    throw createError({
      statusCode: 400,
      message: "This seller hasn't set a pickup address yet",
    });
  }

  // Same weight function the booking route uses, so the quote and the eventual
  // label describe the same parcel.
  const weightKg = parcelWeightKg({ items: new Array(Math.max(1, body.itemCount ?? 1)) });

  const rates = await delyvaQuote({
    origin: {
      address1: seller.pickupAddress1 || "",
      city: seller.pickupCity || "",
      state: stateName(seller.pickupState),
      postcode: String(seller.pickupPostcode),
      country: "MY",
    },
    destination: {
      address1: destination.address1 || "",
      city: destination.city || "",
      state: stateName(destination.state),
      postcode: String(destination.postcode),
      country: "MY",
    },
    weightKg,
  });

  const preference: HandoverPreference =
    seller.handoverPreference === "pickup" ? "pickup" : "dropoff";
  const quote = quoteForOrder(rates, preference, seller.preferredCouriers ?? []);
  if (!quote) {
    return { available: false, reason: "No courier serves this route right now." };
  }

  return {
    available: true,
    shipping: quote.buyerPrice,
    weightKg,
    // Recorded on the order so a later booking can be checked against what the
    // buyer was actually quoted.
    quotedRate: quote.rate.price,
    serviceId: quote.rate.serviceId,
    serviceCode: quote.rate.serviceCode,
    courier: quote.rate.courier,
  };
});

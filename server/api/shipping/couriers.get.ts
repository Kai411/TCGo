// Courier brands available to the signed-in seller.
//
// Delyva has no service-catalogue endpoint, and availability is route-
// dependent, so this quotes the seller's own pickup address against a West
// and an East Malaysia destination and returns the union. That's a truer
// list than a hardcoded one: it only offers couriers that actually serve
// them, and it costs nothing (quotes are free).

import { getAdminFirestore } from "~/server/utils/firebase-admin";
import { requireUser } from "~/server/utils/auth";
import { delyvaQuote } from "~/server/utils/delyva";
import { stateName } from "~/shared/my-states";
import { courierBrands } from "~/shared/shipping-quote";

// Two probe destinations — a peninsular city and an East Malaysian one.
const PROBES = [
  { address1: "Jalan Burma", city: "George Town", state: "png", postcode: "10050" },
  { address1: "Jalan Gaya", city: "Kota Kinabalu", state: "sbh", postcode: "88000" },
];

export default defineEventHandler(async (event) => {
  const caller = await requireUser(event);
  const db = getAdminFirestore();
  const seller = (await db.collection("users").doc(caller.uid).get()).data() as any;

  if (!seller?.pickupPostcode || !seller?.pickupState) {
    return { available: [], reason: "Add your pickup address first" };
  }

  const origin = {
    address1: seller.pickupAddress1 || "",
    city: seller.pickupCity || "",
    state: stateName(seller.pickupState),
    postcode: String(seller.pickupPostcode),
    country: "MY",
  };

  const brands: string[] = [];
  for (const p of PROBES) {
    try {
      const rates = await delyvaQuote({
        origin,
        destination: { ...p, state: stateName(p.state), country: "MY" },
        weightKg: 0.1,
      });
      for (const b of courierBrands(rates)) if (!brands.includes(b)) brands.push(b);
    } catch {
      // One unreachable probe shouldn't empty the list.
    }
  }

  return { available: brands, selected: seller.preferredCouriers ?? [] };
});

// Shipping region derivation.
//
// Orders carry a WM/EM region that decides which shipping rate applies. In the
// cart the buyer picks it by hand, which means it can disagree with the address
// they actually enter at payment time — you can't ship to Sabah at West
// Malaysia rates. The delivery address is the ground truth, so payment
// recomputes the region from it.

export type ShippingRegion = "WM" | "EM";

// State codes for East Malaysia (Sabah, Sarawak, Labuan).
const EAST_MALAYSIA_STATES = new Set(["sbh", "srw", "lbn"]);

export const regionForState = (stateCode: string | undefined): ShippingRegion =>
  EAST_MALAYSIA_STATES.has((stateCode || "").toLowerCase()) ? "EM" : "WM";

export interface ShippableOrder {
  subtotal?: number;
  shippingWM?: number;
  shippingEM?: number;
}

// The authoritative order total for a given destination.
export const totalForRegion = (order: ShippableOrder, region: ShippingRegion) => {
  const shipping = region === "EM" ? (order.shippingEM ?? 0) : (order.shippingWM ?? 0);
  const total = Math.round(((order.subtotal ?? 0) + shipping) * 100) / 100;
  return { shipping, total };
};

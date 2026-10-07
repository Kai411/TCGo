// Order-merge validation and maths — the single source of truth for folding
// several orders into one shipment. Used by the merge API route and by the
// seller UI's mergeable-group detection, so both agree on what can merge.
//
// Two modes, decided by the whole group's statuses:
//   unpaid — every order is pending/confirmed. Nothing has been collected,
//            so the merged order is re-priced and re-quoted at pay time.
//   paid   — every order is paid. The buyer's money is already in, so the
//            merged financials must add up to exactly what was collected:
//            sums of the recorded figures, never a recomputation.
//
// Structurally typed (no CompiledOrder import) so Nitro can use it without
// pulling in the Vue composable layer — same deal as shared/payouts.ts.

export type MergeMode = "unpaid" | "paid";

export interface MergeOrderItem {
  cardId: string;
  price: number;
  shippingWM?: number;
  shippingEM?: number;
  [k: string]: unknown;
}

export interface MergeableOrder {
  id: string;
  buyerUid: string;
  sellerUid: string;
  status: string;
  createdAt: number;
  items: MergeOrderItem[];
  subtotal?: number;
  shipping?: number;
  total?: number;
  region?: string;
  auctionId?: string;
  paymentAmountMismatch?: unknown;
  mergedInto?: string;
  deliveryAddress?: { address1?: string; postcode?: string } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Destination identity: postcode + first address line, case/space-blind.
// Empty when no address has been entered yet (unpaid orders).
const addressKey = (o: MergeableOrder): string => {
  const a = o.deliveryAddress;
  if (!a?.postcode) return "";
  return `${String(a.postcode).trim()}|${(a.address1 || "").trim().toLowerCase()}`;
};

export const UNPAID_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "confirmed",
]);

// Decide the merge mode, or throw with a human-readable reason. Auction
// orders never merge: their "item" is the auction doc, their payment has a
// deadline, and the settle flow assumes one auction per order.
export const mergeModeFor = (orders: MergeableOrder[]): MergeMode => {
  if (orders.length < 2) throw new Error("Select at least two orders to merge.");
  const first = orders[0]!;
  for (const o of orders) {
    if (o.buyerUid !== first.buyerUid || o.sellerUid !== first.sellerUid)
      throw new Error("Orders must be from the same buyer and seller.");
    if (o.auctionId) throw new Error("Auction orders can't be merged.");
    if (o.paymentAmountMismatch)
      throw new Error("An order has a flagged payment and can't be merged.");
    if (o.mergedInto) throw new Error("An order was already merged.");
  }
  const allUnpaid = orders.every((o) => UNPAID_STATUSES.has(o.status));
  const allPaid = orders.every((o) => o.status === "paid");
  if (!allUnpaid && !allPaid)
    throw new Error(
      "Paid and unpaid orders can't be combined — wait for payment to settle first.",
    );
  if (allPaid) {
    // One parcel goes to one door. Paid orders always carry an address
    // (payment requires one), so a mismatch is a real conflict.
    const keys = new Set(orders.map(addressKey));
    if (keys.size > 1)
      throw new Error("These orders were addressed to different destinations.");
  }
  return allPaid ? "paid" : "unpaid";
};

// Oldest first — index 0 survives, keeping the id both parties already know.
export const sortForMerge = <T extends MergeableOrder>(orders: T[]): T[] =>
  [...orders].sort((a, b) => a.createdAt - b.createdAt);

export const combineItems = (sorted: MergeableOrder[]): MergeOrderItem[] => {
  const seen = new Set<string>();
  const out: MergeOrderItem[] = [];
  for (const o of sorted) {
    for (const item of o.items ?? []) {
      if (seen.has(item.cardId)) continue;
      seen.add(item.cardId);
      out.push(item);
    }
  }
  return out;
};

// Nothing collected yet: re-price from the combined items. The caller resets
// shippingQuoted so create-bill re-quotes the combined parcel at pay time.
export const unpaidFinancials = (
  primary: MergeableOrder,
  items: MergeOrderItem[],
) => {
  const subtotal = round2(items.reduce((s, i) => s + (i.price || 0), 0));
  const shippingWM = items.reduce((m, i) => Math.max(m, i.shippingWM ?? 0), 0);
  const shippingEM = items.reduce((m, i) => Math.max(m, i.shippingEM ?? 0), 0);
  const shipping = primary.region === "EM" ? shippingEM : shippingWM;
  return { subtotal, shippingWM, shippingEM, shipping, total: round2(subtotal + shipping) };
};

// Money already in: the merged order records exactly what the buyer paid
// across the group. The buyer paid shipping per order; the platform ships
// once — the difference stays platform-side (shared/payouts.ts already keeps
// shipping with the platform whenever it booked the waybill).
export const paidFinancials = (orders: MergeableOrder[]) => {
  const subtotal = round2(orders.reduce((s, o) => s + (o.subtotal || 0), 0));
  const shipping = round2(orders.reduce((s, o) => s + (o.shipping || 0), 0));
  const total = round2(orders.reduce((s, o) => s + (o.total || 0), 0));
  return { subtotal, shipping, total, shippingWM: shipping, shippingEM: shipping };
};

// Grouping key for the seller UI: orders only merge when buyer AND
// destination match, so a buyer who bought twice to two different addresses
// never sees a merge button that the server would refuse.
export const mergeGroupKey = (o: MergeableOrder): string =>
  `${o.buyerUid}|${addressKey(o)}`;

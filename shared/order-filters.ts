// The buyer's order groups. Buyers think in "have I paid / is it coming / is
// it done", not in the internal status enum, so the filters collapse statuses
// into those groups. Shared by the Orders page filter pills and the status
// shortcuts on the account page, so a count on one matches the rows on the
// other.

export type OrderFilter = "all" | "topay" | "intransit" | "completed" | "cancelled";

export const ORDER_FILTER_IDS: readonly OrderFilter[] = [
  "all",
  "topay",
  "intransit",
  "completed",
  "cancelled",
];

export const ORDER_FILTER_LABELS: Record<OrderFilter, string> = {
  all: "All",
  topay: "To pay",
  // Renamed from "To receive": "In-transit" is what the order row says, and
  // two names for one idea reads as two different things.
  intransit: "In-transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const inOrderGroup = (status: string, f: OrderFilter): boolean => {
  if (f === "all") return true;
  if (f === "topay") return status === "pending" || status === "confirmed";
  // Everything between paid and the doorstep.
  if (f === "intransit") return status === "paid" || status === "shipped";
  if (f === "completed") return status === "delivered";
  return status === "cancelled";
};

/** Reads `?filter=` from a link (the account page's shortcuts); anything else is "all". */
export const parseOrderFilter = (value: unknown): OrderFilter =>
  ORDER_FILTER_IDS.includes(value as OrderFilter) ? (value as OrderFilter) : "all";

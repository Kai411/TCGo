// Where a parcel actually is, in words a buyer uses.
//
// The order's own `status` has three post-payment values — paid, shipped,
// delivered — which is enough to run the system and too coarse to read. "Ship
// it" and "it's two states from your door" are both `shipped`.
//
// So this layers the courier's own progress on top, without touching the
// status enum that payouts, queues and rules all key off.
//
// THE COURIER'S TEXT IS THE TRUTH; THESE BUCKETS ARE A SUMMARY.
// Delyva's numeric codes are bucketed below, and the boundary between
// "collected" and "in transit" is the one judgement call — delyvaStage()
// only distinguishes ≥500 (shipped) and ≥700 (delivered), so the split
// inside that range is ours. Every surface that shows a stage should also
// show `shipmentStatus`, the courier's own wording, so a mis-bucketed code
// is a slightly wrong heading above the right sentence rather than a lie.

export type DeliveryStage =
  | "awaiting_payment"
  | "preparing"
  | "ready"
  | "collected"
  | "in_transit"
  | "delivered"
  | "cancelled";

export interface DeliveryView {
  status?: string | null;
  /** Set once a label is bought. */
  shipmentOrderNo?: string | null;
  /** Delyva's numeric code, when tracking has been read. */
  shipmentStatusCode?: number | null;
  mergedInto?: string | null;
}

/** Where "collected" ends and "in transit" begins. Provisional — see above. */
export const COLLECTED_CODE_MIN = 500;
export const IN_TRANSIT_CODE_MIN = 550;
export const DELIVERED_CODE_MIN = 700;
export const CANCELLED_CODE_MIN = 900;

export const deliveryStage = (o: DeliveryView | null | undefined): DeliveryStage => {
  if (!o) return "preparing";
  if (o.status === "cancelled") return "cancelled";
  if (o.status === "delivered") return "delivered";
  if (o.status === "pending" || o.status === "confirmed") return "awaiting_payment";

  const code = typeof o.shipmentStatusCode === "number" ? o.shipmentStatusCode : null;
  if (code !== null) {
    if (code >= CANCELLED_CODE_MIN || code === 99) return "cancelled";
    if (code >= DELIVERED_CODE_MIN) return "delivered";
    if (code >= IN_TRANSIT_CODE_MIN) return "in_transit";
    if (code >= COLLECTED_CODE_MIN) return "collected";
  }

  // No tracking read yet. `shipped` means the courier has it — which is what
  // "collected" describes — and before that the only question is whether a
  // label exists.
  if (o.status === "shipped") return "collected";
  return o.shipmentOrderNo ? "ready" : "preparing";
};

export const DELIVERY_STAGE_LABEL: Record<DeliveryStage, string> = {
  awaiting_payment: "Awaiting payment",
  preparing: "Arranging delivery",
  ready: "Ready to ship",
  collected: "Collected",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const DELIVERY_STAGE_COLOR: Record<DeliveryStage, string> = {
  awaiting_payment: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  preparing: "bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-zinc-300",
  ready: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  collected: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  in_transit: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export const deliveryStageLabel = (o: DeliveryView): string => {
  // A merged child is not a parcel of its own; saying "Preparing" would
  // promise a second delivery that is never coming.
  if (o?.mergedInto) return "Combined";
  return DELIVERY_STAGE_LABEL[deliveryStage(o)];
};

export const deliveryStageColor = (o: DeliveryView): string =>
  o?.mergedInto
    ? "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-zinc-400"
    : DELIVERY_STAGE_COLOR[deliveryStage(o)];

/** Past this, the buyer is waiting rather than doing. */
export const isOnItsWay = (o: DeliveryView): boolean => {
  const s = deliveryStage(o);
  return s === "ready" || s === "collected" || s === "in_transit";
};

/**
 * Orders that are the buyer's or seller's to look at.
 *
 * A merged child is a cancelled stub pointing at the parcel that absorbed it.
 * Listing it alongside its parent shows one delivery as two — and on the
 * seller's side it came with its own "book courier" button, which is how a
 * combined parcel ends up with two labels and the platform pays for one of
 * them.
 */
export const withoutMergedChildren = <T extends DeliveryView>(orders: T[]): T[] =>
  orders.filter((o) => !o.mergedInto);

// ── The buyer's view of progress ──────────────────────────────────────
//
// A buyer does not need a waybill; they need to know where their card is.
// The order page used to show a "Waybill" card that said "the seller hasn't
// dispatched this yet" — a logistics artefact standing in for a status, and
// a slightly accusatory one.
//
// `ready` and `preparing` collapse into one step on purpose. Whether a label
// has been bought is a seller's concern; to a buyer both mean the same thing,
// which is that the parcel has not moved yet.

export interface TimelineStep {
  id: string;
  label: string;
  /** What it means, when this is the step they are on. */
  blurb: string;
}

export const BUYER_TIMELINE: TimelineStep[] = [
  { id: "placed", label: "Order placed", blurb: "Payment received." },
  {
    id: "arranging",
    label: "Arranging delivery",
    blurb: "The seller is packing it and booking a courier.",
  },
  { id: "collected", label: "Collected", blurb: "The courier has your parcel." },
  { id: "in_transit", label: "In transit", blurb: "On its way to you." },
  { id: "delivered", label: "Delivered", blurb: "Arrived." },
];

/**
 * How far along the timeline this order is: an index into BUYER_TIMELINE,
 * or -1 before payment when nothing has started.
 */
export const timelineIndex = (o: DeliveryView | null | undefined): number => {
  switch (deliveryStage(o)) {
    case "awaiting_payment":
      return -1;
    case "preparing":
    case "ready":
      return 1;
    case "collected":
      return 2;
    case "in_transit":
      return 3;
    case "delivered":
      return 4;
    // A cancelled order has no position on a timeline that only goes forward.
    case "cancelled":
      return -1;
    default:
      return 0;
  }
};

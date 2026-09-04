// Keep the buyer's order list honest about where their parcels are.
//
// The order LIST never asked the courier anything — only the detail page did.
// So a row sat at "Shipped" with a "Mark received" button until the buyer
// opened it, at which point it jumped straight to Delivered. The parcel had
// arrived days earlier; the list simply had not looked.
//
// Mirrors the seller's poll in useSellerOrders: same TTL, same burst cap, same
// module-level bookkeeping so navigating between pages doesn't re-poll the
// same consignments.

import type { CompiledOrder } from "~/composables/useCompiledOrders";

const TRACK_TTL_MS = 5 * 60 * 1000;
/** One page load never fires more than this many courier calls. */
const TRACK_BATCH = 8;

const lastTracked = new Map<string, number>();
let syncing = false;

export const useBuyerTracking = () => {
  const { buyerCompiledOrders } = useCompiledOrders();

  /** Worth asking about: it has a consignment and hasn't finished. */
  const trackable = (o: CompiledOrder) =>
    !!o.trackingNumber &&
    o.status !== "delivered" &&
    o.status !== "cancelled" &&
    // A merged child ships under its parent's consignment; asking about it
    // separately is a call about a parcel that does not exist.
    !o.mergedInto;

  const syncTracking = async () => {
    if (syncing) return;
    syncing = true;
    try {
      const { authedFetch } = useAuthedFetch();
      const now = Date.now();
      const due = buyerCompiledOrders.value
        .filter(trackable)
        .filter((o) => now - (lastTracked.get(o.id) ?? 0) > TRACK_TTL_MS)
        .slice(0, TRACK_BATCH);

      for (const o of due) {
        lastTracked.set(o.id, now);
        try {
          await authedFetch("/api/shipping/track", {
            method: "POST",
            body: { orderId: o.id },
          });
        } catch (e) {
          // A parcel the courier hasn't scanned yet is the normal case, and
          // one failure must not stop the rest of the batch.
          console.debug("[useBuyerTracking] tracking sync skipped", o.id, e);
        }
      }
    } finally {
      syncing = false;
    }
  };

  return { syncTracking };
};

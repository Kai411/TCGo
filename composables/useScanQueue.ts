import { ref } from "vue";
import type { CatalogMatch, CatalogPrice } from "./useCardCatalog";

// One scanned card waiting to be turned into a listing or auction. The
// queue is shared across the scanner modal and the create page so the
// user can scan-scan-scan and then fill in per-card details all at once.
//
// Identification runs in the background so the user can keep scanning
// while previous captures are still being processed. Each item carries a
// status:
//   - processing : Gemini lookup + TCGo DB query in flight
//   - ready      : single best match was selected (or non-EN auto-ready)
//   - needs-pick : multiple candidates from TCGo DB, user has to choose
//   - failed     : Gemini errored or TCGo DB returned nothing
export type ScanStatus = "processing" | "ready" | "needs-pick" | "failed";

export interface ScanQueueItem {
  id: string; // local UUID
  status: ScanStatus;

  // Always populated as soon as the photo is captured.
  scannedImageUrl: string;

  // What the AI read off the card (debug/UX info).
  detectedName?: string;
  detectedNumber?: string;
  // Detected card language ("EN", "JP", "KR", ...). Defaults to "EN".
  language?: string;
  // Visual metadata extracted from the card face — these flow into the
  // listing on publish so users don't have to re-enter them.
  rarity?: string;
  variant?: string;
  edition?: string;
  artist?: string;

  // Populated once status === "ready" (and on the picked candidate of
  // "needs-pick" after the user chooses).
  productId?: number;           // TCGPlayer ID — joins to Supabase cards_catalog
  cardName?: string;
  cardSet?: string;
  cardNumber?: string;
  imageUrl?: string;            // TCGo DB reference image (used as a thumb)
  // Current market price in MYR pulled from card_prices.
  tcgoPrice?: CatalogPrice | null;

  // Populated when status === "needs-pick" — the catalog candidates.
  matches?: CatalogMatch[];

  // Populated when status === "failed" — short reason for the user.
  error?: string;
}

// Module-level singleton — survives modal close/reopen and form
// navigation, but lives only in memory (cleared on page reload).
const queue = ref<ScanQueueItem[]>([]);

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useScanQueue = () => {
  const addProcessing = (scannedImageUrl: string) => {
    const id = randomId();
    queue.value.push({
      id,
      status: "processing",
      scannedImageUrl,
    });
    return id;
  };

  const updateItem = (id: string, patch: Partial<ScanQueueItem>) => {
    const idx = queue.value.findIndex((i) => i.id === id);
    if (idx === -1) return;
    queue.value[idx] = { ...queue.value[idx], ...patch };
  };

  // Snap the scan queue item to a chosen catalog match — used for both
  // single-match auto-pick and user-driven needs-pick resolution.
  const pickMatch = (id: string, match: CatalogMatch) => {
    updateItem(id, {
      status: "ready",
      productId: match.productId,
      cardName: match.name,
      cardSet: match.setName,
      cardNumber: match.number ?? undefined,
      rarity: match.rarity ?? queue.value.find((i) => i.id === id)?.rarity,
      imageUrl: match.imageUrl ?? undefined,
      tcgoPrice: match.price,
      matches: undefined,
    });
  };

  const remove = (id: string) => {
    queue.value = queue.value.filter((i) => i.id !== id);
  };

  const clear = () => {
    queue.value = [];
  };

  // True while any item is still being identified — useful for the create
  // page to disable Publish until everything has resolved.
  const processingCount = () =>
    queue.value.filter((i) => i.status === "processing").length;

  return {
    queue,
    addProcessing,
    updateItem,
    pickMatch,
    remove,
    clear,
    processingCount,
  };
};

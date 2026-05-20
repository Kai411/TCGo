import { ref } from "vue";
import type { TcgCard } from "./usePokemonTcg";

// One scanned card waiting to be turned into a listing or auction. The
// queue is shared across the scanner modal and the create page so the
// user can scan-scan-scan and then fill in per-card details all at once.
//
// Identification runs in the background so the user can keep scanning
// while previous captures are still being processed. Each item carries a
// status:
//   - processing : Gemini lookup + TCG API in flight
//   - ready      : single best match was selected automatically
//   - needs-pick : multiple matches, user has to choose on the create page
//   - failed     : Gemini errored or TCG API returned nothing
export type ScanStatus = "processing" | "ready" | "needs-pick" | "failed";

export interface ScanQueueItem {
  id: string; // local UUID
  status: ScanStatus;

  // Always populated as soon as the photo is captured.
  scannedImageUrl: string;

  // What the AI read off the card (debug/UX info).
  detectedName?: string;
  detectedNumber?: string;

  // Populated once status === "ready" (and on the picked candidate of
  // "needs-pick" after the user chooses).
  tcgApiId?: string;
  cardName?: string;
  cardSet?: string;
  cardNumber?: string;
  rarity?: string;
  imageUrl?: string;

  // Populated when status === "needs-pick" — the candidates to choose from.
  matches?: TcgCard[];

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

  const pickMatch = (id: string, match: TcgCard) => {
    // Format card number as "N/Total" when the set advertises a printed
    // total — that's the form people actually use to identify a card
    // ("020/189" / "187/167"). Falls back to just the number if the TCG
    // API doesn't have the total for that set.
    const printedTotal = match.set.printedTotal;
    const cardNumber = printedTotal
      ? `${match.number}/${printedTotal}`
      : match.number;

    updateItem(id, {
      status: "ready",
      tcgApiId: match.id,
      cardName: match.name,
      cardSet: match.set.name,
      cardNumber,
      rarity: match.rarity || "",
      imageUrl: match.images.large || match.images.small,
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

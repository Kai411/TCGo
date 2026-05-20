import { ref } from "vue";

// One scanned card waiting to be turned into a listing or auction. The
// queue is shared across the scanner modal and the create page so the
// user can scan-scan-scan and then fill in per-card details all at once.
export interface ScanQueueItem {
  id: string; // local UUID, not the TCG API id
  tcgApiId: string;
  cardName: string;
  cardSet: string;
  cardNumber: string;
  rarity: string;
  imageUrl: string; // official high-res image from TCG API
  scannedImageUrl: string; // user's own photo, uploaded to Cloudinary
}

// Module-level singleton — survives modal close/reopen and form
// navigation, but lives only in memory (cleared on page reload).
const queue = ref<ScanQueueItem[]>([]);

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useScanQueue = () => {
  const add = (item: Omit<ScanQueueItem, "id">) => {
    queue.value.push({ ...item, id: randomId() });
  };

  const remove = (id: string) => {
    queue.value = queue.value.filter((i) => i.id !== id);
  };

  const clear = () => {
    queue.value = [];
  };

  return { queue, add, remove, clear };
};

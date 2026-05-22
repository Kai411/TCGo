import { ref } from "vue";
import type { TcgCard } from "./usePokemonTcg";
import { extractMarketPrice, type MarketPrice } from "./useMarketPrice";

// Normalize the pokemontcg.io rarity values into our 7-bucket picker.
// API values are fine-grained ("Rare Holo VMAX", "Rare Ultra", "Rare
// Rainbow", "Amazing Rare", ...) — we collapse them into Common /
// Uncommon / Rare / Rare Holo / Ultra Rare / Secret Rare / Promo.
const normalizeApiRarity = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const r = raw.toLowerCase();
  if (r === "common") return "Common";
  if (r === "uncommon") return "Uncommon";
  if (r.includes("promo")) return "Promo";
  if (r.includes("rainbow") || r.includes("secret") || r.includes("shiny") || r.includes("hyper") || r.includes("gold"))
    return "Secret Rare";
  if (r.includes("ultra") || r.includes("vmax") || r.includes("vstar") || r.includes("ex") || r.includes("gx") || r.includes("amazing") || r.includes("radiant"))
    return "Ultra Rare";
  if (r.includes("holo")) return "Rare Holo";
  if (r.includes("rare")) return "Rare";
  return "";
};

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
  tcgApiId?: string;
  cardName?: string;
  cardSet?: string;
  cardNumber?: string;
  imageUrl?: string;
  // Market-price hint in MYR derived from the matched TCG API card. Null
  // when the API returned no pricing for this print.
  marketPrice?: MarketPrice | null;

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

    // TCG-API rarity is authoritative for English cards; fall back to
    // whatever Gemini guessed if the API has no value for this print.
    const current = queue.value.find((i) => i.id === id);
    const apiRarity = normalizeApiRarity(match.rarity);
    const rarity = apiRarity || current?.rarity || "";

    updateItem(id, {
      status: "ready",
      tcgApiId: match.id,
      cardName: match.name,
      cardSet: match.set.name,
      cardNumber,
      rarity,
      imageUrl: match.images.large || match.images.small,
      marketPrice: extractMarketPrice(match),
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

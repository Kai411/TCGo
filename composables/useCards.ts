import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { ref } from "vue";

export interface Card {
  id: string;
  cardName: string;
  cardSet: string;
  cardNumber: string;
  productType: string;
  condition: string;
  gradingProvider: string;
  grade: string;
  customGradingProvider: string;
  description: string;
  price: number;
  // Legacy per-listing shipping. Superseded by live courier quotes at
  // checkout; retained so existing listings keep the same document shape.
  shippingWM?: number;
  shippingEM?: number;
  imageUrl: string;
  imageUrls: string[];
  seller: string;
  sellerUid: string;
  createdAt: number;
  sold: boolean;
  interestedCount: number;
  favouriteCount: number;
  // 2-letter ISO of the card's printed language. Defaults to "EN" for
  // existing listings that pre-date this field.
  language?: string;
  // Trading-card game / franchise. Defaults to "Pokemon" for back-compat
  // with the original Pokemon-only catalog.
  tcgType?: string;
  // TCGPlayer ID — joins to Supabase cards_catalog. Populated by the
  // scanner when a TCGo DB match is picked; lets the detail page show
  // up-to-date market price without hitting an external API.
  productId?: number;
  // Back-link to the inventory item this listing was created from (bridge).
  inventoryId?: string;

  // ── Product metadata (auto-filled by scanner where possible) ─────────
  rarity?: string;
  variant?: string; // Normal / Holo / Reverse Holo / Full Art / ...
  edition?: string; // Unlimited / 1st Edition / Shadowless / Promo
  era?: string; // WOTC / EX / Modern / SwSh / SV / ...
  artist?: string; // illustrator credit from the card face

  // ── Authenticity / cert ──────────────────────────────────────────────
  certNumber?: string; // PSA/CGC cert # for graded slabs

  // ── Search / discovery ──────────────────────────────────────────────
  tags?: string[]; // seller-defined free-form tags
  defects?: string[]; // called-out flaws ("edge wear", "soft corners")

  // ── Commerce flags ──────────────────────────────────────────────────
  negotiable?: boolean;
  pickupAvailable?: boolean;
  quantity?: number; // default 1

  // ── Lifecycle (replaces the `sold` boolean over time) ───────────────
  status?:
    | "active"
    | "reserved"
    | "pending_payment"
    | "sold"
    | "cancelled"
    | "expired";

  // ── Engagement (computed, written by app) ───────────────────────────
  viewCount?: number;
}

// Module-level singleton. Previously each call opened a new Firestore
// listener — five pages called useCards(), so five identical subscriptions
// were active any time the user navigated through the app.
const cards = ref<Card[]>([]);
const loading = ref(true);
let initialized = false;
let unsubscribe: Unsubscribe | null = null;

const initialize = () => {
  if (initialized) return;
  initialized = true;
  const { firestore } = useFirebase();
  const cardsCollection = collection(firestore!, "cards");
  const q = query(cardsCollection, orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      cards.value = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Card, "id">),
        id: d.id,
      }));
      loading.value = false;
    },
    (error) => {
      console.error("[useCards] listener error:", error);
      loading.value = false;
    },
  );
};

export const useCards = () => {
  const { firestore } = useFirebase();
  initialize();

  const cardsCollection = collection(firestore!, "cards");

  const createCard = async (
    card: Omit<
      Card,
      "id" | "createdAt" | "sold" | "interestedCount" | "favouriteCount"
    >,
  ) => {
    const newCard = {
      ...card,
      // Firestore rejects undefined, and these are no longer collected.
      shippingWM: card.shippingWM ?? 0,
      shippingEM: card.shippingEM ?? 0,
      createdAt: Date.now(),
      sold: false,
      interestedCount: 0,
      favouriteCount: 0,
    };
    const docRef = await addDoc(cardsCollection, newCard);
    return docRef.id;
  };

  const markAsSold = async (cardId: string) => {
    const cardDoc = doc(firestore!, "cards", cardId);
    await updateDoc(cardDoc, { sold: true });
  };

  const markInterested = async (cardId: string) => {
    const cardDoc = doc(firestore!, "cards", cardId);
    await updateDoc(cardDoc, { interestedCount: increment(1) });
  };

  const deleteCard = async (cardId: string) => {
    const cardDoc = doc(firestore!, "cards", cardId);
    await deleteDoc(cardDoc);
  };

  // View counter. Counted once per browser session per listing so a buyer
  // refreshing the page (or bouncing between photos) doesn't inflate it.
  // Sellers opening their own listing are skipped by the caller.
  const recordView = async (cardId: string) => {
    if (!import.meta.client) return;
    const key = `tcgo:viewed:card:${cardId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode) — still count, just without dedupe.
    }
    const cardDoc = doc(firestore!, "cards", cardId);
    await updateDoc(cardDoc, { viewCount: increment(1) });
  };

  return {
    cards,
    loading,
    createCard,
    markAsSold,
    markInterested,
    recordView,
    deleteCard,
  };
};

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, onUnmounted } from "vue";

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
  shippingWM: number;
  shippingEM: number;
  imageUrl: string;
  imageUrls: string[];
  seller: string;
  sellerUid: string;
  createdAt: number;
  sold: boolean;
  interestedCount: number;
  favouriteCount: number;
}

export const useCards = () => {
  const { firestore } = useFirebase();
  const cards = ref<Card[]>([]);
  const loading = ref(true);

  const cardsCollection = collection(firestore!, "cards");
  const q = query(cardsCollection, orderBy("createdAt", "desc"));

  const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
    cards.value = snapshot.docs.map((doc) => ({
      ...(doc.data() as Omit<Card, "id">),
      id: doc.id,
    }));
    loading.value = false;
  });

  onUnmounted(() => {
    unsubscribe();
  });

  const createCard = async (
    card: Omit<Card, "id" | "createdAt" | "sold" | "interestedCount">,
  ) => {
    const newCard = {
      ...card,
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

  return { cards, loading, createCard, markAsSold, markInterested };
};

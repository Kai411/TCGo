import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, onUnmounted } from "vue";

export interface Favourite {
  id: string;
  userId: string;
  itemId: string;
  itemType: "card" | "auction";
  createdAt: number;
}

export const useFavourites = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const favourites = ref<Favourite[]>([]);
  let unsubscribe: Unsubscribe | null = null;

  // Listen to current user's favourites
  watch(
    user,
    (u) => {
      unsubscribe?.();
      if (u) {
        const q = query(
          collection(firestore!, "favourites"),
          where("userId", "==", u.uid),
        );
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            favourites.value = snapshot.docs.map((d) => ({
              ...(d.data() as Omit<Favourite, "id">),
              id: d.id,
            }));
          },
          (error) => {
            console.error("Favourites listener error:", error);
          },
        );
      } else {
        favourites.value = [];
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    unsubscribe?.();
  });

  const isFavourited = (itemId: string): boolean => {
    return favourites.value.some((f) => f.itemId === itemId);
  };

  const toggleFavourite = async (
    itemId: string,
    itemType: "card" | "auction",
  ) => {
    if (!user.value) return;

    const existing = favourites.value.find((f) => f.itemId === itemId);
    const itemCollection = itemType === "card" ? "cards" : "auctions";

    if (existing) {
      // Remove favourite and decrement counter
      await deleteDoc(doc(firestore!, "favourites", existing.id));
      try {
        await updateDoc(doc(firestore!, itemCollection, itemId), {
          favouriteCount: increment(-1),
        });
      } catch {}
    } else {
      // Add favourite and increment counter
      const favId = `${user.value.uid}_${itemId}`;
      await setDoc(doc(firestore!, "favourites", favId), {
        userId: user.value.uid,
        itemId,
        itemType,
        createdAt: Date.now(),
      });
      try {
        await updateDoc(doc(firestore!, itemCollection, itemId), {
          favouriteCount: increment(1),
        });
      } catch {}
    }
  };

  const getFavouriteCards = () => {
    return favourites.value.filter((f) => f.itemType === "card");
  };

  const getFavouriteAuctions = () => {
    return favourites.value.filter((f) => f.itemType === "auction");
  };

  return {
    favourites,
    isFavourited,
    toggleFavourite,
    getFavouriteCards,
    getFavouriteAuctions,
  };
};

// Fetch another user's favourites (for public profile)
export const useUserFavourites = (uid: string) => {
  const { firestore } = useFirebase();
  const userFavourites = ref<Favourite[]>([]);
  const loading = ref(true);

  const q = query(
    collection(firestore!, "favourites"),
    where("userId", "==", uid),
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      userFavourites.value = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Favourite, "id">),
        id: d.id,
      }));
      loading.value = false;
    },
    () => {
      loading.value = false;
    },
  );

  onUnmounted(() => {
    unsubscribe();
  });

  return { userFavourites, loading };
};

// User's personal card collection — a Firestore pivot keyed by
// (userUid, productId). The Supabase cards_catalog row + current
// market price is fetched separately via useCardCatalog; this composable
// only owns the "do I own this card?" side of the relationship.
//
// V1 schema: one doc per card in the collection. quantity / condition /
// notes are reserved for a follow-up — for now we just track presence.

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { computed, ref } from "vue";

export interface CollectionEntry {
  // Firestore doc ID — used to delete the entry without re-querying.
  id: string;
  userUid: string;
  productId: number;
  addedAt: number;
  // Reserved for follow-ups; not surfaced in the V1 UI.
  quantity?: number;
  condition?: string;
  notes?: string;
}

const entries = ref<CollectionEntry[]>([]);
const loading = ref(false);
let unsub: Unsubscribe | null = null;
let lastUid: string | null = null;

export const useUserCollection = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  // Subscribe to the current user's collection rows. Idempotent — if the
  // same user is already being listened to, this is a no-op. Swapping
  // users tears down the old listener cleanly.
  const listenMyCollection = () => {
    if (!user.value || !firestore) return;
    if (lastUid === user.value.uid && unsub) return;
    unsub?.();
    lastUid = user.value.uid;
    loading.value = true;
    const q = query(
      collection(firestore, "userCollection"),
      where("userUid", "==", user.value.uid),
    );
    unsub = onSnapshot(
      q,
      (snap) => {
        entries.value = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as CollectionEntry,
        );
        loading.value = false;
      },
      (err) => {
        console.error("[useUserCollection] listener error:", err);
        loading.value = false;
      },
    );
  };

  const stopListening = () => {
    unsub?.();
    unsub = null;
    lastUid = null;
    entries.value = [];
  };

  // Fast O(1) "is this in my collection?" lookup for the search UI's +/−
  // toggle. Rebuilds whenever entries change.
  const productIds = computed(() => new Set(entries.value.map((e) => e.productId)));

  const isInCollection = (productId: number) => productIds.value.has(productId);

  // Duplicate pivot docs can exist after fast or concurrent writes. They
  // still represent one collected product in counts and summary UI.
  const count = computed(() => productIds.value.size);

  const addToCollection = async (productId: number) => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    if (isInCollection(productId)) return; // No-op if already in.
    await addDoc(collection(firestore, "userCollection"), {
      userUid: user.value.uid,
      productId,
      addedAt: Date.now(),
    });
  };

  const removeFromCollection = async (productId: number) => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    // Query the source of truth even if the listener already has a match so
    // every duplicate pivot document is removed in the same operation.
    const q = query(
      collection(firestore, "userCollection"),
      where("userUid", "==", user.value.uid),
      where("productId", "==", productId),
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  };

  const toggleInCollection = async (productId: number) => {
    if (isInCollection(productId)) {
      await removeFromCollection(productId);
    } else {
      await addToCollection(productId);
    }
  };

  // One-time read of any user's collection (for showcasing on their profile).
  // Returns productIds newest-first. Requires the userCollection read rule to
  // allow reading other users' rows (collections are public showcases).
  const getCollectionProductIds = async (
    targetUid: string,
  ): Promise<number[]> => {
    if (!firestore || !targetUid) return [];
    const q = query(
      collection(firestore, "userCollection"),
      where("userUid", "==", targetUid),
    );
    const snap = await getDocs(q);
    const sorted = snap.docs
      .map((d) => d.data() as CollectionEntry)
      .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
    return [...new Set(sorted.map((entry) => entry.productId))];
  };

  return {
    entries,
    loading,
    productIds,
    count,
    listenMyCollection,
    stopListening,
    isInCollection,
    addToCollection,
    removeFromCollection,
    toggleInCollection,
    getCollectionProductIds,
  };
};

// User's personal card collection — a Firestore pivot keyed by
// (userUid, productId). The Supabase cards_catalog row + current
// market price is fetched separately via useCardCatalog; this composable
// only owns the "do I own this card?" side of the relationship.
//
// Schema: one doc per (user, product). `quantity` holds how many copies are
// owned, so a playset is one row with quantity 4 rather than four rows — the
// UI collapses on productId and duplicates would be indistinguishable from
// genuine extra copies.
//
// Legacy rows written before quantity existed have no field at all; every read
// treats a missing quantity as 1, and duplicate pivot docs (possible after
// concurrent writes) are summed rather than deduped, so nothing is lost.

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
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

  /** Copies owned per product, summed across any duplicate pivot docs. */
  const quantities = computed(() => {
    const map = new Map<number, number>();
    for (const e of entries.value) {
      // Rows predating the quantity field represent exactly one copy.
      const q = Math.max(1, Number(e.quantity ?? 1));
      map.set(e.productId, (map.get(e.productId) ?? 0) + q);
    }
    return map;
  });

  const quantityOf = (productId: number) => quantities.value.get(productId) ?? 0;

  // Distinct cards — what "12 cards" in the header means.
  const count = computed(() => productIds.value.size);
  /** Total copies including duplicates — a playset counts as 4. */
  const totalCopies = computed(() =>
    [...quantities.value.values()].reduce((t, q) => t + q, 0),
  );

  /** The row to mutate for a product; the oldest wins if duplicates exist. */
  const primaryEntry = (productId: number) =>
    entries.value
      .filter((e) => e.productId === productId)
      .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0))[0];

  const addToCollection = async (productId: number) => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    const existing = primaryEntry(productId);
    if (existing) {
      // Already owned — this is another copy, not a no-op.
      await updateDoc(
        doc(firestore, "userCollection", existing.id),
        { quantity: Math.max(1, Number(existing.quantity ?? 1)) + 1 },
      );
      return;
    }
    await addDoc(collection(firestore, "userCollection"), {
      userUid: user.value.uid,
      productId,
      quantity: 1,
      addedAt: Date.now(),
    });
  };

  /** Alias that says what it does at the call site. */
  const addCopy = addToCollection;

  /** Drop one copy; removes the row entirely at zero. */
  const removeCopy = async (productId: number) => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    const existing = primaryEntry(productId);
    if (!existing) return;
    const current = quantityOf(productId);
    if (current <= 1) {
      await removeFromCollection(productId);
      return;
    }
    // With duplicate docs the primary may hold fewer than the visible total;
    // decrementing below 1 would strand the remainder, so drop the whole row
    // and let the duplicates carry the rest.
    const primaryQty = Math.max(1, Number(existing.quantity ?? 1));
    if (primaryQty <= 1) {
      await deleteDoc(doc(firestore, "userCollection", existing.id));
      return;
    }
    await updateDoc(doc(firestore, "userCollection", existing.id), {
      quantity: primaryQty - 1,
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
    totalCopies,
    quantities,
    quantityOf,
    addCopy,
    removeCopy,
    listenMyCollection,
    stopListening,
    isInCollection,
    addToCollection,
    removeFromCollection,
    toggleInCollection,
    getCollectionProductIds,
  };
};

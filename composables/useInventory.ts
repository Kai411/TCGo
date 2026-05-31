// Seller inventory — the unified stock model that the POS + CSV import feed,
// and that listings/auctions will eventually be projected from.
//
// An inventory item is a card the seller owns and intends to sell, with a
// price / condition / quantity. Catalog data (name, set, image) is
// denormalized onto the item so the POS works fast and offline-resilient
// without a live catalog round-trip per scan.
//
// Status lifecycle (v1 tracks presence; POS/listing bridges come next):
//   in_stock → listed (online) / sold (POS or online)

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { computed, ref } from "vue";

export type InventoryStatus = "in_stock" | "listed" | "sold";
export type InventorySource = "manual" | "csv" | "scan";

export interface InventoryItem {
  id: string;
  userUid: string;
  // Catalog match — null when the row couldn't be reconciled (custom/JP/etc).
  productId: number | null;
  cardName: string;
  setName: string;
  number: string;
  rarity: string;
  condition: string;
  quantity: number;
  // Asking price in MYR (negotiable at the table — POS records soldPrice).
  listPrice: number;
  // Denormalized images. stockImageUrl from the catalog; photos[] are the
  // seller's real shots; primaryImage is what every surface renders.
  stockImageUrl: string;
  photos: string[];
  primaryImage: string;
  status: InventoryStatus;
  source: InventorySource;
  notes: string;
  // Set when sold via POS / online.
  soldPrice?: number;
  soldAt?: number;
  // Link to a marketplace listing once listed online (future bridge).
  listingId?: string;
  createdAt: number;
  updatedAt: number;
}

// Input shape for creating items (ids/timestamps filled in by the composable).
export interface InventoryItemInput {
  productId: number | null;
  cardName: string;
  setName?: string;
  number?: string;
  rarity?: string;
  condition?: string;
  quantity?: number;
  listPrice?: number;
  stockImageUrl?: string;
  photos?: string[];
  source?: InventorySource;
  notes?: string;
}

export interface ListOptions {
  sellerName: string;
  sellerUid: string;
  price: number;
  condition: string;
  shippingWM: number;
  shippingEM: number;
  description?: string;
  productType?: string;
}

const items = ref<InventoryItem[]>([]);
const loading = ref(false);
let unsub: Unsubscribe | null = null;
let lastUid: string | null = null;

const buildItem = (
  input: InventoryItemInput,
  userUid: string,
): Omit<InventoryItem, "id"> => {
  const stock = input.stockImageUrl || "";
  const photos = input.photos ?? [];
  const now = Date.now();
  return {
    userUid,
    productId: input.productId ?? null,
    cardName: input.cardName,
    setName: input.setName ?? "",
    number: input.number ?? "",
    rarity: input.rarity ?? "",
    condition: input.condition ?? "",
    quantity: input.quantity ?? 1,
    listPrice: input.listPrice ?? 0,
    stockImageUrl: stock,
    photos,
    primaryImage: photos[0] || stock,
    status: "in_stock",
    source: input.source ?? "manual",
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
};

export const useInventory = () => {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const listenMyInventory = () => {
    if (!user.value || !firestore) return;
    if (lastUid === user.value.uid && unsub) return;
    unsub?.();
    lastUid = user.value.uid;
    loading.value = true;
    const q = query(
      collection(firestore, "inventory"),
      where("userUid", "==", user.value.uid),
    );
    unsub = onSnapshot(
      q,
      (snap) => {
        items.value = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as InventoryItem)
          .sort((a, b) => b.createdAt - a.createdAt);
        loading.value = false;
      },
      (err) => {
        console.error("[useInventory] listener error:", err);
        loading.value = false;
      },
    );
  };

  const addItem = async (input: InventoryItemInput) => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    await addDoc(collection(firestore, "inventory"), buildItem(input, user.value.uid));
  };

  // Bulk insert (CSV import). Firestore batches cap at 500 writes; chunk to
  // be safe and report how many landed.
  const addMany = async (inputs: InventoryItemInput[]): Promise<number> => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    if (!inputs.length) return 0;
    const CHUNK = 400;
    let written = 0;
    for (let i = 0; i < inputs.length; i += CHUNK) {
      const batch = writeBatch(firestore);
      for (const input of inputs.slice(i, i + CHUNK)) {
        const ref = doc(collection(firestore, "inventory"));
        batch.set(ref, buildItem(input, user.value.uid));
      }
      await batch.commit();
      written += Math.min(CHUNK, inputs.length - i);
    }
    return written;
  };

  const updateItem = async (id: string, patch: Partial<InventoryItem>) => {
    if (!firestore) return;
    const next: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    // Keep primaryImage coherent if photos/stock change.
    if (patch.photos || patch.stockImageUrl !== undefined) {
      const current = items.value.find((i) => i.id === id);
      const photos = patch.photos ?? current?.photos ?? [];
      const stock = patch.stockImageUrl ?? current?.stockImageUrl ?? "";
      next.primaryImage = photos[0] || stock;
    }
    await updateDoc(doc(firestore, "inventory", id), next);
  };

  const removeItem = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, "inventory", id));
  };

  // ── Bridge: inventory ↔ marketplace listings ────────────────────────

  // List an inventory item on the marketplace: create a `cards` doc from the
  // item's denormalized data, then link both (item.status → listed,
  // item.listingId → card; card.inventoryId → item). Returns the new card id.
  const listItem = async (
    itemId: string,
    opts: ListOptions,
  ): Promise<string | null> => {
    if (!firestore) return null;
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return null;

    const cardRef = await addDoc(collection(firestore, "cards"), {
      cardName: item.cardName,
      cardSet: item.setName,
      cardNumber: item.number,
      productType: opts.productType || "Ungraded",
      condition: opts.condition || item.condition || "",
      gradingProvider: "",
      grade: "",
      customGradingProvider: "",
      description: opts.description || "",
      price: opts.price,
      shippingWM: opts.shippingWM,
      shippingEM: opts.shippingEM,
      imageUrl: item.primaryImage,
      imageUrls: item.primaryImage ? [item.primaryImage] : [],
      seller: opts.sellerName,
      sellerUid: opts.sellerUid,
      createdAt: Date.now(),
      sold: false,
      interestedCount: 0,
      favouriteCount: 0,
      language: "EN",
      tcgType: "Pokemon",
      rarity: item.rarity || "",
      variant: "",
      edition: "",
      artist: "",
      quantity: item.quantity || 1,
      status: "active",
      inventoryId: itemId,
      ...(item.productId ? { productId: item.productId } : {}),
    });

    await updateDoc(doc(firestore, "inventory", itemId), {
      status: "listed",
      listingId: cardRef.id,
      listPrice: opts.price,
      condition: opts.condition || item.condition || "",
      updatedAt: Date.now(),
    });
    return cardRef.id;
  };

  // Remove an item's marketplace listing — delete the card, return the item
  // to in_stock.
  const unlistItem = async (itemId: string) => {
    if (!firestore) return;
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;
    if (item.listingId) {
      try {
        await deleteDoc(doc(firestore, "cards", item.listingId));
      } catch {}
    }
    await updateDoc(doc(firestore, "inventory", itemId), {
      status: "in_stock",
      listingId: deleteField(),
      updatedAt: Date.now(),
    });
  };

  // Mark an item sold (POS or online). Syncs the linked listing if any.
  const markItemSold = async (itemId: string, soldPrice?: number) => {
    if (!firestore) return;
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;
    const now = Date.now();
    await updateDoc(doc(firestore, "inventory", itemId), {
      status: "sold",
      soldAt: now,
      ...(soldPrice != null ? { soldPrice } : {}),
      updatedAt: now,
    });
    if (item.listingId) {
      try {
        await updateDoc(doc(firestore, "cards", item.listingId), {
          sold: true,
          status: "sold",
        });
      } catch {}
    }
  };

  // Called from the listings side when a card is marked sold — find and sync
  // its linked inventory item (if any).
  const markSoldByListingId = async (cardId: string) => {
    if (!firestore) return;
    const q = query(
      collection(firestore, "inventory"),
      where("listingId", "==", cardId),
    );
    const snap = await getDocs(q);
    const now = Date.now();
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(d.ref, { status: "sold", soldAt: now, updatedAt: now }),
      ),
    );
  };

  // Reverse bridge: when a card is listed via the Sell form, create a linked
  // inventory item so the listing also shows up in inventory.
  const createListedFromCard = async (
    cardId: string,
    data: {
      productId?: number | null;
      cardName: string;
      setName?: string;
      number?: string;
      rarity?: string;
      condition?: string;
      price?: number;
      imageUrl?: string;
      quantity?: number;
    },
  ) => {
    if (!user.value || !firestore) return;
    const base = buildItem(
      {
        productId: data.productId ?? null,
        cardName: data.cardName,
        setName: data.setName,
        number: data.number,
        rarity: data.rarity,
        condition: data.condition,
        quantity: data.quantity,
        listPrice: data.price,
        stockImageUrl: data.imageUrl,
        source: "manual",
      },
      user.value.uid,
    );
    await addDoc(collection(firestore, "inventory"), {
      ...base,
      status: "listed",
      listingId: cardId,
    });
  };

  const count = computed(() => items.value.length);
  const totalUnits = computed(() =>
    items.value.reduce((s, i) => s + (i.quantity || 0), 0),
  );
  const totalValue = computed(() =>
    items.value.reduce((s, i) => s + i.listPrice * (i.quantity || 1), 0),
  );

  return {
    items,
    loading,
    count,
    totalUnits,
    totalValue,
    listenMyInventory,
    addItem,
    addMany,
    updateItem,
    removeItem,
    listItem,
    unlistItem,
    markItemSold,
    markSoldByListingId,
    createListedFromCard,
  };
};

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
  // How it was sold: "direct" = POS / manual mark-sold (counted in stats from
  // inventory); "online" = synced from a marketplace order (counted via the
  // order, so excluded from POS stats to avoid double-counting).
  saleChannel?: "direct" | "online";
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
  // Legacy per-listing shipping. Shipping is quoted live from the seller's
  // pickup address at checkout, so callers no longer supply these — kept
  // optional so older listings keep the same document shape.
  shippingWM?: number;
  shippingEM?: number;
  description?: string;
  productType?: string;
}

const items = ref<InventoryItem[]>([]);
const loading = ref(false);
let unsub: Unsubscribe | null = null;
let lastUid: string | null = null;

// Cross-page selection for label printing (set on the Items page, read on
// the Labels page). Empty = print everything.
const labelQueue = ref<string[]>([]);

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

  /** Returns the new item's id so callers can reference what they just added. */
  const addItem = async (input: InventoryItemInput): Promise<string> => {
    if (!user.value || !firestore) throw new Error("Not authenticated");
    const ref = await addDoc(
      collection(firestore, "inventory"),
      buildItem(input, user.value.uid),
    );
    return ref.id;
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

    // Mirror sellable fields onto the live marketplace listing so an edit in
    // inventory doesn't leave the shop showing a stale price/condition.
    const current = items.value.find((i) => i.id === id);
    if (current?.status === "listed" && current.listingId) {
      const mirror: Record<string, unknown> = {};
      if (patch.listPrice !== undefined) mirror.price = patch.listPrice;
      if (patch.condition !== undefined) mirror.condition = patch.condition;
      if (patch.quantity !== undefined) mirror.quantity = patch.quantity;
      if (patch.cardName !== undefined) mirror.cardName = patch.cardName;
      if (patch.setName !== undefined) mirror.cardSet = patch.setName;
      if (patch.number !== undefined) mirror.cardNumber = patch.number;
      if (patch.rarity !== undefined) mirror.rarity = patch.rarity;
      if (patch.notes !== undefined) mirror.description = patch.notes;
      if (next.primaryImage !== undefined) {
        mirror.imageUrl = next.primaryImage;
        mirror.imageUrls = next.primaryImage ? [next.primaryImage] : [];
      }
      if (Object.keys(mirror).length) {
        try {
          await updateDoc(doc(firestore, "cards", current.listingId), mirror);
        } catch (e) {
          console.warn("[useInventory] listing mirror failed:", e);
        }
      }
    }
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
      // Never write undefined — Firestore rejects it.
      shippingWM: opts.shippingWM ?? 0,
      shippingEM: opts.shippingEM ?? 0,
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
      saleChannel: "direct",
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
        updateDoc(d.ref, {
          status: "sold",
          soldAt: now,
          saleChannel: "online",
          updatedAt: now,
        }),
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

  // Backfill: every marketplace listing the seller owns should also appear in
  // inventory. Listings created before the bridge existed (or through any
  // path that skipped it) have no mirror, so create one per unlinked card.
  // Idempotent — only cards with no inventory item pointing at them are
  // written, and only once per uid per session.
  let syncedUid: string | null = null;
  const syncListingsToInventory = async (
    cards: Array<{
      id: string;
      sellerUid: string;
      cardName: string;
      cardSet?: string;
      cardNumber?: string;
      rarity?: string;
      condition?: string;
      price: number;
      imageUrl?: string;
      imageUrls?: string[];
      quantity?: number;
      productId?: number;
      inventoryId?: string;
      sold: boolean;
      createdAt: number;
    }>,
  ): Promise<number> => {
    if (!user.value || !firestore) return 0;
    if (syncedUid === user.value.uid) return 0;
    const uid = user.value.uid;
    const linked = new Set(
      items.value.map((i) => i.listingId).filter((id): id is string => !!id),
    );
    const known = new Set(items.value.map((i) => i.id));
    const missing = cards.filter(
      (c) =>
        c.sellerUid === uid &&
        !linked.has(c.id) &&
        !(c.inventoryId && known.has(c.inventoryId)),
    );
    syncedUid = uid;
    if (!missing.length) return 0;

    const batch = writeBatch(firestore);
    for (const c of missing) {
      const base = buildItem(
        {
          productId: c.productId ?? null,
          cardName: c.cardName,
          setName: c.cardSet,
          number: c.cardNumber,
          rarity: c.rarity,
          condition: c.condition,
          quantity: c.quantity,
          listPrice: c.price,
          stockImageUrl: c.imageUrls?.[0] || c.imageUrl,
          source: "manual",
        },
        uid,
      );
      batch.set(doc(collection(firestore, "inventory")), {
        ...base,
        // Keep the original listing date so the row sorts where the seller
        // expects it, not at the top as if it were added today.
        createdAt: c.createdAt || base.createdAt,
        status: c.sold ? "sold" : "listed",
        listingId: c.id,
        ...(c.sold ? { saleChannel: "online" } : {}),
      });
    }
    await batch.commit();
    return missing.length;
  };

  const count = computed(() => items.value.length);
  const totalUnits = computed(() =>
    items.value.reduce((s, i) => s + (i.quantity || 0), 0),
  );
  const totalValue = computed(() =>
    items.value.reduce((s, i) => s + i.listPrice * (i.quantity || 1), 0),
  );

  const setLabelQueue = (ids: string[]) => {
    labelQueue.value = ids;
  };

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
    syncListingsToInventory,
    labelQueue,
    setLabelQueue,
  };
};

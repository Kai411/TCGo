export interface CartItem {
  id: string;
  cardName: string;
  cardSet: string;
  condition: string;
  price: number;
  imageUrl: string;
  seller: string;
  sellerUid: string;
  shippingWM: number;
  shippingEM: number;
}

// Persisted to localStorage so a refresh, a WhatsApp detour or closing the
// tab doesn't silently empty the buyer's cart. A saved item can go stale
// (sold or reserved since); CartDrawer flags those, and checkout and the
// payment endpoint refuse them.
const STORAGE_KEY = "tcgo-cart";

const loadItems = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const items = ref<CartItem[]>(loadItems());

if (typeof window !== "undefined") {
  watch(
    items,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
      } catch {}
    },
    { deep: true },
  );
}

export const useCart = () => {
  const cartCount = computed(() => items.value.length);
  const cartTotal = computed(() =>
    items.value.reduce((sum, item) => sum + item.price, 0),
  );

  const addToCart = (item: CartItem) => {
    if (items.value.find((i) => i.id === item.id)) return;
    items.value.push(item);
  };

  const removeFromCart = (id: string) => {
    items.value = items.value.filter((i) => i.id !== id);
  };

  const clearCart = () => {
    items.value = [];
  };

  const isInCart = (id: string) => {
    return items.value.some((i) => i.id === id);
  };

  return {
    items,
    cartCount,
    cartTotal,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
  };
};

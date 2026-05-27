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

const items = ref<CartItem[]>([]);

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

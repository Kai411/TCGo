// What is being checked out, and where it came from.
//
// Two ways in, and they must not blur:
//   - From the cart: the buyer ticks items in the cart drawer and presses
//     Checkout. Those items stay in the cart until an order is placed, then
//     only they are removed.
//   - Buy Now on a listing: that one card goes straight to checkout WITHOUT
//     entering the cart. A buyer who taps Buy Now and backs out shouldn't find
//     the card sitting in their cart afterwards.
//
// Persisted to sessionStorage so refreshing the checkout page keeps a Buy Now
// item. Cart checkouts read live cart items, so a card removed from the cart
// drops out of checkout too.

import type { CartItem } from "~/composables/useCart";

export type CheckoutSource = "cart" | "buyNow";

interface CheckoutState {
  source: CheckoutSource;
  /** Cart item ids chosen for checkout (cart source). */
  ids: string[];
  /** The single listing being bought now (buyNow source). */
  buyNowItem: CartItem | null;
}

const STORAGE_KEY = "tcgo:checkout";
const state = ref<CheckoutState | null>(null);
let loaded = false;

const persist = () => {
  if (!import.meta.client) return;
  try {
    if (state.value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: checkout still works for this page view.
  }
};

const load = () => {
  if (loaded || !import.meta.client) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) state.value = JSON.parse(raw) as CheckoutState;
  } catch {
    state.value = null;
  }
};

export const useCheckout = () => {
  load();
  const { items: cartItems, removeFromCart } = useCart();

  /** Check out the given cart items (the drawer's selection). */
  const startFromCart = (ids: string[]) => {
    state.value = { source: "cart", ids: [...new Set(ids)], buyNowItem: null };
    persist();
  };

  /** Buy one listing now, without adding it to the cart. */
  const startBuyNow = (item: CartItem) => {
    state.value = { source: "buyNow", ids: [item.id], buyNowItem: item };
    persist();
  };

  // Opening /checkout directly (typed URL, bookmark, a link that skips the
  // drawer) has no saved selection. With items in the cart, that means "check
  // out my cart", the same as pressing Checkout on /cart.
  const source = computed<CheckoutSource | null>(() =>
    state.value?.source ?? (cartItems.value.length ? "cart" : null),
  );

  const checkoutItems = computed<CartItem[]>(() => {
    const s = state.value;
    if (!s) return cartItems.value;
    if (s.source === "buyNow") return s.buyNowItem ? [s.buyNowItem] : [];
    const wanted = new Set(s.ids);
    return cartItems.value.filter((i) => wanted.has(i.id));
  });

  const checkoutTotal = computed(() =>
    checkoutItems.value.reduce((sum, i) => sum + i.price, 0),
  );

  /** After orders are placed: clear only what was checked out. */
  const completeCheckout = () => {
    const s = state.value;
    const ids = s
      ? s.source === "cart" ? s.ids : []
      : checkoutItems.value.map((i) => i.id);
    for (const id of ids) removeFromCart(id);
    state.value = null;
    persist();
  };

  return {
    source,
    checkoutItems,
    checkoutTotal,
    startFromCart,
    startBuyNow,
    completeCheckout,
  };
};

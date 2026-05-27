<template>
  <div class="max-w-3xl mx-auto">
    <!-- Cancelled banner -->
    <div
      v-if="route.query.cancelled"
      class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-center gap-3 mb-6"
    >
      <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p class="text-sm text-amber-800 dark:text-amber-200">Checkout was cancelled. Your cart is unchanged.</p>
    </div>

    <h1 class="text-2xl font-bold mb-6">Shopping Cart</h1>

    <div v-if="items.length === 0" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Your cart is empty.</p>
      <NuxtLink to="/" class="text-pokemon-blue hover:underline mt-2 inline-block text-sm">
        Browse cards →
      </NuxtLink>
    </div>

    <template v-else>
      <div class="space-y-3 mb-6">
        <div
          v-for="item in items"
          :key="item.id"
          class="bg-white dark:bg-white/[0.04] rounded-xl p-4 border border-gray-200 dark:border-white/[0.08] flex gap-4 items-center"
        >
          <div class="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.cardName" class="w-full h-full object-cover"/>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">{{ item.cardName }}</p>
            <p class="text-xs text-gray-500 dark:text-zinc-400">{{ item.cardSet }} · {{ item.condition }}</p>
            <p class="text-xs text-gray-400 dark:text-zinc-500">Seller: {{ item.seller }}</p>
            <p class="text-xs text-gray-400 dark:text-zinc-500">
              Ship WM: RM {{ item.shippingWM?.toFixed(2) ?? '—' }} · EM: RM {{ item.shippingEM?.toFixed(2) ?? '—' }}
            </p>
          </div>
          <div class="text-right">
            <p class="font-bold text-pokemon-red">RM {{ item.price.toFixed(2) }}</p>
            <button @click="removeFromCart(item.id)" class="text-xs text-red-500 hover:text-red-700 mt-1">Remove</button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08]">
        <!-- Shipping region -->
        <div class="mb-4">
          <p class="text-sm font-medium text-gray-700 dark:text-zinc-200 mb-2">Shipping region</p>
          <div class="flex gap-2">
            <button
              @click="shippingRegion = 'WM'"
              :class="['flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors', shippingRegion === 'WM' ? 'bg-pokemon-red text-white border-pokemon-red' : 'border-gray-300 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:border-pokemon-red']"
            >
              West Malaysia
            </button>
            <button
              @click="shippingRegion = 'EM'"
              :class="['flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors', shippingRegion === 'EM' ? 'bg-pokemon-red text-white border-pokemon-red' : 'border-gray-300 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200 hover:border-pokemon-red']"
            >
              East Malaysia
            </button>
          </div>
        </div>

        <div class="space-y-1 mb-4 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-zinc-300">Items ({{ cartCount }})</span>
            <span class="tabular-nums">RM {{ cartTotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-zinc-300">Shipping</span>
            <span class="tabular-nums">RM {{ shippingTotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-white/[0.06]">
            <span>Total</span>
            <span class="text-pokemon-red">RM {{ grandTotal.toFixed(2) }}</span>
          </div>
        </div>

        <div v-if="!user" class="space-y-2">
          <p class="text-sm text-gray-500 dark:text-zinc-400 text-center mb-2">Sign in to checkout</p>
          <button @click="signInWithGoogle" class="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-gray-700 transition-colors">
            Sign in with Google
          </button>
        </div>

        <div v-else class="space-y-2">
          <button
            @click="handleCheckout"
            :disabled="checkoutLoading"
            class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="checkoutLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            {{ checkoutLoading ? 'Redirecting to payment...' : 'Pay securely with Stripe' }}
          </button>
          <p class="text-xs text-gray-400 dark:text-zinc-500 text-center">
            Funds held in escrow until you confirm delivery.
          </p>
        </div>
      </div>

      <button @click="clearCart" class="text-sm text-gray-400 dark:text-zinc-500 hover:text-red-500 mt-4 block mx-auto">
        Clear cart
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { items, cartCount, cartTotal, removeFromCart, clearCart } = useCart();
const { user, signInWithGoogle } = useAuth();
const { createPendingOrders, cancelPendingOrders } = useOrders();

const shippingRegion = ref<'WM' | 'EM'>('WM');
const checkoutLoading = ref(false);

const shippingTotal = computed(() =>
  items.value.reduce((sum, item) => {
    const cost = shippingRegion.value === 'WM' ? (item.shippingWM ?? 0) : (item.shippingEM ?? 0);
    return sum + cost;
  }, 0),
);

const grandTotal = computed(() => cartTotal.value + shippingTotal.value);

// Clean up any pending orders from a cancelled checkout on page load.
onMounted(async () => {
  if (route.query.cancelled && route.query.order_ids) {
    const ids = (route.query.order_ids as string).split(',').filter(Boolean);
    if (ids.length) await cancelPendingOrders(ids);
  }
});

const handleCheckout = async () => {
  if (!user.value) return;
  checkoutLoading.value = true;
  try {
    const pending = await createPendingOrders(
      items.value.map((item) => ({
        cardId: item.id,
        cardName: item.cardName,
        cardSet: item.cardSet,
        imageUrl: item.imageUrl,
        sellerUid: item.sellerUid,
        sellerName: item.seller,
        price: item.price,
        shipping: shippingRegion.value === 'WM' ? (item.shippingWM ?? 0) : (item.shippingEM ?? 0),
      })),
    );

    const res = await $fetch<{ url: string }>('/api/stripe/checkout', {
      method: 'POST',
      body: {
        type: 'payment',
        uid: user.value.uid,
        email: user.value.email,
        items: pending.map((o) => ({
          orderId: o.id,
          name: o.cardName,
          price: o.price,
          shipping: o.shipping,
          imageUrl: o.imageUrl,
        })),
      },
    });

    clearCart();
    if (res.url) window.location.href = res.url;
  } catch (e: any) {
    alert(e?.data?.message || 'Checkout failed. Please try again.');
  } finally {
    checkoutLoading.value = false;
  }
};
</script>

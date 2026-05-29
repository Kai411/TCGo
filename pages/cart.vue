<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-2 text-ink dark:text-white">Shopping Cart</h1>
    <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">
      Items from the same seller are combined into a single order with one shipping fee.
    </p>

    <div v-if="items.length === 0" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Your cart is empty.</p>
      <NuxtLink to="/" class="text-pokemon-blue hover:underline mt-2 inline-block text-sm">
        Browse cards →
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Shipping region picker (applies to all groups) -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 mb-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">
          Shipping region
        </p>
        <div class="flex gap-2">
          <button
            @click="shippingRegion = 'WM'"
            :class="[
              'flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors',
              shippingRegion === 'WM'
                ? 'bg-pokemon-red text-white border-pokemon-red'
                : 'border-gray-300 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200',
            ]"
          >
            West Malaysia
          </button>
          <button
            @click="shippingRegion = 'EM'"
            :class="[
              'flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors',
              shippingRegion === 'EM'
                ? 'bg-pokemon-red text-white border-pokemon-red'
                : 'border-gray-300 dark:border-white/[0.10] text-gray-700 dark:text-zinc-200',
            ]"
          >
            East Malaysia
          </button>
        </div>
      </div>

      <!-- Compiled-order previews (one per seller) -->
      <div class="space-y-4 mb-6">
        <div
          v-for="group in groupedBySeller"
          :key="group.sellerUid"
          class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Compiled order
              </p>
              <NuxtLink
                :to="`/profile/${group.sellerUid}`"
                class="font-semibold text-ink dark:text-white text-sm hover:underline"
              >
                {{ group.sellerName }}
              </NuxtLink>
            </div>
            <span class="text-xs text-gray-500 dark:text-zinc-400">
              {{ group.items.length }} {{ group.items.length === 1 ? "item" : "items" }}
            </span>
          </div>

          <div class="space-y-2">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex gap-3 items-center"
            >
              <div class="w-14 h-14 shrink-0 rounded-lg overflow-hidden">
                <CardImage :src="item.imageUrl" :alt="item.cardName" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate text-ink dark:text-white">{{ item.cardName }}</p>
                <p class="text-xs text-gray-500 dark:text-zinc-400 truncate">
                  {{ [item.cardSet, item.condition].filter(Boolean).join(" · ") }}
                </p>
              </div>
              <div class="text-right">
                <p class="font-semibold text-sm tabular-nums text-ink dark:text-white">
                  RM {{ item.price.toFixed(2) }}
                </p>
                <button
                  @click="removeFromCart(item.id)"
                  class="text-[11px] text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-100 dark:border-white/[0.06] mt-3 pt-3 space-y-1 text-xs">
            <div class="flex justify-between text-gray-600 dark:text-zinc-300">
              <span>Subtotal</span>
              <span class="tabular-nums">RM {{ group.subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-gray-600 dark:text-zinc-300">
              <span>Shipping ({{ shippingRegion }}, combined)</span>
              <span class="tabular-nums">RM {{ groupShipping(group).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between font-bold text-sm pt-1 border-t border-gray-100 dark:border-white/[0.06]">
              <span class="text-ink dark:text-white">Order total</span>
              <span class="text-pokemon-red tabular-nums">
                RM {{ (group.subtotal + groupShipping(group)).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Grand summary + checkout -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5">
        <div class="space-y-1 text-sm mb-4">
          <div class="flex justify-between text-gray-600 dark:text-zinc-300">
            <span>Items ({{ items.length }})</span>
            <span class="tabular-nums">RM {{ cartTotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-gray-600 dark:text-zinc-300">
            <span>Total shipping ({{ groupedBySeller.length }} {{ groupedBySeller.length === 1 ? "shipment" : "shipments" }})</span>
            <span class="tabular-nums">RM {{ totalShipping.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-100 dark:border-white/[0.06]">
            <span class="text-ink dark:text-white">Grand total</span>
            <span class="text-pokemon-red tabular-nums">RM {{ grandTotal.toFixed(2) }}</span>
          </div>
        </div>

        <div v-if="!user">
          <p class="text-sm text-gray-500 dark:text-zinc-400 text-center mb-2">Sign in to place orders</p>
          <button
            @click="signInWithGoogle"
            class="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-gray-700 transition-colors"
          >
            Sign in with Google
          </button>
        </div>

        <div v-else>
          <button
            @click="handlePlaceOrders"
            :disabled="placing"
            class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span v-if="placing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
            {{ placing
              ? "Creating orders..."
              : `Place ${groupedBySeller.length} ${groupedBySeller.length === 1 ? "order" : "orders"}` }}
          </button>
          <p class="text-xs text-gray-500 dark:text-zinc-400 text-center mt-2">
            You'll contact each seller via WhatsApp to arrange payment & shipping.
          </p>
        </div>
      </div>

      <button
        @click="clearCart"
        class="text-sm text-gray-400 dark:text-zinc-500 hover:text-red-500 mt-4 block mx-auto"
      >
        Clear cart
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CartItem } from "~/composables/useCart";

useHead({ title: "Cart | TCGo Marketplace" });

const router = useRouter();
const { items, cartTotal, removeFromCart, clearCart } = useCart();
const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { createCompiledOrders } = useCompiledOrders();

const shippingRegion = ref<"WM" | "EM">("WM");
const placing = ref(false);

interface SellerGroup {
  sellerUid: string;
  sellerName: string;
  items: CartItem[];
  subtotal: number;
  shippingWM: number;
  shippingEM: number;
}

const groupedBySeller = computed<SellerGroup[]>(() => {
  const map = new Map<string, SellerGroup>();
  for (const item of items.value) {
    if (!map.has(item.sellerUid)) {
      map.set(item.sellerUid, {
        sellerUid: item.sellerUid,
        sellerName: item.seller,
        items: [],
        subtotal: 0,
        shippingWM: 0,
        shippingEM: 0,
      });
    }
    const g = map.get(item.sellerUid)!;
    g.items.push(item);
    g.subtotal += item.price;
    g.shippingWM = Math.max(g.shippingWM, item.shippingWM ?? 0);
    g.shippingEM = Math.max(g.shippingEM, item.shippingEM ?? 0);
  }
  return [...map.values()];
});

const groupShipping = (g: SellerGroup) =>
  shippingRegion.value === "WM" ? g.shippingWM : g.shippingEM;

const totalShipping = computed(() =>
  groupedBySeller.value.reduce((sum, g) => sum + groupShipping(g), 0),
);

const grandTotal = computed(() => cartTotal.value + totalShipping.value);

const handlePlaceOrders = async () => {
  if (!user.value || !items.value.length) return;
  placing.value = true;
  try {
    const created = await createCompiledOrders(
      items.value.map((it) => ({
        cardId: it.id,
        cardName: it.cardName,
        cardSet: it.cardSet,
        condition: it.condition,
        imageUrl: it.imageUrl,
        price: it.price,
        shippingWM: it.shippingWM ?? 0,
        shippingEM: it.shippingEM ?? 0,
        sellerUid: it.sellerUid,
        sellerName: it.seller,
      })),
      shippingRegion.value,
      profile.value?.customName || profile.value?.displayName || user.value.displayName || "Buyer",
    );

    clearCart();

    // If only one order was created, jump straight to it. Otherwise send
    // the buyer to their activity Orders tab.
    if (created.length === 1) {
      router.push(`/orders/${created[0].id}?placed=1`);
    } else {
      router.push(`/activity?tab=orders&placed=${created.length}`);
    }
  } catch (e: any) {
    alert(e?.message || "Could not place orders. Please try again.");
  } finally {
    placing.value = false;
  }
};
</script>

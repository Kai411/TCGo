<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">Shopping Cart</h1>

    <div v-if="items.length === 0" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Your cart is empty.</p>
      <NuxtLink
        to="/"
        class="text-pokemon-blue hover:underline mt-2 inline-block text-sm"
      >
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
          <div
            class="w-16 h-16 flex-shrink-0 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden"
          >
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.cardName"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">{{ item.cardName }}</p>
            <p class="text-xs text-gray-500 dark:text-zinc-400">
              {{ item.cardSet }} · {{ item.condition }}
            </p>
            <p class="text-xs text-gray-400 dark:text-zinc-500">Seller: {{ item.seller }}</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-pokemon-red">
              RM {{ item.price.toFixed(2) }}
            </p>
            <button
              @click="removeFromCart(item.id)"
              class="text-xs text-red-500 hover:text-red-700 mt-1"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08]">
        <div class="flex justify-between items-center mb-4">
          <span class="text-gray-600 dark:text-zinc-300">Total ({{ cartCount }} items)</span>
          <span class="text-xl font-bold text-pokemon-red"
            >RM {{ cartTotal.toFixed(2) }}</span
          >
        </div>
        <button
          class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
        >
          Checkout
        </button>
        <p class="text-xs text-gray-400 dark:text-zinc-500 text-center mt-2">
          Checkout functionality coming soon
        </p>
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
const { items, cartCount, cartTotal, removeFromCart, clearCart } = useCart();
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Post-payment success banner -->
    <div
      v-if="route.query.success"
      class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 mb-6"
    >
      <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <div>
        <p class="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">Payment received!</p>
        <p class="text-xs text-emerald-700 dark:text-emerald-300">Your order is being processed. The seller will ship your card soon.</p>
      </div>
    </div>

    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 mb-4">Sign in to view your orders.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700">Sign in with Google</button>
    </div>

    <template v-else>
      <!-- Tab strip -->
      <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Orders</h1>
        <div class="inline-flex p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl">
          <button
            v-for="t in orderTabs"
            :key="t.id"
            @click="activeTab = t.id"
            class="px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors"
            :class="activeTab === t.id ? 'bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm' : 'text-gray-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white'"
          >
            {{ t.label }}
            <span v-if="t.count > 0" class="ml-1 text-xs opacity-70 tabular-nums">{{ t.count }}</span>
          </button>
        </div>
      </div>

      <div v-if="loadingBuyer || loadingSeller" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"/>
      </div>

      <template v-else>
        <!-- Purchases tab -->
        <div v-if="activeTab === 'purchases'" class="space-y-3">
          <p v-if="!buyerOrders.length" class="text-center text-gray-400 dark:text-zinc-500 py-12">No purchases yet.</p>
          <OrderCard
            v-for="order in buyerOrders"
            :key="order.id"
            :order="order"
            role="buyer"
            @mark-delivered="markDelivered(order.id)"
          />
        </div>

        <!-- Sales tab -->
        <div v-if="activeTab === 'sales'" class="space-y-3">
          <p v-if="!sellerOrders.length" class="text-center text-gray-400 dark:text-zinc-500 py-12">No sales via Stripe yet.</p>
          <OrderCard
            v-for="order in sellerOrders"
            :key="order.id"
            :order="order"
            role="seller"
            @add-tracking="(data) => addTracking(order.id, data.number, data.carrier)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Orders | TCGo Marketplace' });

const route = useRoute();
const { user, signInWithGoogle } = useAuth();
const {
  buyerOrders,
  sellerOrders,
  loadingBuyer,
  loadingSeller,
  listenBuyerOrders,
  listenSellerOrders,
  markDelivered,
  addTracking,
} = useOrders();

type OrderTabId = 'purchases' | 'sales';
const activeTab = ref<OrderTabId>('purchases');

const orderTabs = computed(() => [
  { id: 'purchases' as OrderTabId, label: 'Purchases', count: buyerOrders.value.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length },
  { id: 'sales' as OrderTabId, label: 'Sales', count: sellerOrders.value.filter(o => o.status === 'paid').length },
]);

onMounted(() => {
  if (user.value) {
    listenBuyerOrders();
    listenSellerOrders();
  }
});

watch(user, (u) => {
  if (u) {
    listenBuyerOrders();
    listenSellerOrders();
  }
});
</script>

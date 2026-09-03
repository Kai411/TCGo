<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-ink-muted dark:text-zinc-400 text-lg mb-4">
        Sign in to manage your inventory.
      </p>
      <button
        @click="goToLogin"
        class="bg-ink text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Sign in
      </button>
    </div>

    <template v-else>
      <div v-if="loadingSeller" class="flex justify-center py-16">
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
      </div>

      <!-- The dashboard is now purely an overview. Drilling into a number
           navigates to the dedicated Orders page rather than swapping this
           page into a second, hidden "list" mode. -->
      <SellerSalesDashboard
        v-else
        :orders="sellerCompiledOrders"
        :pos-sales="posSales"
        @select="goToOrders"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "seller" });
useHead({ title: "Seller Dashboard | TCGo" });

const router = useRouter();
const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { sellerCompiledOrders, loadingSeller, listenSellerCompiledOrders } =
  useCompiledOrders();
const { items: inventoryItems, listenMyInventory } = useInventory();
const { startAutoMerge } = useSellerOrders();

// Direct (POS / manual) sales — folded into the dashboard's sales stats.
const posSales = computed(() =>
  inventoryItems.value.filter(
    (i) => i.status === "sold" && i.saleChannel === "direct",
  ),
);

const goToOrders = (queue: string) =>
  router.push({ path: "/seller/orders", query: { q: queue } });

const { startIfNew: startTourIfNew } = useSellerTour();

const start = () => {
  listenSellerCompiledOrders();
  listenMyInventory();
  startAutoMerge();
};

// First-visit onboarding: wait until the dashboard has actually rendered so
// the tour has stat tiles to point at, then spotlight-walk the seller area.
watch(
  loadingSeller,
  (loading) => {
    if (!loading && user.value) nextTick(startTourIfNew);
  },
  { immediate: true },
);

onMounted(() => {
  if (user.value) start();
});
watch(user, (u) => {
  if (u) start();
});
</script>

<template>
  <!-- Calm UI page (tokens from the seller layout's `.mc` shell). -->
  <div class="sd-page">
    <div v-if="!user" class="mc-card sd-gate">
      <p class="mc-ink-3">Sign in to manage your inventory.</p>
      <button type="button" class="mc-btn sd-btn-primary" @click="goToLogin">Sign in</button>
    </div>

    <template v-else>
      <header class="mc-page-head">
        <div>
          <p class="mc-eyebrow">Seller</p>
          <h1 class="mc-h1 mt-1">Dashboard</h1>
        </div>
        <NuxtLink to="/seller/pos" class="mc-btn sd-btn-primary">Open POS</NuxtLink>
      </header>

      <div v-if="loadingSeller" class="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
        <div class="mc-skel h-[108px]" />
        <div class="mc-skel h-[260px]" />
      </div>

      <!-- The dashboard is now purely an overview. Drilling into a number
           navigates to the dedicated Orders page rather than swapping this
           page into a second, hidden "list" mode. -->
      <SellerSalesDashboard
        v-else
        :orders="sellerCompiledOrders"
        :pos-sales="posSales"
        @select="goToOrders"
      >
        <!-- What the shelf is worth today and what it has earned. After the
             work queue on purpose: the dashboard leads with what to do, then
             with the number worth opening the app for. -->
        <template #after-attention>
          <InventoryWorthCard :items="inventoryItems" />
        </template>
      </SellerSalesDashboard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "seller" });
useHead({ title: "Seller dashboard | TCGo" });

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

<style>
.sd-page {
  max-width: 1120px;
  margin: 0 auto;
  font-size: 14px;
  color: var(--ink);
}
@media (min-width: 721px) {
  .sd-page {
    padding: 4px 16px 0;
  }
}
.sd-gate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 16px;
}
/* Primary = ink fill, the one main action on the screen. */
.mc .sd-btn-primary {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--bg);
}
@media (hover: hover) and (pointer: fine) {
  .mc .sd-btn-primary.mc-btn:hover {
    background: color-mix(in oklch, var(--ink) 88%, var(--bg));
  }
}
</style>

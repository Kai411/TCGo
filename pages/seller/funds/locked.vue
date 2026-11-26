<template>
  <div class="sl-page sl-page--narrow">
    <SellerGate v-if="!user" message="Sign in to see your funds." />

    <template v-else>
      <SellerPageHead
        title="Locked funds"
        back="/seller/funds"
        back-label="Funds"
        :description="`Money from orders that haven't cleared the ${holdDays}-day hold yet. Open an order to see how its payout was worked out.`"
      />

      <section class="mc-card mc-card-pad">
        <p class="mc-label">Locked total</p>
        <p class="mc-hero-value mc-num mt-1">RM {{ fmt(lockedTotal) }}</p>
        <p class="mc-small mt-1.5">
          {{ locked.length }} order{{ locked.length === 1 ? "" : "s" }}
          <template v-if="nextUnlock"> · next unlocks {{ nextUnlock }}</template>
        </p>
      </section>

      <section class="mc-section">
        <div class="mc-card overflow-hidden">
          <p v-if="!locked.length" class="mc-empty">Nothing locked right now.</p>
          <div v-for="e in locked" v-else :key="e.order.id" class="fl-item">
            <button
              type="button"
              class="mc-row w-full text-left"
              :aria-expanded="open === e.order.id"
              @click="toggle(e.order.id)"
            >
              <span class="mc-dot" aria-hidden="true" />
              <div class="min-w-0">
                <p class="mc-row-title">
                  {{ e.order.buyerName }} ·
                  {{ e.order.items.length }} item{{ e.order.items.length === 1 ? "" : "s" }}
                </p>
                <p class="mc-meta">{{ lockReason(e) }}</p>
              </div>
              <span class="flex items-center gap-2">
                <span class="mc-num font-semibold">RM {{ fmt(e.amount) }}</span>
                <svg
                  class="w-4 h-4 mc-ink-3 fl-chev"
                  :class="{ 'is-open': open === e.order.id }"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                ><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            </button>
            <div v-if="open === e.order.id" class="px-4 pb-4 pt-1">
              <SettlementBreakdown :order="e.order" :hint="lockReason(e)" />
              <NuxtLink :to="`/orders/${e.order.id}`" class="mc-btn mc-btn-sm mt-3">Open order</NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatMoney } from "~/shared/format-money";
import type { FundEntry } from "~/composables/useSellerFunds";
import { PAYOUT_HOLD_DAYS } from "~/shared/payouts";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Locked funds | TCGo" });

const {user} = useAuth();
const { listenSellerCompiledOrders } = useCompiledOrders();
const { locked, lockedTotal } = useSellerFunds();

onMounted(() => {
  if (user.value) listenSellerCompiledOrders();
});
watch(user, (u) => {
  if (u) listenSellerCompiledOrders();
});

const holdDays = PAYOUT_HOLD_DAYS;
const fmt = (n: number) => formatMoney(n);
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

// One open at a time — these are read one order at a time, not compared.
const open = ref<string | null>(null);
const toggle = (id: string) => (open.value = open.value === id ? null : id);

const lockReason = (e: FundEntry): string => {
  if (e.order.status !== "delivered") return "Awaiting delivery";
  if (e.eligibleAt) return `Unlocks ${fmtDate(e.eligibleAt)}`;
  return "Held";
};

// The soonest date any of this money becomes withdrawable — the question a
// seller actually has when they open this page.
const nextUnlock = computed(() => {
  const dates = locked.value
    .map((e) => e.eligibleAt)
    .filter((t): t is number => typeof t === "number");
  if (!dates.length) return "";
  return fmtDate(Math.min(...dates));
});
</script>

<style>
.fl-item + .fl-item {
  border-top: 1px solid var(--line);
}
.fl-chev {
  transition: transform 160ms var(--ease-out);
}
.fl-chev.is-open {
  transform: rotate(180deg);
}
</style>

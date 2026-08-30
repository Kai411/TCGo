<template>
  <div class="max-w-2xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to see your funds.</p>
      <button @click="signInWithGoogle" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <NuxtLink
        to="/seller/funds"
        class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Funds
      </NuxtLink>

      <h1 class="text-2xl font-bold text-ink dark:text-white mt-3 mb-1">Locked funds</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-5">
        Money from orders that haven't cleared the {{ holdDays }}-day hold yet.
        Tap an order to see exactly how its payout was worked out.
      </p>

      <!-- Total -->
      <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 mb-5">
        <p class="text-xs font-semibold text-gray-500 dark:text-zinc-400">Locked total</p>
        <p class="text-3xl font-extrabold text-ink dark:text-white tabular-nums mt-1">
          RM {{ fmt(lockedTotal) }}
        </p>
        <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
          {{ locked.length }} order{{ locked.length === 1 ? "" : "s" }}
          <template v-if="nextUnlock"> · next unlocks {{ nextUnlock }}</template>
        </p>
      </div>

      <p v-if="!locked.length" class="text-sm text-gray-400 dark:text-zinc-500 py-10 text-center">
        Nothing locked right now.
      </p>

      <div v-else class="space-y-2">
        <div
          v-for="e in locked"
          :key="e.order.id"
          class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden"
        >
          <button
            type="button"
            @click="toggle(e.order.id)"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
            :aria-expanded="open === e.order.id"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink dark:text-white truncate">
                {{ e.order.buyerName }} ·
                {{ e.order.items.length }} item{{ e.order.items.length === 1 ? "" : "s" }}
              </p>
              <p class="text-[11px] text-gray-500 dark:text-zinc-400">{{ lockReason(e) }}</p>
            </div>
            <span class="shrink-0 text-sm font-bold text-ink dark:text-white tabular-nums">
              RM {{ fmt(e.amount) }}
            </span>
            <svg
              class="shrink-0 w-4 h-4 text-gray-400 transition-transform"
              :class="open === e.order.id ? 'rotate-180' : ''"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div
            v-if="open === e.order.id"
            class="px-4 pb-4 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]"
          >
            <SettlementBreakdown :order="e.order" :hint="lockReason(e)" />
            <NuxtLink
              :to="`/orders/${e.order.id}`"
              class="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-pokemon-red hover:underline"
            >
              Open order ↗
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { FundEntry } from "~/composables/useSellerFunds";
import { PAYOUT_HOLD_DAYS } from "~/shared/payouts";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Locked funds | TCGo" });

const { user, signInWithGoogle } = useAuth();
const { listenSellerCompiledOrders } = useCompiledOrders();
const { locked, lockedTotal } = useSellerFunds();

onMounted(() => {
  if (user.value) listenSellerCompiledOrders();
});
watch(user, (u) => {
  if (u) listenSellerCompiledOrders();
});

const holdDays = PAYOUT_HOLD_DAYS;
const fmt = (n: number) => n.toFixed(2);
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

<template>
  <!-- Nothing on the shelf, nothing to value. -->
  <section v-if="holdings.rows > 0" class="surface rounded-2xl p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="eyebrow">Stock value</p>
        <template v-if="holdings.pricedRows > 0">
          <p
            class="mt-2 text-3xl sm:text-4xl font-bold text-ink dark:text-white tabular-price leading-none tracking-tightest"
          >
            RM {{ formatMyr(holdings.marketValue) }}
          </p>
          <p
            v-if="changePct !== null"
            class="mt-2 text-xs font-semibold inline-flex items-center gap-1"
            :class="toneClass(changePct)"
          >
            <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                :d="changePct >= 0 ? 'M6 9.5V2.5M6 2.5L3 5.5M6 2.5l3 3' : 'M6 2.5v7M6 9.5l-3-3M6 9.5l3-3'"
                stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
              />
            </svg>
            {{ Math.abs(changePct) }}%
            <span class="font-normal text-ink-soft dark:text-zinc-500">vs 30 days ago</span>
          </p>
        </template>
        <template v-else>
          <p class="mt-2 text-3xl sm:text-4xl font-bold text-ink-soft dark:text-zinc-600 leading-none">—</p>
          <p class="mt-2 text-xs text-ink-soft dark:text-zinc-500">
            {{ loading ? "Looking up market prices…" : "No market prices yet for these cards." }}
          </p>
        </template>
        <p class="mt-1.5 text-xs text-ink-soft dark:text-zinc-500">
          {{ holdings.rows }} {{ holdings.rows === 1 ? "item" : "items" }}
          <template v-if="holdings.units !== holdings.rows"> · {{ holdings.units }} units</template>
          <template v-if="holdings.unpricedRows > 0">
            · {{ holdings.unpricedRows }} unpriced (RM {{ formatMyr(holdings.unpricedAskingValue) }} at asking)
          </template>
          <template v-if="trend.trackedCards && trend.trackedCards < holdings.pricedRows">
            · trend from {{ trend.trackedCards }} with price history
          </template>
        </p>
      </div>

      <!-- Supporting figures. Each says what it is measured over, because a
           margin that quietly skips half the shelf is worse than none. -->
      <dl class="flex flex-wrap gap-5 sm:gap-7">
        <div>
          <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Cost basis</dt>
          <dd class="mt-1 text-lg font-bold text-ink dark:text-white tabular-price">
            <template v-if="costedHeld > 0">RM {{ formatMyr(holdings.costBasis) }}</template>
            <template v-else>—</template>
            <span class="block text-[10px] font-normal text-ink-soft dark:text-zinc-500">
              {{ costedHeld }} of {{ holdings.rows }} with a cost
            </span>
          </dd>
        </div>
        <div>
          <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Unrealised</dt>
          <dd
            class="mt-1 text-lg font-bold tabular-price"
            :class="holdings.costedRows > 0 ? toneClass(holdings.unrealisedGain) : 'text-ink-soft dark:text-zinc-600'"
          >
            <template v-if="holdings.costedRows > 0">{{ signed(holdings.unrealisedGain) }}</template>
            <template v-else>—</template>
            <span class="block text-[10px] font-normal text-ink-soft dark:text-zinc-500">
              <template v-if="holdings.unrealisedPct !== null">{{ signedPct(holdings.unrealisedPct) }} on cost</template>
              <template v-else>market vs what you paid</template>
            </span>
          </dd>
        </div>
        <div>
          <dt class="text-[11px] text-ink-muted dark:text-zinc-400">Realised · 30 days</dt>
          <dd
            class="mt-1 text-lg font-bold tabular-price"
            :class="realised.last30.costedRows > 0 ? toneClass(realised.last30.profit) : 'text-ink-soft dark:text-zinc-600'"
          >
            <template v-if="realised.last30.costedRows > 0">{{ signed(realised.last30.profit) }}</template>
            <template v-else>—</template>
            <span class="block text-[10px] font-normal text-ink-soft dark:text-zinc-500">
              <template v-if="realised.allTime.costedRows > 0">
                {{ signed(realised.allTime.profit) }} all time · before fees
              </template>
              <template v-else>before fees</template>
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <div class="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.06]">
      <p class="text-sm font-semibold text-ink dark:text-white mb-3">Market value — last 30 days</p>
      <PriceTrendChart
        :trend="trend.trend"
        :loading="trendLoading"
        :height="120"
        :show-header="false"
        empty-text="Not enough price history for these cards yet."
      />
    </div>

    <!-- The card is only as good as the costs behind it, so it asks. -->
    <NuxtLink
      v-if="missingCost > 0"
      to="/seller/items?missing=cost"
      class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] px-3.5 py-2.5 text-xs hover:bg-amber-50 dark:hover:bg-amber-500/[0.1] transition-colors"
    >
      <span class="text-ink dark:text-zinc-100">
        <span class="font-semibold">
          {{ missingCost }} {{ missingCost === 1 ? "item has" : "items have" }} no cost price.
        </span>
        Add what you paid to see your real margin.
      </span>
      <span class="shrink-0 font-semibold text-amber-700 dark:text-amber-400">Add costs →</span>
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import type { InventoryItem } from "~/composables/useInventory";
import { useInventoryWorth } from "~/composables/useInventoryWorth";

const props = defineProps<{ items: InventoryItem[] }>();

const { holdings, realised, trend, missingCost, loading, trendLoading } =
  useInventoryWorth(toRef(props, "items"));

/** Held rows with a recorded cost, priced or not. */
const costedHeld = computed(() => holdings.value.rows - holdings.value.missingCostRows);

const changePct = computed(() => {
  const pct = trend.value.trend?.changePct;
  return pct == null || !Number.isFinite(pct) ? null : Math.round(pct * 10) / 10;
});

const toneClass = (n: number) =>
  n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) => `${n < 0 ? "−" : "+"}RM ${formatMyr(Math.abs(n))}`;
const signedPct = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n)}%`;
</script>

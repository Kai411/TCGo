<template>
  <!-- Nothing on the shelf, nothing to value. -->
  <section v-if="holdings.rows > 0" class="mc-card">
    <div class="mc-card-pad">
      <p class="mc-label">Stock value</p>
      <template v-if="holdings.pricedRows > 0">
        <p class="mc-hero-value mc-num mt-1">RM {{ formatMyr(holdings.marketValue) }}</p>
        <p v-if="changePct !== null" class="mc-small mt-1.5 flex items-center gap-2">
          <span class="mc-dot" :data-tone="changePct >= 0 ? 'good' : 'bad'" aria-hidden="true" />
          <span>
            <span class="mc-num font-semibold text-[var(--ink-2)]">
              {{ changePct >= 0 ? "Up" : "Down" }} {{ Math.abs(changePct) }}%
            </span>
            vs 30 days ago
          </span>
        </p>
      </template>
      <template v-else>
        <p class="mc-hero-value mc-ink-3 mt-1">—</p>
        <p class="mc-small mt-1.5">
          {{ loading ? "Looking up market prices…" : "No market prices yet for these cards." }}
        </p>
      </template>
      <p class="mc-small mt-1">
        <!-- Says what it counts: held stock only (sold rows are not on the
             shelf) at market price, not the asking prices the Items page
             totals. Without this the two pages read as disagreeing. -->
        {{ holdings.rows }} {{ holdings.rows === 1 ? "item" : "items" }} in stock
        <template v-if="holdings.units !== holdings.rows"> · {{ holdings.units }} units</template>
        <template v-if="holdings.pricedRows > 0"> · at market price</template>
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
    <div class="mc-divider mc-cells" data-cols="3">
      <AdminStat
        label="Cost basis"
        :value="costedHeld > 0 ? `RM ${formatMyr(holdings.costBasis)}` : '—'"
        :muted="costedHeld === 0"
        :hint="`${costedHeld} of ${holdings.rows} with a cost`"
      />
      <AdminStat
        label="Unrealised"
        :value="holdings.costedRows > 0 ? signed(holdings.unrealisedGain) : '—'"
        :muted="holdings.costedRows === 0"
        :tone="holdings.costedRows > 0 ? tone(holdings.unrealisedGain) : undefined"
        :hint="holdings.unrealisedPct !== null ? `${signedPct(holdings.unrealisedPct)} on cost` : 'market vs what you paid'"
      />
      <AdminStat
        label="Realised · 30 days"
        :value="realised.last30.costedRows > 0 ? signed(realised.last30.profit) : '—'"
        :muted="realised.last30.costedRows === 0"
        :tone="realised.last30.costedRows > 0 ? tone(realised.last30.profit) : undefined"
        :hint="realised.allTime.costedRows > 0
          ? `${signed(realised.allTime.profit)} all time · after TCGo fees`
          : 'after TCGo fees'"
      />
    </div>

    <div class="mc-divider mc-card-pad">
      <h3 class="mc-h3 mb-3">Market value, last 30 days</h3>
      <PriceTrendChart
        :trend="trend.trend"
        :loading="trendLoading"
        :height="120"
        :show-header="false"
        empty-text="Not enough price history for these cards yet."
      />

      <!-- The card is only as good as the costs behind it, so it asks. -->
      <NuxtLink
        v-if="missingCost > 0"
        to="/seller/items?missing=cost"
        class="mc-callout iw-callout mt-4"
      >
        <span class="min-w-0">
          <span class="font-semibold">
            {{ missingCostLabel }}
          </span>
          Add what you paid to see your real margin.
        </span>
        <span class="mc-btn mc-btn-sm shrink-0">Add costs</span>
      </NuxtLink>
    </div>
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

/**
 * The callout counts sold rows as well as held ones (realised profit needs
 * their cost too), while the Cost basis cell above counts held rows only. So
 * it says which is which: "30 items" beside "0 of 22 with a cost" otherwise
 * reads as two different shelves.
 */
const missingCostLabel = computed(() => {
  const held = holdings.value.missingCostRows;
  const sold = realised.value.allTime.missingCostRows;
  const verb = missingCost.value === 1 ? "has" : "have";
  if (held && sold) return `${held} in stock and ${sold} sold ${verb} no cost price.`;
  if (sold) return `${sold} sold ${sold === 1 ? "item" : "items"} ${verb} no cost price.`;
  return `${held} ${held === 1 ? "item" : "items"} in stock ${verb} no cost price.`;
});

const changePct = computed(() => {
  const pct = trend.value.trend?.changePct;
  return pct == null || !Number.isFinite(pct) ? null : Math.round(pct * 10) / 10;
});

const tone = (n: number): "good" | "bad" => (n >= 0 ? "good" : "bad");
const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) => `${n < 0 ? "−" : "+"}RM ${formatMyr(Math.abs(n))}`;
const signedPct = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n)}%`;
</script>

<style>
.mc-hero-value {
  font-size: 28px;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
@media (max-width: 480px) {
  .mc-hero-value {
    font-size: 24px;
  }
}
.iw-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>

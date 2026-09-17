// Market value, unrealised gain and realised profit of a seller's inventory —
// the numbers behind the stock value card on the seller home.
//
// The arithmetic lives in shared/portfolio.ts. This owns the two Supabase
// round-trips (current prices, 30-day basket history) and the rule for when
// to repeat them: only when the basket changes — which cards are held and how
// many — never when a cost or an asking price is typed into a row. Editing
// the items table must not fire a catalog query per keystroke.

import { computed, ref, watch, type Ref } from "vue";
import type { InventoryItem } from "./useInventory";
import type { CollectionPriceTrend } from "./useCardCatalog";
import {
  basketOf,
  realisedByPeriod,
  valueHoldings,
  type Holdings,
  type RealisedPeriods,
} from "~/shared/portfolio";

const NO_TREND: CollectionPriceTrend = {
  trend: null,
  trackedCards: 0,
  historyCards: 0,
  totalCards: 0,
};

export const useInventoryWorth = (items: Ref<InventoryItem[]>) => {
  const { getCardsByIds, getCollectionPriceTrend } = useCardCatalog();

  /** productId → current market price per unit, MYR. */
  const market = ref<Map<number, number>>(new Map());
  const trend = ref<CollectionPriceTrend>(NO_TREND);
  const loading = ref(false);
  const trendLoading = ref(false);

  const basket = computed(() => basketOf(items.value));

  // A later basket always wins: a slow response for an older basket is
  // dropped rather than overwriting the newer one.
  let seq = 0;
  watch(
    () => basket.value.key,
    async () => {
      const mine = ++seq;
      const { productIds, quantities } = basket.value;
      if (!productIds.length) {
        market.value = new Map();
        trend.value = NO_TREND;
        return;
      }
      loading.value = true;
      trendLoading.value = true;
      try {
        // getCardsByIds logs and returns [] on a failed chunk, so a lookup
        // problem shows up as "no market prices", never as RM 0.00.
        const cards = await getCardsByIds(productIds);
        if (mine !== seq) return;
        const next = new Map<number, number>();
        for (const c of cards) {
          if (c.price?.market && c.price.market > 0) next.set(c.productId, c.price.market);
        }
        market.value = next;
      } catch (e) {
        if (mine === seq) console.error("[useInventoryWorth] price lookup failed:", e);
      } finally {
        if (mine === seq) loading.value = false;
      }
      try {
        const t = await getCollectionPriceTrend(productIds, 30, quantities);
        if (mine === seq) trend.value = t;
      } catch (e) {
        if (mine === seq) console.error("[useInventoryWorth] trend failed:", e);
      } finally {
        if (mine === seq) trendLoading.value = false;
      }
    },
    { immediate: true },
  );

  const holdings = computed<Holdings>(() => valueHoldings(items.value, market.value));
  const realised = computed<RealisedPeriods>(() => realisedByPeriod(items.value));
  /** Rows, held or sold, whose cost was never recorded. */
  const missingCost = computed(
    () => holdings.value.missingCostRows + realised.value.allTime.missingCostRows,
  );

  return { basket, market, holdings, realised, trend, missingCost, loading, trendLoading };
};

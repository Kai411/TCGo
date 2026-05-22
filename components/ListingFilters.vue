<template>
  <div>
    <!-- Trigger row: Filters button + Sort dropdown + Active chips -->
    <div class="flex items-center gap-2 mb-3 sm:mb-4 overflow-x-auto -mx-4 px-4">
      <button
        @click="open = true"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-ink dark:text-white hover:bg-canvas-sunken dark:hover:bg-zinc-700 transition-colors"
      >
        <svg
          class="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        Filters
        <span
          v-if="filters.activeCount.value > 0"
          class="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold tabular-nums"
        >
          {{ filters.activeCount.value }}
        </span>
      </button>

      <div class="relative shrink-0" @click.stop>
        <button
          type="button"
          @click="sortOpen = !sortOpen"
          class="inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full text-sm font-semibold border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-ink dark:text-white"
        >
          {{ sortLabel }}
          <svg
            class="w-3 h-3 text-ink-muted dark:text-zinc-400"
            :class="sortOpen ? 'rotate-180' : ''"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <Transition
          enter-active-class="transition duration-150"
          enter-from-class="opacity-0 -translate-y-1"
          leave-active-class="transition duration-100"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="sortOpen"
            class="absolute right-0 mt-1 w-44 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden py-1 z-10"
          >
            <button
              v-for="opt in sortOptions"
              :key="opt.value"
              type="button"
              @click="filters.sort.value = opt.value; sortOpen = false"
              class="w-full text-left px-3 py-2 text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              :class="
                filters.sort.value === opt.value
                  ? 'text-pokemon-red'
                  : 'text-ink dark:text-white'
              "
            >
              {{ opt.label }}
            </button>
          </div>
        </Transition>
      </div>

      <!-- Active filter chips -->
      <template v-for="chip in chips" :key="chip.id">
        <button
          @click="chip.remove"
          class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-pokemon-red/10 text-pokemon-red"
        >
          {{ chip.label }}
          <svg
            class="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </template>

      <button
        v-if="filters.activeCount.value > 0"
        @click="filters.reset()"
        class="shrink-0 text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-pokemon-red"
      >
        Clear
      </button>
    </div>

    <!-- Sheet -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          class="fixed inset-0 z-50 bg-black/50"
          @click="open = false"
        />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-300 ease-premium"
        enter-from-class="translate-y-full sm:translate-y-0 sm:opacity-0"
        enter-to-class="translate-y-0 sm:opacity-100"
        leave-active-class="transition-transform duration-200 ease-premium"
        leave-from-class="translate-y-0 sm:opacity-100"
        leave-to-class="translate-y-full sm:translate-y-0 sm:opacity-0"
      >
        <div
          v-if="open"
          class="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4 pointer-events-none"
        >
          <div
            class="pointer-events-auto w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border-t sm:border border-gray-200 dark:border-zinc-700 shadow-2xl"
          >
            <div
              class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800"
            >
              <h3 class="text-base font-bold text-ink dark:text-white">
                Filters
              </h3>
              <button
                @click="open = false"
                class="text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white"
              >
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-5">
              <!-- Status (auction only) -->
              <section v-if="showAuctionSort">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Status</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="o in [{v:'live',l:'Live'},{v:'ended',l:'Ended'}]"
                    :key="o.v"
                    :active="filters.statuses.value.includes(o.v as any)"
                    @click="toggle(filters.statuses, o.v)"
                  >
                    {{ o.l }}
                  </ListingFilterPill>
                </div>
              </section>
              <!-- Time left (auction only) -->
              <section v-if="showAuctionSort">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Time left</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="o in [{v:'ending-soon',l:'< 1 hour'},{v:'today',l:'Today'},{v:'longer',l:'Later'}]"
                    :key="o.v"
                    :active="filters.timeBuckets.value.includes(o.v as any)"
                    @click="toggle(filters.timeBuckets, o.v)"
                  >
                    {{ o.l }}
                  </ListingFilterPill>
                </div>
              </section>
              <!-- Price range -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Price (RM)</p>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    inputmode="decimal"
                    placeholder="Min"
                    :value="filters.priceMin.value ?? ''"
                    @input="onPriceInput($event, 'min')"
                    class="no-spin flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-ink dark:text-white"
                  />
                  <span class="text-ink-muted dark:text-zinc-500">—</span>
                  <input
                    type="number"
                    inputmode="decimal"
                    placeholder="Max"
                    :value="filters.priceMax.value ?? ''"
                    @input="onPriceInput($event, 'max')"
                    class="no-spin flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-ink dark:text-white"
                  />
                </div>
              </section>
              <!-- Set name -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Set</p>
                <input
                  type="text"
                  v-model="filters.setQuery.value"
                  placeholder="Search set name…"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-ink dark:text-white"
                />
              </section>
              <!-- Product type -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Product</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="t in PRODUCT_TYPES"
                    :key="t"
                    :active="filters.productTypes.value.includes(t as any)"
                    @click="toggle(filters.productTypes, t)"
                  >
                    {{ t }}
                  </ListingFilterPill>
                </div>
              </section>
              <!-- Condition -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Condition</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="c in UNGRADED_CONDITIONS"
                    :key="c"
                    :active="filters.conditions.value.includes(c)"
                    @click="toggle(filters.conditions, c)"
                  >
                    {{ shortCondition(c) }}
                  </ListingFilterPill>
                </div>
              </section>
              <!-- Rarity -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Rarity</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="r in RARITIES"
                    :key="r"
                    :active="filters.rarities.value.includes(r)"
                    @click="toggle(filters.rarities, r)"
                  >
                    {{ r }}
                  </ListingFilterPill>
                </div>
              </section>
              <!-- Variant -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Variant</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="v in VARIANTS"
                    :key="v"
                    :active="filters.variants.value.includes(v)"
                    @click="toggle(filters.variants, v)"
                  >
                    {{ v }}
                  </ListingFilterPill>
                </div>
              </section>
              <!-- Language -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Language</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill
                    v-for="l in CARD_LANGUAGES"
                    :key="l.code"
                    :active="filters.languages.value.includes(l.code)"
                    @click="toggle(filters.languages, l.code)"
                  >
                    {{ l.code }}
                  </ListingFilterPill>
                </div>
              </section>
            </div>
            <div
              class="flex items-center justify-between gap-3 p-4 border-t border-gray-100 dark:border-zinc-800"
            >
              <button
                @click="filters.reset()"
                class="text-sm font-semibold text-ink-muted dark:text-zinc-400"
              >
                Reset
              </button>
              <button
                @click="open = false"
                class="px-5 py-2 rounded-full bg-pokemon-red text-white text-sm font-bold"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  PRODUCT_TYPES,
  UNGRADED_CONDITIONS,
  RARITIES,
  VARIANTS,
  CARD_LANGUAGES,
} from "~/composables/useCardConstants";
import type { ListingFilters } from "~/composables/useListingFilters";

const props = defineProps<{
  filters: ListingFilters;
  showAuctionSort?: boolean;
}>();

const open = ref(false);
const sortOpen = ref(false);

const sortOptions = computed(() => {
  const base = [
    { value: "newest" as const, label: "Newest" },
    { value: "price-asc" as const, label: "Price: low to high" },
    { value: "price-desc" as const, label: "Price: high to low" },
  ];
  if (props.showAuctionSort) {
    base.push(
      { value: "ending-soon" as const, label: "Ending soon" },
      { value: "most-bids" as const, label: "Most bids" },
    );
  }
  return base;
});

const sortLabel = computed(
  () =>
    sortOptions.value.find((o) => o.value === props.filters.sort.value)
      ?.label ?? "Sort",
);

const closeSortOnDocClick = () => (sortOpen.value = false);
onMounted(() => document.addEventListener("click", closeSortOnDocClick));
onBeforeUnmount(() =>
  document.removeEventListener("click", closeSortOnDocClick),
);

const toggle = <T,>(arr: { value: T[] }, v: T) => {
  const i = arr.value.indexOf(v);
  if (i >= 0) arr.value.splice(i, 1);
  else arr.value.push(v);
};

const onPriceInput = (e: Event, which: "min" | "max") => {
  const raw = (e.target as HTMLInputElement).value;
  const n = raw === "" ? null : Number(raw);
  if (which === "min") props.filters.priceMin.value = Number.isFinite(n) ? n : null;
  else props.filters.priceMax.value = Number.isFinite(n) ? n : null;
};

const shortCondition = (c: string) => {
  const m = c.match(/\(([^)]+)\)/);
  return m ? m[1] : c;
};

// Close the sort dropdown when the sheet opens (avoid floating menu over
// modal backdrop) and when the user picks a filter.
watch(open, (v) => {
  if (v) sortOpen.value = false;
});

// Build the inline chip list from active filters so users can remove
// individual selections without re-opening the sheet.
const chips = computed(() => {
  const { filters } = props;
  const out: { id: string; label: string; remove: () => void }[] = [];
  const push = (
    id: string,
    label: string,
    arr: { value: any[] },
    v: any,
  ) => out.push({
    id,
    label,
    remove: () => {
      const i = arr.value.indexOf(v);
      if (i >= 0) arr.value.splice(i, 1);
    },
  });
  filters.statuses.value.forEach((v) =>
    push(`s-${v}`, v === "live" ? "Live" : "Ended", filters.statuses, v),
  );
  filters.timeBuckets.value.forEach((v) =>
    push(
      `t-${v}`,
      v === "ending-soon" ? "< 1h" : v === "today" ? "Today" : "Later",
      filters.timeBuckets,
      v,
    ),
  );
  filters.productTypes.value.forEach((v) =>
    push(`p-${v}`, v, filters.productTypes, v),
  );
  filters.conditions.value.forEach((v) =>
    push(`c-${v}`, shortCondition(v), filters.conditions, v),
  );
  filters.rarities.value.forEach((v) => push(`r-${v}`, v, filters.rarities, v));
  filters.variants.value.forEach((v) => push(`v-${v}`, v, filters.variants, v));
  filters.languages.value.forEach((v) =>
    push(`l-${v}`, v, filters.languages, v),
  );
  if (filters.setQuery.value.trim()) {
    out.push({
      id: "set",
      label: `Set: ${filters.setQuery.value.trim()}`,
      remove: () => (filters.setQuery.value = ""),
    });
  }
  if (filters.priceMin.value != null || filters.priceMax.value != null) {
    const lo = filters.priceMin.value ?? 0;
    const hi = filters.priceMax.value;
    out.push({
      id: "price",
      label: hi != null ? `RM ${lo}–${hi}` : `RM ${lo}+`,
      remove: () => {
        filters.priceMin.value = null;
        filters.priceMax.value = null;
      },
    });
  }
  return out;
});
</script>

<style scoped>
/* Hide the up/down spinners on number inputs — the placeholder "Min/Max"
   already conveys intent and the spinner makes the field look cluttered. */
.no-spin::-webkit-outer-spin-button,
.no-spin::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spin {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>

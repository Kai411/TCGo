<template>
  <!-- ── SIDEBAR MODE (desktop inline panel) ─────────────────────────── -->
  <template v-if="sidebar">
    <div>
      <div class="flex items-center justify-between pb-3">
        <p class="text-sm font-bold text-ink dark:text-white">Filters</p>
        <button
          v-if="filters.activeCount.value > 0"
          @click="filters.reset()"
          class="text-[11px] font-semibold text-ink-muted dark:text-zinc-400 hover:text-pokemon-red transition-colors"
        >
          Clear all
        </button>
      </div>

      <!-- Sort is always visible: it is the one control people reach for every
           visit, and it is a single short list. -->
      <section class="py-3 border-t border-black/[0.06] dark:border-white/[0.08]">
        <p class="sb-label">Sort</p>
        <div class="flex flex-col gap-0.5 mt-2">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            type="button"
            @click="filters.sort.value = opt.value"
            class="text-left text-[13px] px-2.5 py-1.5 rounded-lg font-medium transition-colors"
            :class="
              filters.sort.value === opt.value
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            "
          >
            {{ opt.label }}
          </button>
        </div>
      </section>

      <!-- Game — moved in from the pills above the grid. Always open, like
           Sort: it is a single short choice. -->
      <section
        v-if="tcgCounts && tcgCounts.length > 1"
        class="py-3 border-t border-black/[0.06] dark:border-white/[0.08]"
      >
        <p class="sb-label">Game</p>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <ListingFilterPill
            v-for="{ type, count } in tcgCounts"
            :key="type"
            size="sm"
            :active="filters.tcg.value === type"
            @click="filters.tcg.value = type"
          >{{ type }} <span class="ml-0.5 opacity-60 tabular-nums">{{ count }}</span></ListingFilterPill>
        </div>
      </section>

      <!-- Everything else collapses. Showing six expanded groups at once made
           the rail a wall of chips; a collapsed group still advertises its
           active count so nothing hides silently. -->
      <FilterGroup
        v-for="g in groups"
        :key="g.id"
        :label="g.label"
        :count="g.count"
        :open="isOpen(g.id)"
        @toggle="toggleSection(g.id)"
      >
        <!-- Status (auction only) -->
        <div v-if="g.id === 'status'" class="flex flex-wrap gap-1.5">
          <ListingFilterPill
            v-for="o in STATUS_OPTS"
            :key="o.v"
            size="sm"
            :active="filters.statuses.value.includes(o.v as any)"
            @click="toggle(filters.statuses, o.v)"
          >{{ o.l }}</ListingFilterPill>
        </div>

        <!-- Time left (auction only) -->
        <div v-else-if="g.id === 'time'" class="flex flex-wrap gap-1.5">
          <ListingFilterPill
            v-for="o in TIME_OPTS"
            :key="o.v"
            size="sm"
            :active="filters.timeBuckets.value.includes(o.v as any)"
            @click="toggle(filters.timeBuckets, o.v)"
          >{{ o.l }}</ListingFilterPill>
        </div>

        <!-- Price range -->
        <div v-else-if="g.id === 'price'" class="flex items-center gap-2">
          <input
            type="number" inputmode="decimal" placeholder="Min"
            :value="filters.priceMin.value ?? ''"
            @input="onPriceInput($event, 'min')"
            class="no-spin flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] text-ink dark:text-white"
          />
          <span class="text-xs text-ink-soft dark:text-zinc-500">—</span>
          <input
            type="number" inputmode="decimal" placeholder="Max"
            :value="filters.priceMax.value ?? ''"
            @input="onPriceInput($event, 'max')"
            class="no-spin flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] text-ink dark:text-white"
          />
        </div>

        <!-- Set name -->
        <input
          v-else-if="g.id === 'set'"
          type="text" v-model="filters.setQuery.value" placeholder="Search set…"
          class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] text-ink dark:text-white"
        />

        <!-- Product type -->
        <div v-else-if="g.id === 'product'" class="flex flex-wrap gap-1.5">
          <ListingFilterPill
            v-for="t in PRODUCT_TYPES" :key="t" size="sm"
            :active="filters.productTypes.value.includes(t as any)"
            @click="toggle(filters.productTypes, t)"
          >{{ t }}</ListingFilterPill>
        </div>

        <!-- Condition -->
        <div v-else-if="g.id === 'condition'" class="flex flex-wrap gap-1.5">
          <ListingFilterPill
            v-for="c in UNGRADED_CONDITIONS" :key="c" size="sm"
            :active="filters.conditions.value.includes(c)"
            @click="toggle(filters.conditions, c)"
          >{{ shortCondition(c) }}</ListingFilterPill>
        </div>

        <!-- Language -->
        <div v-else-if="g.id === 'language'" class="flex flex-wrap gap-1.5">
          <ListingFilterPill
            v-for="l in CARD_LANGUAGES" :key="l.code" size="sm"
            :active="filters.languages.value.includes(l.code)"
            @click="toggle(filters.languages, l.code)"
          >{{ l.code }}</ListingFilterPill>
        </div>
      </FilterGroup>
    </div>
  </template>

  <!-- ── POPUP MODE (mobile only) ───────────────────────────────────── -->
  <template v-else>
    <div>
      <!-- Trigger row: Filters and Sort are separate because they answer
           different questions. Sort names its current order so the row says
           how the grid is arranged without opening anything; the count on the
           right anchors the row and updates as filters change. Both buttons
           stay 34px tall (kai's size) with the hit area grown to 44px. -->
      <div class="flex items-center gap-2 mb-2">
        <button
          type="button"
          @click="open = true"
          class="trigger"
          :class="filters.activeCount.value > 0 ? triggerOn : triggerOff"
          :aria-label="filters.activeCount.value > 0 ? `Filters, ${filters.activeCount.value} on` : 'Filters'"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filters
          <span
            v-if="filters.activeCount.value > 0"
            class="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold tabular-nums"
            aria-hidden="true"
          >
            {{ filters.activeCount.value }}
          </span>
        </button>

        <button
          type="button"
          @click="sortOpen = true"
          class="trigger"
          :class="triggerOff"
          :aria-label="`Sort: ${currentSort.label}`"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M7 4v16M3 16l4 4 4-4" />
            <path d="M17 20V4M13 8l4-4 4 4" />
          </svg>
          {{ currentSort.short }}
          <svg class="w-2.5 h-2.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <p
          v-if="resultCount != null"
          class="ml-auto shrink-0 text-xs text-ink-muted dark:text-zinc-400 tabular-nums"
          aria-live="polite"
        >
          {{ resultCount.toLocaleString("en-MY") }} {{ resultCount === 1 ? noun : `${noun}s` }}
        </p>
      </div>

      <!-- Active filter chips, each removable, with Clear all at the end -->
      <div
        v-if="chips.length > 0"
        class="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1"
      >
        <button
          v-for="chip in chips"
          :key="chip.id"
          type="button"
          @click="chip.remove"
          class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-pokemon-red/10 text-pokemon-red"
          :aria-label="`Remove ${chip.label}`"
        >
          {{ chip.label }}
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          @click="filters.reset()"
          class="shrink-0 px-2 py-1 text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-pokemon-red"
        >
          Clear all
        </button>
      </div>

      <!-- Sort sheet: one tap picks and closes -->
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="sortOpen" class="fixed inset-0 z-50 bg-black/50" @click="sortOpen = false" />
        </Transition>
        <Transition enter-active-class="transition-transform duration-300 ease-premium" enter-from-class="translate-y-full" enter-to-class="translate-y-0" leave-active-class="transition-transform duration-200 ease-premium" leave-from-class="translate-y-0" leave-to-class="translate-y-full">
          <div
            v-if="sortOpen"
            class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 shadow-2xl pb-[env(safe-area-inset-bottom)]"
            role="dialog"
            aria-modal="true"
            aria-label="Sort by"
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
              <h3 class="text-base font-bold text-ink dark:text-white">Sort by</h3>
              <button type="button" @click="sortOpen = false" class="-m-1 p-2 text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white" aria-label="Close">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <ul class="py-1">
              <li v-for="opt in sortOptions" :key="opt.value">
                <button
                  type="button"
                  @click="pickSort(opt.value)"
                  class="w-full flex items-center justify-between gap-3 px-4 min-h-[48px] text-left text-[15px] transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                  :class="filters.sort.value === opt.value ? 'font-semibold text-ink dark:text-white' : 'text-ink-muted dark:text-zinc-300'"
                  :aria-pressed="filters.sort.value === opt.value"
                >
                  {{ opt.label }}
                  <svg v-if="filters.sort.value === opt.value" class="w-4 h-4 text-pokemon-red shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </li>
            </ul>
          </div>
        </Transition>
      </Teleport>
      <!-- Filters sheet -->
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="open" class="fixed inset-0 z-50 bg-black/50" @click="open = false" />
        </Transition>
        <Transition enter-active-class="transition-transform duration-300 ease-premium" enter-from-class="translate-y-full" enter-to-class="translate-y-0" leave-active-class="transition-transform duration-200 ease-premium" leave-from-class="translate-y-0" leave-to-class="translate-y-full">
          <div v-if="open" class="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[90vh] rounded-t-2xl bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
              <h3 class="text-base font-bold text-ink dark:text-white">Filters</h3>
              <button type="button" @click="open = false" class="-m-1 p-2 text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white" aria-label="Close">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <!-- Scrollable content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-5">
              <!-- Game -->
              <section v-if="tcgCounts && tcgCounts.length > 1">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Game</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill v-for="{ type, count } in tcgCounts" :key="type" :active="filters.tcg.value === type" @click="filters.tcg.value = type">{{ type }} <span class="ml-0.5 opacity-60 tabular-nums">{{ count }}</span></ListingFilterPill>
                </div>
              </section>

              <!-- Status (auction only) -->
              <section v-if="showAuctionSort">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Status</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill v-for="o in [{ v: 'live', l: 'Live' }, { v: 'ended', l: 'Ended' }]" :key="o.v" :active="filters.statuses.value.includes(o.v as any)" @click="toggle(filters.statuses, o.v)">{{ o.l }}</ListingFilterPill>
                </div>
              </section>

              <!-- Time left (auction only) -->
              <section v-if="showAuctionSort">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Time left</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill v-for="o in [{ v: 'ending-soon', l: '< 1 hour' }, { v: 'today', l: 'Today' }, { v: 'longer', l: 'Later' }]" :key="o.v" :active="filters.timeBuckets.value.includes(o.v as any)" @click="toggle(filters.timeBuckets, o.v)">{{ o.l }}</ListingFilterPill>
                </div>
              </section>

              <!-- Price -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Price (RM)</p>
                <div class="flex items-center gap-2">
                  <input type="number" inputmode="decimal" placeholder="Min" :value="filters.priceMin.value ?? ''" @input="onPriceInput($event, 'min')" class="no-spin flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-ink dark:text-white" />
                  <span class="text-ink-muted dark:text-zinc-500">—</span>
                  <input type="number" inputmode="decimal" placeholder="Max" :value="filters.priceMax.value ?? ''" @input="onPriceInput($event, 'max')" class="no-spin flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-ink dark:text-white" />
                </div>
              </section>

              <!-- Set -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Set</p>
                <input type="text" v-model="filters.setQuery.value" placeholder="Search set name…" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-ink dark:text-white" />
              </section>

              <!-- Product -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Product</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill v-for="t in PRODUCT_TYPES" :key="t" :active="filters.productTypes.value.includes(t as any)" @click="toggle(filters.productTypes, t)">{{ t }}</ListingFilterPill>
                </div>
              </section>

              <!-- Condition -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Condition</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill v-for="c in UNGRADED_CONDITIONS" :key="c" :active="filters.conditions.value.includes(c)" @click="toggle(filters.conditions, c)">{{ shortCondition(c) }}</ListingFilterPill>
                </div>
              </section>

              <!-- Language -->
              <section>
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Language</p>
                <div class="flex flex-wrap gap-1.5">
                  <ListingFilterPill v-for="l in CARD_LANGUAGES" :key="l.code" :active="filters.languages.value.includes(l.code)" @click="toggle(filters.languages, l.code)">{{ l.code }}</ListingFilterPill>
                </div>
              </section>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                @click="filters.reset()"
                :disabled="filters.activeCount.value === 0"
                class="text-sm font-semibold text-ink-muted dark:text-zinc-400 disabled:opacity-40"
              >
                Reset
              </button>
              <button type="button" @click="open = false" class="px-5 py-2 rounded-full bg-pokemon-red text-white text-sm font-bold tabular-nums">
                {{ showResultsLabel }}
              </button>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </template>
</template>

<script setup lang="ts">
import {
  PRODUCT_TYPES,
  UNGRADED_CONDITIONS,
  CARD_LANGUAGES,
} from "~/composables/useCardConstants";
import type { ListingFilters } from "~/composables/useListingFilters";

const props = defineProps<{
  filters: ListingFilters;
  showAuctionSort?: boolean;
  sidebar?: boolean;
  /** Games present in the feed, with "All" first. Hidden when only one. */
  tcgCounts?: { type: string; count: number }[];
  /** How many items the current filters leave. Shown beside the phone
   *  buttons and on the filter sheet's button. */
  resultCount?: number;
  /** What one result is called in that count ("card", "auction"). */
  noun?: string;
}>();

const open = ref(false);
const sortOpen = ref(false);
const noun = computed(() => props.noun ?? "card");

const sortOptions = computed(() => {
  const base = [
    { value: "newest" as const, label: "Newest", short: "Newest" },
    { value: "price-asc" as const, label: "Price: low to high", short: "Lowest price" },
    { value: "price-desc" as const, label: "Price: high to low", short: "Highest price" },
    { value: "most-viewed" as const, label: "Most viewed", short: "Most viewed" },
  ];
  if (props.showAuctionSort) {
    base.push(
      { value: "ending-soon" as const, label: "Ending soon", short: "Ending soon" },
      { value: "most-bids" as const, label: "Most bids", short: "Most bids" },
    );
  }
  return base;
});

// Filters turns ink-filled while any are on, so the state reads at a glance.
const triggerOff =
  "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-ink dark:text-white hover:bg-canvas-sunken dark:hover:bg-zinc-700";
const triggerOn =
  "border-ink dark:border-white bg-ink dark:bg-white text-white dark:text-ink";

// The phone Sort button shows a short name so the row fits at 360px.
const currentSort = computed(
  () => sortOptions.value.find((o) => o.value === props.filters.sort.value) ?? sortOptions.value[0]!,
);

const pickSort = (value: (typeof sortOptions.value)[number]["value"]) => {
  props.filters.sort.value = value;
  sortOpen.value = false;
};

const showResultsLabel = computed(() => {
  const n = props.resultCount;
  if (n == null) return "Show results";
  if (n === 0) return `No ${noun.value}s match`;
  return `Show ${n.toLocaleString("en-MY")} ${n === 1 ? noun.value : `${noun.value}s`}`;
});

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

const STATUS_OPTS = [
  { v: "live", l: "Live" },
  { v: "ended", l: "Ended" },
];
const TIME_OPTS = [
  { v: "ending-soon", l: "< 1h" },
  { v: "today", l: "Today" },
  { v: "longer", l: "Later" },
];

// ── Collapsible sidebar groups ──────────────────────────────────────────
// Only Price starts open. A group with an active selection auto-opens so a
// filter can never be applied-but-invisible.
const DEFAULT_OPEN = new Set(["price"]);
const manual = ref<Record<string, boolean>>({});

const groups = computed(() => {
  const f = props.filters;
  const all = [
    { id: "status", label: "Status", count: f.statuses.value.length, auctionOnly: true },
    { id: "time", label: "Time left", count: f.timeBuckets.value.length, auctionOnly: true },
    {
      id: "price",
      label: "Price (RM)",
      count: f.priceMin.value != null || f.priceMax.value != null ? 1 : 0,
      auctionOnly: false,
    },
    { id: "set", label: "Set", count: f.setQuery.value.trim() ? 1 : 0, auctionOnly: false },
    { id: "product", label: "Product", count: f.productTypes.value.length, auctionOnly: false },
    { id: "condition", label: "Condition", count: f.conditions.value.length, auctionOnly: false },
    { id: "language", label: "Language", count: f.languages.value.length, auctionOnly: false },
  ];
  return all.filter((g) => !g.auctionOnly || props.showAuctionSort);
});

const isOpen = (id: string) => {
  if (id in manual.value) return manual.value[id]!;
  const g = groups.value.find((x) => x.id === id);
  return DEFAULT_OPEN.has(id) || (g?.count ?? 0) > 0;
};
const toggleSection = (id: string) => {
  manual.value = { ...manual.value, [id]: !isOpen(id) };
};

const shortCondition = (c: string) => {
  const m = c.match(/\(([^)]+)\)/);
  return m ? m[1] : c;
};

const chips = computed(() => {
  const { filters } = props;
  const out: { id: string; label: string; remove: () => void }[] = [];
  if (filters.tcg.value !== "All") {
    out.push({ id: "tcg", label: filters.tcg.value, remove: () => (filters.tcg.value = "All") });
  }
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
.no-spin::-webkit-outer-spin-button,
.no-spin::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spin {
  -moz-appearance: textfield;
  appearance: textfield;
}
/* Phone trigger buttons: 34px visible (kai's size), 44px to the finger. */
.trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 34px;
  padding: 0 0.875rem;
  border-radius: 9999px;
  border-width: 1px;
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 150ms, border-color 150ms, transform 120ms;
}
.trigger::before {
  content: "";
  position: absolute;
  inset: -5px 0;
}
.trigger:active {
  transform: scale(0.97);
}
/* Compact sidebar section label */
.sb-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.5;
  margin-bottom: 4px;
}
</style>

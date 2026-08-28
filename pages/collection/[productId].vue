<template>
  <div class="max-w-6xl mx-auto">
    <button
      type="button"
      class="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
      @click="goBack"
    >
      <svg
        class="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      Back to collection
    </button>

    <div v-if="loading" class="flex justify-center py-24">
      <div
        class="animate-spin rounded-full h-7 w-7 border-2 border-ink/10 border-t-pokemon-red"
      />
    </div>

    <div v-else-if="!card" class="surface rounded-2xl py-20 px-5 text-center">
      <p class="text-lg font-bold text-ink dark:text-white">Card not found</p>
      <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
        This catalogue card may no longer be available.
      </p>
      <NuxtLink
        to="/collection"
        class="mt-5 inline-flex items-center justify-center rounded-full bg-ink dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-ink hover:opacity-90 transition-opacity"
      >
        Browse collection cards
      </NuxtLink>
    </div>

    <template v-else>
      <section
        class="surface relative overflow-hidden rounded-3xl border border-black/[0.06] dark:border-white/[0.08]"
      >
        <div
          class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pokemon-red/[0.08] blur-3xl dark:bg-pokemon-red/[0.12]"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-pokemon-blue/[0.08] blur-3xl dark:bg-pokemon-blue/[0.12]"
          aria-hidden="true"
        />

        <div
          class="relative grid grid-cols-1 items-center gap-7 p-5 sm:p-7 md:grid-cols-[minmax(230px,310px)_1fr] md:gap-10 lg:p-10"
        >
          <div class="relative mx-auto w-full max-w-[310px] md:mx-0">
            <div
              class="absolute inset-x-5 bottom-0 h-1/2 rounded-full bg-black/15 blur-2xl dark:bg-black/40"
              aria-hidden="true"
            />
            <div
              class="relative aspect-[2.5/3.5] rotate-[-1deg] overflow-hidden rounded-[1.35rem] bg-canvas-sunken ring-1 ring-black/[0.08] shadow-card-hover transition-transform duration-300 ease-premium hover:rotate-0 dark:bg-white/[0.04] dark:ring-white/[0.10]"
            >
              <CardImage :src="card.imageUrl" :alt="card.name" />
            </div>
          </div>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span v-if="card.rarity" class="chip chip-gold">{{
                card.rarity
              }}</span>
              <span class="chip">{{ card.language }}</span>
              <span v-if="card.price" class="chip">{{
                card.price.subtype
              }}</span>
            </div>

            <p class="mt-5 eyebrow">{{ card.setName }}</p>
            <h1
              class="mt-1 font-display text-4xl font-extrabold tracking-tightest text-ink dark:text-white sm:text-5xl"
            >
              {{ card.name }}
            </h1>
            <p
              class="mt-2 text-sm text-ink-muted dark:text-zinc-400 sm:text-base"
            >
              <span v-if="card.number">Card {{ card.number }} · </span
              >{{ card.language }} printing
            </p>

            <div class="mt-7 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p
                  class="text-xs font-semibold text-ink-muted dark:text-zinc-400"
                >
                  Raw market price
                </p>
                <p
                  v-if="card.price"
                  class="mt-1 text-4xl font-black tracking-tight text-ink dark:text-white tabular-price sm:text-5xl"
                >
                  {{ formatMyr(card.price.market) }}
                  <span
                    class="mr-1 text-xl font-bold text-ink-muted dark:text-zinc-400 sm:text-2xl"
                    >MYR</span
                  >
                </p>
                <p
                  v-else
                  class="mt-2 text-xl font-bold text-ink-muted dark:text-zinc-300"
                >
                  Price unavailable
                </p>
              </div>

              <button
                type="button"
                :disabled="collectionBusy || (!!user && collectionLoading)"
                class="inline-flex min-w-[166px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                :class="
                  inCollection
                    ? 'border border-black/[0.10] bg-white/70 text-ink hover:bg-white dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.10]'
                    : 'bg-pokemon-blue text-white hover:bg-blue-700'
                "
                @click="handleCollectionToggle"
              >
                <div
                  v-if="collectionBusy"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current"
                  aria-hidden="true"
                />
                <svg
                  v-else
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.25"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path v-if="inCollection" d="m5 12 4 4L19 6" />
                  <path v-else d="M12 5v14M5 12h14" />
                </svg>
                {{ collectionButtonLabel }}
              </button>
            </div>

            <div
              class="mt-7 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-5 dark:border-white/[0.08] sm:grid-cols-3"
            >
              <div
                class="rounded-xl bg-black/[0.025] px-3 py-3 dark:bg-white/[0.04]"
              >
                <p
                  class="text-[10px] uppercase tracking-wide text-ink-soft dark:text-zinc-500"
                >
                  Market low
                </p>
                <p
                  class="mt-1 text-sm font-bold text-ink dark:text-white tabular-price"
                >
                  {{ card.price ? `${formatMyr(card.price.low)} MYR` : "—" }}
                </p>
              </div>
              <div
                class="rounded-xl bg-black/[0.025] px-3 py-3 dark:bg-white/[0.04]"
              >
                <p
                  class="text-[10px] uppercase tracking-wide text-ink-soft dark:text-zinc-500"
                >
                  Market high
                </p>
                <p
                  class="mt-1 text-sm font-bold text-ink dark:text-white tabular-price"
                >
                  {{ card.price ? `${formatMyr(card.price.high)} MYR` : "—" }}
                </p>
              </div>
              <div
                class="col-span-2 rounded-xl bg-black/[0.025] px-3 py-3 dark:bg-white/[0.04] sm:col-span-1"
              >
                <p
                  class="text-[10px] uppercase tracking-wide text-ink-soft dark:text-zinc-500"
                >
                  Graded supply
                </p>
                <p class="mt-1 text-sm font-bold text-ink dark:text-white">
                  {{ activeGradedListings.length }}
                  {{
                    activeGradedListings.length === 1 ? "listing" : "listings"
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="surface rounded-2xl mt-8 p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span class="eyebrow">Price history</span>
            <h2
              class="mt-1 text-xl font-bold tracking-tight text-ink dark:text-white"
            >
              Raw card trend
            </h2>
            <p
              v-if="historyCoverageLabel"
              class="mt-1.5 text-xs text-ink-muted dark:text-zinc-400"
            >
              {{ historyCoverageLabel }}
            </p>
          </div>
          <div class="text-right">
            <div
              class="inline-flex rounded-full bg-canvas-sunken p-1 dark:bg-white/[0.05]"
              role="group"
              aria-label="Price history range"
            >
              <button
                v-for="option in rangeOptions"
                :key="option.days"
                type="button"
                :disabled="option.disabled"
                class="inline-flex min-w-11 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                :class="
                  selectedRange === option.days && !option.disabled
                    ? 'bg-white text-ink shadow-pill dark:bg-zinc-700 dark:text-white'
                    : 'text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                "
                :aria-pressed="selectedRange === option.days"
                :title="
                  option.disabled
                    ? option.disabledReason
                    : `Show ${option.label} price history`
                "
                @click="selectedRange = option.days"
              >
                <svg
                  v-if="option.disabled"
                  class="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                {{ option.label }}
              </button>
            </div>
            <p
              v-if="unavailableRangeLabel"
              class="mt-2 max-w-xs text-[10px] leading-relaxed text-amber-700 dark:text-amber-300"
            >
              {{ unavailableRangeLabel }}
            </p>
          </div>
        </div>

        <div class="mt-6">
          <PriceTrendChart
            :trend="trend"
            :loading="trendLoading"
            :height="190"
          />
        </div>

        <div
          v-if="fullTrend"
          class="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4 text-[11px] leading-relaxed text-ink-soft dark:border-white/[0.08] dark:text-zinc-500"
        >
          <p>
            {{ selectedCoverageLabel }} No missing dates or prices are
            estimated.
          </p>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
            :class="
              historyIsStale
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            "
          >
            <span
              class="h-1.5 w-1.5 rounded-full bg-current"
              aria-hidden="true"
            />
            {{ historyFreshnessLabel }}
          </span>
        </div>
        <p
          v-else
          class="mt-5 text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500"
        >
          TCGplayer raw-card market data, converted from USD to MYR. The chart
          only draws when at least two recorded snapshots are available.
        </p>
      </section>

      <section class="surface rounded-2xl mt-6 p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span class="eyebrow">Graded prices</span>
            <h2
              class="mt-1 text-xl font-bold tracking-tight text-ink dark:text-white"
            >
              Active graded listings
            </h2>
            <p class="mt-1 max-w-xl text-sm text-ink-muted dark:text-zinc-400">
              Asking prices for professionally graded copies of this printing on
              TCGo.
            </p>
          </div>
          <span class="chip chip-accent">TCGo marketplace</span>
        </div>

        <div v-if="listingsLoading" class="flex justify-center py-12">
          <div
            class="animate-spin rounded-full h-5 w-5 border-2 border-ink/10 border-t-pokemon-red"
          />
        </div>

        <div
          v-else-if="gradedRows.length === 0"
          class="mt-6 rounded-xl border border-dashed border-black/[0.10] dark:border-white/[0.12] py-9 px-5 text-center"
        >
          <div
            class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M8 7h8M8 11h8M9 17h6" />
            </svg>
          </div>
          <p class="mt-3 text-sm font-semibold text-ink dark:text-white">
            No graded prices yet
          </p>
          <p class="mt-1 text-xs text-ink-muted dark:text-zinc-400">
            Prices will appear when a seller lists a matched graded copy.
          </p>
        </div>

        <div
          v-else
          class="mt-6 overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
        >
          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full min-w-[600px] text-sm">
              <thead class="bg-canvas-sunken dark:bg-white/[0.03]">
                <tr
                  class="text-left text-[10px] uppercase tracking-[0.14em] text-ink-soft dark:text-zinc-500"
                >
                  <th class="px-4 py-3 font-semibold">Grade</th>
                  <th class="px-4 py-3 font-semibold">Lowest ask</th>
                  <th class="px-4 py-3 font-semibold">Price range</th>
                  <th class="px-4 py-3 font-semibold">Available</th>
                  <th class="px-4 py-3 font-semibold">
                    <span class="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody
                class="divide-y divide-black/[0.06] dark:divide-white/[0.06]"
              >
                <tr v-for="row in gradedRows" :key="row.key">
                  <td class="px-4 py-4">
                    <span
                      class="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-2 py-1 text-xs font-extrabold text-amber-950"
                    >
                      <span class="uppercase tracking-wide">{{
                        row.provider
                      }}</span>
                      <span>{{ row.grade }}</span>
                    </span>
                  </td>
                  <td
                    class="px-4 py-4 font-bold text-ink dark:text-white tabular-price"
                  >
                    {{ formatMyr(row.low) }} MYR
                  </td>
                  <td
                    class="px-4 py-4 text-ink-muted dark:text-zinc-300 tabular-price"
                  >
                    {{ formatPriceRange(row.low, row.high) }}
                  </td>
                  <td class="px-4 py-4 text-ink-muted dark:text-zinc-300">
                    {{ row.count }}
                    {{ row.count === 1 ? "listing" : "listings" }}
                  </td>
                  <td class="px-4 py-4 text-right">
                    <NuxtLink
                      :to="`/cards/${row.lowestListingId}`"
                      class="inline-flex items-center gap-1 text-xs font-bold text-pokemon-red hover:underline"
                    >
                      View
                      <svg
                        class="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        aria-hidden="true"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </NuxtLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            class="sm:hidden divide-y divide-black/[0.06] dark:divide-white/[0.06]"
          >
            <NuxtLink
              v-for="row in gradedRows"
              :key="row.key"
              :to="`/cards/${row.lowestListingId}`"
              class="flex items-center justify-between gap-4 p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
            >
              <div>
                <span
                  class="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-xs font-extrabold text-amber-950"
                >
                  <span class="uppercase tracking-wide">{{
                    row.provider
                  }}</span>
                  <span>{{ row.grade }}</span>
                </span>
                <p class="mt-2 text-[11px] text-ink-soft dark:text-zinc-500">
                  {{ row.count }} {{ row.count === 1 ? "listing" : "listings" }}
                </p>
              </div>
              <div class="text-right">
                <p
                  class="text-sm font-bold text-ink dark:text-white tabular-price"
                >
                  {{ formatMyr(row.low) }} MYR
                </p>
                <p
                  v-if="row.high !== row.low"
                  class="mt-0.5 text-[10px] text-ink-soft dark:text-zinc-500"
                >
                  up to {{ formatMyr(row.high) }} MYR
                </p>
              </div>
            </NuxtLink>
          </div>
        </div>

        <p
          v-if="gradedRows.length"
          class="mt-4 text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500"
        >
          These are seller asking prices, not independent appraisal values. Tap
          a row to view the lowest-priced listing.
        </p>
      </section>

      <section v-if="relatedLoading || relatedCards.length" class="mt-10 pb-4">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span class="eyebrow">Keep exploring</span>
            <h2
              class="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-white"
            >
              Cards you may also like
            </h2>
            <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
              Related printings and notable cards from {{ card.setName }}.
            </p>
          </div>
          <NuxtLink
            :to="`/collection?set=${encodeURIComponent(card.setName)}`"
            class="inline-flex items-center gap-1 text-xs font-bold text-pokemon-red hover:underline"
          >
            Explore collection
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </NuxtLink>
        </div>

        <div
          v-if="relatedLoading"
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Loading recommended cards"
        >
          <div
            v-for="index in 5"
            :key="index"
            class="surface overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
          >
            <div
              class="aspect-[2.5/3.5] animate-pulse bg-black/[0.05] dark:bg-white/[0.05]"
            />
            <div class="space-y-2.5 p-3">
              <div
                class="h-3.5 w-2/3 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]"
              />
              <div
                class="h-2.5 w-full animate-pulse rounded bg-black/[0.05] dark:bg-white/[0.05]"
              />
              <div
                class="h-4 w-1/2 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]"
              />
            </div>
          </div>
        </div>

        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          <div
            v-for="relatedCard in relatedCards"
            :key="relatedCard.productId"
            class="relative"
            :aria-busy="relatedBusyIds.has(relatedCard.productId)"
          >
            <CollectionItemCard
              :card="relatedCard"
              :in-collection="isInCollection(relatedCard.productId)"
              :class="
                relatedBusyIds.has(relatedCard.productId)
                  ? 'pointer-events-none opacity-55'
                  : ''
              "
              @toggle="handleRelatedToggle(relatedCard.productId)"
            />
            <div
              v-if="relatedBusyIds.has(relatedCard.productId)"
              class="pointer-events-none absolute bottom-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-pokemon-blue text-white shadow-sm"
              aria-hidden="true"
            >
              <div
                class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              />
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import {
  buildPriceTrend,
  type CatalogMatch,
  type PriceTrend,
} from "~/composables/useCardCatalog";

type HistoryDays = 30 | 90 | 365;

interface GradedPriceRow {
  key: string;
  provider: string;
  grade: string;
  low: number;
  high: number;
  count: number;
  lowestListingId: string;
}

const route = useRoute();
const router = useRouter();
const productId = computed(() => Number(route.params.productId));

const { getCardWithPrice, getPriceHistory, getRelatedCards } = useCardCatalog();
const { cards: marketplaceCards, loading: listingsLoading } = useCards();
const { user, signInWithGoogle } = useAuth();
const {
  loading: collectionLoading,
  listenMyCollection,
  stopListening,
  isInCollection,
  toggleInCollection,
} = useUserCollection();

const card = ref<CatalogMatch | null>(null);
const fullTrend = ref<PriceTrend | null>(null);
const relatedCards = ref<CatalogMatch[]>([]);
const loading = ref(true);
const trendLoading = ref(false);
const relatedLoading = ref(false);
const collectionBusy = ref(false);
const relatedBusyIds = ref<Set<number>>(new Set());
const selectedRange = ref<HistoryDays>(90);
let detailRequest = 0;
let relatedRequest = 0;

const rangeDefinitions: Array<{ label: string; days: HistoryDays }> = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
];

const rangeTrends = computed(() =>
  rangeDefinitions.map((option) => ({
    ...option,
    trend: fullTrend.value
      ? buildPriceTrend(fullTrend.value.points, option.days)
      : null,
  })),
);

const rangeOptions = computed(() =>
  rangeTrends.value.map((option, index, options) => {
    const previous = index > 0 ? options[index - 1] : null;
    const snapshots = option.trend?.points.length ?? 0;
    const previousSnapshots = previous?.trend?.points.length ?? -1;
    const disabled = index > 0 && snapshots <= previousSnapshots;
    return {
      label: option.label,
      days: option.days,
      disabled,
      disabledReason: disabled
        ? `${option.label} is unavailable because it contains no additional recorded prices beyond ${previous!.label}.`
        : "",
    };
  }),
);

const trend = computed<PriceTrend | null>(
  () =>
    rangeTrends.value.find((option) => option.days === selectedRange.value)
      ?.trend ?? null,
);

const HISTORY_DAY_MS = 86_400_000;

const formatHistoryDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const historyCoverageLabel = computed(() => {
  const history = fullTrend.value;
  if (!history) return "";
  return `${history.snapshotCount} recorded ${history.snapshotCount === 1 ? "snapshot" : "snapshots"} · ${formatHistoryDate(history.oldestAvailableDate)}–${formatHistoryDate(history.latestAvailableDate)}`;
});

const unavailableRangeLabel = computed(() => {
  const history = fullTrend.value;
  const oneYear = rangeOptions.value.find((option) => option.days === 365);
  if (!history || !oneYear?.disabled) return "";
  return `1Y unavailable — ${history.snapshotCount} snapshots / ${history.availableSpanDays} days recorded (${formatHistoryDate(history.oldestAvailableDate)}–${formatHistoryDate(history.latestAvailableDate)}).`;
});

const selectedCoverageLabel = computed(() => {
  const selected = trend.value;
  if (!selected) return "";
  const label =
    rangeDefinitions.find((option) => option.days === selectedRange.value)
      ?.label ?? "Selected range";
  const firstDate = selected.points[0]?.date;
  const lastDate = selected.points[selected.points.length - 1]?.date;
  if (!firstDate || !lastDate) return "";
  const spanDays =
    Math.max(
      0,
      Math.round(
        (Date.parse(`${lastDate}T00:00:00Z`) -
          Date.parse(`${firstDate}T00:00:00Z`)) /
          HISTORY_DAY_MS,
      ),
    ) + 1;
  return `${label}: ${selected.points.length} recorded ${selected.points.length === 1 ? "snapshot" : "snapshots"} across ${spanDays} calendar ${spanDays === 1 ? "day" : "days"}.`;
});

const historyAgeDays = computed(() => {
  const latest = fullTrend.value?.latestAvailableDate;
  if (!latest) return 0;
  return Math.max(
    0,
    Math.floor(
      (Date.now() - Date.parse(`${latest}T00:00:00Z`)) / HISTORY_DAY_MS,
    ),
  );
});

const historyIsStale = computed(() => historyAgeDays.value > 2);
const historyFreshnessLabel = computed(() => {
  if (!fullTrend.value) return "No snapshots yet";
  if (historyAgeDays.value === 0) return "Latest snapshot today";
  if (historyAgeDays.value === 1) return "Latest snapshot yesterday";
  return `Latest snapshot ${historyAgeDays.value} days ago`;
});

const inCollection = computed(
  () =>
    Boolean(user.value) &&
    !collectionLoading.value &&
    Number.isFinite(productId.value) &&
    isInCollection(productId.value),
);

const collectionButtonLabel = computed(() => {
  if (!user.value) return "Sign in to collect";
  if (collectionLoading.value) return "Checking collection…";
  return inCollection.value ? "In my collection" : "Add to collection";
});

const normalizeText = (value?: string | null) =>
  (value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const normalizeNumber = (value?: string | null) =>
  normalizeText(value).replace(/\s+/g, "");

const listingMatchesCard = (listing: Card, catalogCard: CatalogMatch) => {
  const listingProductId = Number(listing.productId);
  if (Number.isFinite(listingProductId) && listingProductId > 0) {
    return listingProductId === catalogCard.productId;
  }

  if (normalizeText(listing.cardName) !== normalizeText(catalogCard.name)) {
    return false;
  }

  // Legacy listings may pre-date productId. Match those conservatively: an
  // exact set and compatible language are required before the printed number
  // can disambiguate the card. It is safer to omit a price than attach a slab
  // from another printing that happens to reuse the same collector number.
  const listingSet = normalizeText(listing.cardSet);
  const catalogSet = normalizeText(catalogCard.setName);
  if (!listingSet || !catalogSet || listingSet !== catalogSet) return false;

  const listingLanguage = (listing.language || "EN").toUpperCase();
  if (listingLanguage !== catalogCard.language.toUpperCase()) return false;

  const listingNumber = normalizeNumber(listing.cardNumber);
  const catalogNumber = normalizeNumber(catalogCard.number);

  if (!catalogNumber) return !listingNumber;
  if (!listingNumber) return false;

  return (
    listingNumber === catalogNumber ||
    listingNumber.split("/")[0] === catalogNumber.split("/")[0]
  );
};

const providerLabel = (listing: Card) => {
  if (listing.gradingProvider === "Others") {
    return listing.customGradingProvider?.trim() || "Graded";
  }
  return listing.gradingProvider?.trim() || "Graded";
};

const activeGradedListings = computed(() => {
  if (!card.value) return [];
  return marketplaceCards.value.filter(
    (listing) =>
      listing.productType === "Graded" &&
      !listing.sold &&
      (!listing.status || listing.status === "active") &&
      Number.isFinite(listing.price) &&
      listing.price > 0 &&
      listingMatchesCard(listing, card.value!),
  );
});

const providerOrder = new Map([
  ["PSA", 0],
  ["CGC", 1],
  ["BGS", 2],
  ["Beckett", 2],
  ["TAG", 3],
  ["ACE", 4],
]);

const gradedRows = computed<GradedPriceRow[]>(() => {
  const groups = new Map<string, Card[]>();
  for (const listing of activeGradedListings.value) {
    const provider = providerLabel(listing);
    const grade = listing.grade?.trim() || "—";
    const key = `${provider.toLocaleLowerCase()}::${grade.toLocaleLowerCase()}`;
    const group = groups.get(key) ?? [];
    group.push(listing);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, listings]) => {
      const sorted = [...listings].sort((a, b) => a.price - b.price);
      return {
        key,
        provider: providerLabel(sorted[0]!),
        grade: sorted[0]!.grade?.trim() || "—",
        low: sorted[0]!.price,
        high: sorted[sorted.length - 1]!.price,
        count: sorted.length,
        lowestListingId: sorted[0]!.id,
      };
    })
    .sort((a, b) => {
      const providerDiff =
        (providerOrder.get(a.provider) ?? 99) -
        (providerOrder.get(b.provider) ?? 99);
      if (providerDiff) return providerDiff;
      return (
        (Number.parseFloat(b.grade) || 0) - (Number.parseFloat(a.grade) || 0)
      );
    });
});

const loadRelated = async (
  sourceCard: CatalogMatch,
  detailRequestAtStart: number,
) => {
  const request = ++relatedRequest;
  relatedLoading.value = true;
  try {
    const nextCards = await getRelatedCards(sourceCard, 5);
    if (
      request === relatedRequest &&
      detailRequestAtStart === detailRequest &&
      productId.value === sourceCard.productId
    ) {
      relatedCards.value = nextCards;
    }
  } catch (err) {
    if (request === relatedRequest) {
      console.error("[collection detail] related cards failed:", err);
      relatedCards.value = [];
    }
  } finally {
    if (
      request === relatedRequest &&
      detailRequestAtStart === detailRequest &&
      productId.value === sourceCard.productId
    ) {
      relatedLoading.value = false;
    }
  }
};

const loadDetail = async () => {
  const id = productId.value;
  const request = ++detailRequest;
  // Invalidate recommendation work belonging to the previous route before
  // clearing the visible state.
  relatedRequest++;
  relatedCards.value = [];
  relatedLoading.value = false;
  relatedBusyIds.value = new Set();
  fullTrend.value = null;

  if (!Number.isSafeInteger(id) || id <= 0) {
    card.value = null;
    loading.value = false;
    trendLoading.value = false;
    return;
  }

  loading.value = true;
  trendLoading.value = true;
  try {
    // `getPriceHistory` returns all recorded points inside this window once.
    // The range buttons derive their smaller calendar windows locally.
    const [nextCard, nextFullTrend] = await Promise.all([
      getCardWithPrice(id),
      getPriceHistory(id, 365),
    ]);
    if (request !== detailRequest || productId.value !== id) return;

    card.value = nextCard;
    fullTrend.value = nextFullTrend;

    const selected = rangeOptions.value.find(
      (option) => option.days === selectedRange.value,
    );
    if (selected?.disabled) {
      selectedRange.value =
        rangeOptions.value.find((option) => !option.disabled)?.days ?? 30;
    }

    if (nextCard) void loadRelated(nextCard, request);
  } catch (err) {
    if (request === detailRequest) {
      console.error("[collection detail] load failed:", err);
      card.value = null;
      fullTrend.value = null;
    }
  } finally {
    if (request === detailRequest && productId.value === id) {
      loading.value = false;
      trendLoading.value = false;
    }
  }
};

watch(productId, loadDetail, { immediate: true });
watch(
  user,
  (currentUser) => {
    if (currentUser) {
      listenMyCollection();
    } else {
      stopListening();
    }
  },
  { immediate: true },
);

const handleCollectionToggle = async () => {
  if (!user.value) {
    await signInWithGoogle();
    return;
  }
  if (
    !Number.isSafeInteger(productId.value) ||
    collectionBusy.value ||
    collectionLoading.value
  ) {
    return;
  }
  collectionBusy.value = true;
  try {
    await toggleInCollection(productId.value);
  } finally {
    collectionBusy.value = false;
  }
};

const setRelatedBusy = (id: number, busy: boolean) => {
  const next = new Set(relatedBusyIds.value);
  if (busy) next.add(id);
  else next.delete(id);
  relatedBusyIds.value = next;
};

const handleRelatedToggle = async (id: number) => {
  if (relatedBusyIds.value.has(id)) return;
  setRelatedBusy(id, true);
  try {
    if (!user.value) {
      await signInWithGoogle();
      return;
    }
    if (collectionLoading.value) return;
    await toggleInCollection(id);
  } catch (err) {
    console.error("[collection detail] recommendation toggle failed:", err);
  } finally {
    setRelatedBusy(id, false);
  }
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/collection");
  }
};

const formatMyr = (value: number) =>
  value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPriceRange = (low: number, high: number) =>
  low === high
    ? `${formatMyr(low)} MYR`
    : `${formatMyr(low)}–${formatMyr(high)} MYR`;

useHead(() => ({
  title: card.value
    ? `${card.value.name} Prices | TCGo Marketplace`
    : "Card Prices | TCGo Marketplace",
}));
</script>

<template>
  <!-- eBay's licence wants its listings kept apart from TCGo's own, so they
       get their own section with its own label, never mixed into ours. -->
  <section
    v-if="state !== 'hidden'"
    class="panel surface rounded-2xl mt-6 p-5 sm:p-6"
    aria-labelledby="ebay-listings-title"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span class="eyebrow">From eBay</span>
        <h2
          id="ebay-listings-title"
          class="mt-1 text-xl font-bold tracking-tight text-ink dark:text-white"
        >
          {{ mode === "sold" ? "Sold on eBay" : "Listed on eBay" }}
        </h2>
        <p class="mt-1 max-w-xl text-sm text-ink-muted dark:text-zinc-400">
          <template v-if="mode === 'sold'">
            Recent sales on eBay.com from the last 90 days.
          </template>
          <template v-else>
            Current asking prices on eBay.com, not sold prices.
          </template>
          Ringgit is converted from USD and leaves out shipping and import
          costs.
        </p>
      </div>
      <!-- Only offered when eBay gives us sold data; without it there is
           nothing to switch to. -->
      <div
        v-if="canSwitch"
        class="inline-flex rounded-full bg-canvas-sunken p-1 dark:bg-white/[0.05]"
        role="group"
        aria-label="eBay listings to show"
      >
        <button
          v-for="option in MODE_OPTIONS"
          :key="option.mode"
          type="button"
          class="inline-flex min-w-11 items-center justify-center rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
          :class="
            mode === option.mode
              ? 'bg-white text-ink shadow-pill dark:bg-zinc-700 dark:text-white'
              : 'text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-white'
          "
          :aria-pressed="mode === option.mode"
          @click="mode = option.mode"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <ul
      v-if="state === 'loading'"
      class="mt-5 divide-y divide-black/[0.06] dark:divide-white/[0.08]"
      aria-label="Loading eBay listings"
    >
      <li v-for="index in 3" :key="index" class="flex items-center gap-3 py-3">
        <div
          class="h-16 w-12 shrink-0 animate-pulse rounded-md bg-black/[0.05] dark:bg-white/[0.05]"
        />
        <div class="min-w-0 flex-1 space-y-2">
          <div
            class="h-3.5 w-4/5 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]"
          />
          <div
            class="h-2.5 w-1/3 animate-pulse rounded bg-black/[0.05] dark:bg-white/[0.05]"
          />
        </div>
        <div
          class="h-4 w-16 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.06]"
        />
      </li>
    </ul>

    <ul
      v-else-if="data && data.enabled && data.items.length"
      class="-mx-2 mt-4 divide-y divide-black/[0.06] dark:divide-white/[0.08]"
    >
      <li v-for="item in data.items" :key="item.id">
        <a
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="flex min-h-11 items-center gap-3 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06]"
        >
          <img
            v-if="item.imageUrl && !brokenImages.has(item.id)"
            :src="ebayImageUrl(item.imageUrl, 48) ?? undefined"
            alt=""
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            class="h-16 w-12 shrink-0 rounded-md bg-black/[0.04] object-cover dark:bg-white/[0.06]"
            @error="brokenImages.add(item.id)"
          />
          <div
            v-else
            class="h-16 w-12 shrink-0 rounded-md bg-black/[0.04] dark:bg-white/[0.06]"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p
              class="line-clamp-2 text-sm font-semibold leading-snug text-ink dark:text-white"
            >
              {{ item.title }}
            </p>
            <p class="mt-1 truncate text-xs text-ink-muted dark:text-zinc-400">
              {{ rowMeta(item) }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p
              v-if="item.myr !== null"
              class="text-sm font-bold text-ink dark:text-white tabular-price"
            >
              ≈ {{ formatMyr(item.myr) }} MYR
            </p>
            <p
              class="text-[11px] text-ink-soft dark:text-zinc-500 tabular-price"
              :class="item.myr === null && 'text-sm font-bold text-ink dark:text-white'"
            >
              {{ formatOriginal(item.price) }}
            </p>
          </div>
        </a>
      </li>
    </ul>

    <p
      v-else-if="data && data.enabled"
      class="mt-5 text-sm text-ink-muted dark:text-zinc-400"
    >
      {{
        mode === "sold"
          ? "No eBay sales of this card in the last 90 days."
          : "No eBay listings match this card right now."
      }}
    </p>

    <div
      v-if="data && data.enabled && state === 'ready'"
      class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4 text-[11px] text-ink-soft dark:border-white/[0.08] dark:text-zinc-500"
    >
      <p>{{ checkedLabel }}</p>
      <a
        :href="data.searchUrl"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-ink hover:text-pokemon-red dark:text-white"
      >
        {{ mode === "sold" ? "See sold on eBay" : "See all on eBay" }}
        <svg
          class="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  ebayImageUrl,
  type EbayListing,
  type EbayListingsResponse,
  type EbayMode,
} from "~/shared/ebay";

const props = defineProps<{
  name: string;
  number?: string | null;
  language?: string | null;
}>();

const MODE_OPTIONS: { mode: EbayMode; label: string }[] = [
  { mode: "sold", label: "Sold" },
  { mode: "active", label: "Active" },
];

// Both are asked for at once. Sold is the default whenever eBay gives us
// sold data (it needs eBay's approval for Marketplace Insights); otherwise
// the section shows active listings and no switch.
const results = ref<Record<EbayMode, EbayListingsResponse | null>>({
  sold: null,
  active: null,
});
const mode = ref<EbayMode>("sold");
const usable = (res: EbayListingsResponse | null) =>
  !!res && res.enabled && res.ok;
const canSwitch = computed(
  () => usable(results.value.sold) && usable(results.value.active),
);
const data = computed(() => results.value[mode.value]);
const loading = ref(false);
// A photo that still fails falls back to the plain tile, not a broken icon.
const brokenImages = reactive(new Set<string>());
let request = 0;

// Hidden while the keyset isn't configured and when eBay errors: an eBay
// outage shouldn't leave a broken box on TCGo's own price page.
const state = computed(() => {
  if (loading.value && !data.value) return "loading";
  if (!data.value || !data.value.enabled || !data.value.ok) return "hidden";
  return "ready";
});

const fetchMode = (which: EbayMode) =>
  $fetch<EbayListingsResponse>("/api/ebay/listings", {
    query: {
      name: props.name,
      number: props.number ?? "",
      language: props.language ?? "",
      mode: which,
    },
  }).catch(() => null);

const load = async () => {
  const current = ++request;
  results.value = { sold: null, active: null };
  if (!props.name) return;
  loading.value = true;
  try {
    const [sold, active] = await Promise.all([
      fetchMode("sold"),
      fetchMode("active"),
    ]);
    if (current !== request) return;
    results.value = { sold, active };
    mode.value = usable(sold) ? "sold" : "active";
  } finally {
    if (current === request) loading.value = false;
  }
};

const soldDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });

const rowMeta = (item: EbayListing) =>
  [
    item.condition,
    mode.value === "sold"
      ? item.soldAt
        ? `Sold ${soldDate(item.soldAt)}`
        : "Sold"
      : item.seller,
  ]
    .filter(Boolean)
    .join(" · ");

onMounted(() => {
  watch(
    () => [props.name, props.number, props.language],
    load,
    { immediate: true },
  );
});

// eBay's licence: say how far behind eBay the listings may be.
const checkedLabel = computed(() => {
  if (!data.value?.enabled) return "";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - data.value.fetchedAt) / 60_000),
  );
  const ago =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : `${Math.round(minutes / 60)} h ago`;
  return mode.value === "sold"
    ? `Checked on eBay ${ago}.`
    : `Checked on eBay ${ago}. Prices may have changed since.`;
});

const formatMyr = (value: number) =>
  value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatOriginal = (price: { value: number; currency: string }) =>
  price.currency === "USD"
    ? `US$${price.value.toFixed(2)}`
    : `${price.value.toFixed(2)} ${price.currency}`;
</script>

// Shared filter state for the shop + auctions index pages.
//
// Two callsites (cards and auctions) share rarity/variant/language/condition/
// set/price filters. Auctions also gets status and time-left buckets. Sort
// has a card-only "newest/price asc/price desc" and an auction-only
// "ending soon".
//
// State is local to the composable instance — each callsite creates its
// own with `useListingFilters({...})` so the shop and auctions pages don't
// share selections.

export type ProductTypeFilter = "Ungraded" | "Graded" | "Sealed";
export type StatusFilter = "live" | "ended";
export type TimeLeftBucket = "ending-soon" | "today" | "longer";
export type SortKey =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "ending-soon"
  | "most-bids";

export interface FilterableItem {
  rarity?: string;
  variant?: string;
  language?: string;
  productType?: string;
  condition?: string;
  cardSet?: string;
  price?: number;
  currentPrice?: number;
  startingPrice?: number;
  createdAt?: number;
  endsAt?: number;
  bidCount?: number;
}

const inBucket = (endsAt: number | undefined, bucket: TimeLeftBucket) => {
  if (!endsAt) return false;
  const diff = endsAt - Date.now();
  if (diff <= 0) return false;
  if (bucket === "ending-soon") return diff < 3_600_000;
  if (bucket === "today") return diff >= 3_600_000 && diff < 86_400_000;
  return diff >= 86_400_000;
};

export const useListingFilters = (options?: {
  defaultSort?: SortKey;
}) => {
  const rarities = ref<string[]>([]);
  const variants = ref<string[]>([]);
  const languages = ref<string[]>([]);
  const productTypes = ref<ProductTypeFilter[]>([]);
  const conditions = ref<string[]>([]);
  const setQuery = ref("");
  const priceMin = ref<number | null>(null);
  const priceMax = ref<number | null>(null);
  // Auction-only.
  const statuses = ref<StatusFilter[]>([]);
  const timeBuckets = ref<TimeLeftBucket[]>([]);
  // Sort.
  const sort = ref<SortKey>(options?.defaultSort ?? "newest");

  const activeCount = computed(() => {
    let n = 0;
    if (rarities.value.length) n++;
    if (variants.value.length) n++;
    if (languages.value.length) n++;
    if (productTypes.value.length) n++;
    if (conditions.value.length) n++;
    if (setQuery.value.trim()) n++;
    if (priceMin.value != null || priceMax.value != null) n++;
    if (statuses.value.length) n++;
    if (timeBuckets.value.length) n++;
    return n;
  });

  const reset = () => {
    rarities.value = [];
    variants.value = [];
    languages.value = [];
    productTypes.value = [];
    conditions.value = [];
    setQuery.value = "";
    priceMin.value = null;
    priceMax.value = null;
    statuses.value = [];
    timeBuckets.value = [];
  };

  const priceOf = (item: FilterableItem) =>
    item.price ?? item.currentPrice ?? item.startingPrice ?? 0;

  const matches = (item: FilterableItem): boolean => {
    if (rarities.value.length && !rarities.value.includes(item.rarity ?? ""))
      return false;
    if (variants.value.length && !variants.value.includes(item.variant ?? ""))
      return false;
    if (
      languages.value.length &&
      !languages.value.includes(item.language ?? "EN")
    )
      return false;
    if (
      productTypes.value.length &&
      !productTypes.value.includes(
        (item.productType as ProductTypeFilter) ?? "Ungraded",
      )
    )
      return false;
    if (
      conditions.value.length &&
      !conditions.value.includes(item.condition ?? "")
    )
      return false;
    const q = setQuery.value.trim().toLowerCase();
    if (q && !(item.cardSet ?? "").toLowerCase().includes(q)) return false;
    const p = priceOf(item);
    if (priceMin.value != null && p < priceMin.value) return false;
    if (priceMax.value != null && p > priceMax.value) return false;
    // Auction-only fields.
    if (statuses.value.length) {
      const live = (item.endsAt ?? 0) > Date.now();
      const tag: StatusFilter = live ? "live" : "ended";
      if (!statuses.value.includes(tag)) return false;
    }
    if (timeBuckets.value.length) {
      const hit = timeBuckets.value.some((b) => inBucket(item.endsAt, b));
      if (!hit) return false;
    }
    return true;
  };

  const sortItems = <T extends FilterableItem>(items: T[]): T[] => {
    const copy = [...items];
    switch (sort.value) {
      case "price-asc":
        return copy.sort((a, b) => priceOf(a) - priceOf(b));
      case "price-desc":
        return copy.sort((a, b) => priceOf(b) - priceOf(a));
      case "ending-soon":
        return copy.sort((a, b) => (a.endsAt ?? 0) - (b.endsAt ?? 0));
      case "most-bids":
        return copy.sort((a, b) => (b.bidCount ?? 0) - (a.bidCount ?? 0));
      case "newest":
      default:
        return copy.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }
  };

  const apply = <T extends FilterableItem>(items: T[]): T[] =>
    sortItems(items.filter(matches));

  return {
    rarities,
    variants,
    languages,
    productTypes,
    conditions,
    setQuery,
    priceMin,
    priceMax,
    statuses,
    timeBuckets,
    sort,
    activeCount,
    reset,
    matches,
    apply,
  };
};

export type ListingFilters = ReturnType<typeof useListingFilters>;

<template>
  <div class="lg:flex lg:gap-8 xl:gap-10">
    <!-- ── Filter sidebar (desktop only) ─────────────────────────────── -->
    <aside
      v-if="!loading"
      class="hidden lg:block w-56 xl:w-60 shrink-0 sticky top-[8.75rem] self-start max-h-[calc(100vh-10.25rem)] overflow-y-auto no-scrollbar"
    >
      <ListingFilters :filters="filters" :sidebar="true" :tcg-counts="tcgCounts" />
    </aside>

    <!-- ── Main content ───────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0">
      <PremiumBanner />

      <!-- First visit, signed out: one line on what this is and what protects
           the money, since nothing else on the grid says so. Gone once
           dismissed or signed in. Rendered after mount so a signed-in member
           never sees it flash in from the server render. -->
      <div
        v-if="showIntro"
        class="mb-3 flex items-start gap-3 rounded-2xl bg-pokemon-red/[0.06] dark:bg-pokemon-red/[0.12] px-4 py-3"
      >
        <p class="min-w-0 flex-1 text-[13px] leading-relaxed text-ink dark:text-zinc-200">
          Cards from Malaysian collectors. Your payment is held until your card
          arrives.
          <NuxtLink to="/refund-policy" class="font-semibold text-pokemon-red hover:underline">How Buyer Protection works</NuxtLink>
        </p>
        <button
          type="button"
          @click="dismissIntro"
          class="-m-2 shrink-0 p-2 text-ink-soft hover:text-ink dark:hover:text-white"
          aria-label="Dismiss"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mobile filter trigger (hidden on desktop where sidebar is shown) -->
      <div v-if="!loading" class="lg:hidden mb-2">
        <ListingFilters :filters="filters" :tcg-counts="tcgCounts" />
      </div>

      <!-- Loading: skeleton tiles in the same grid, so the page doesn't
           jump when listings arrive. -->
      <div
        v-if="loading"
        class="-mx-1.5 lg:mx-0 grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4 xl:gap-5"
        role="status"
        aria-label="Loading listings"
      >
        <CardTileSkeleton v-for="n in 10" :key="n" />
      </div>

      <!-- Empty because filters hid everything: offer a way back out. -->
      <EmptyState
        v-else-if="availableCards.length === 0 && filters.activeCount.value > 0"
        headline="No cards match these filters"
        caption="Try removing a filter or switching back to all games."
      >
        <template #icon>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 5h18l-7 8v6l-4-2v-4z" />
          </svg>
        </template>
        <button
          type="button"
          @click="filters.reset()"
          class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
        >
          Clear filters
        </button>
      </EmptyState>

      <!-- Empty marketplace -->
      <EmptyState
        v-else-if="availableCards.length === 0"
        headline="No cards listed yet"
        caption="Be the first collector to list one."
      >
        <NuxtLink
          v-if="user"
          to="/seller/listings/new"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow ease-premium"
        >
          List your first card
        </NuxtLink>
      </EmptyState>

      <!-- Grid -->
      <template v-else>
        <div
          class="-mx-1.5 lg:mx-0 grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4 xl:gap-5"
        >
          <CardTile v-for="card in visibleCards" :key="card.id" :card="card" />
        </div>

        <!-- Infinite scroll: coming near this line shows the next batch.
             On desktop it pauses every few batches behind a button so the
             footer (legal links) can still be reached. -->
        <div ref="sentinel" aria-hidden="true" />
        <div
          v-if="hasMore && autoPaused"
          class="mt-8 sm:mt-10 flex justify-center"
        >
          <button
            type="button"
            @click="showMore"
            class="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
          >
            Show more
          </button>
        </div>
        <p
          v-else-if="!hasMore && availableCards.length > SHOP_PAGE_SIZE"
          class="mt-8 sm:mt-10 text-center text-xs text-ink-muted dark:text-zinc-400 tabular-nums"
        >
          That's all {{ availableCards.length }} listings
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import { isAvailable } from "~/shared/card-availability";
import { SHOP_PAGE_SIZE, SHOP_STATE_KEY } from "~/composables/useShopOrdering";

useHead({
  title: "Shop Pokemon Cards | TCGo Marketplace",
  meta: [
    {
      name: "description",
      content:
        "Browse and buy Pokemon TCG cards from collectors across Malaysia. Find rare cards, vintage sets, and modern releases at fair prices.",
    },
  ],
});

const { user, authLoading } = useAuth();

const INTRO_KEY = "tcgo:intro-dismissed";
const mounted = ref(false);
const introDismissed = ref(false);
onMounted(() => {
  try {
    introDismissed.value = localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    // Storage blocked: show it; dismissing still hides it for this visit.
  }
  mounted.value = true;
});
const showIntro = computed(
  () => mounted.value && !authLoading.value && !user.value && !introDismissed.value,
);
const dismissIntro = () => {
  introDismissed.value = true;
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Nothing to do: it stays hidden until the page is reloaded.
  }
};
const { cards, loading } = useCards();
const filters = useListingFilters();

// The game selector lives in the filter panel now; its state is filters.tcg.
const tcgOf = (c: Card) => c.tcgType || "Pokemon";

const tcgCounts = computed(() => {
  const live = cards.value.filter(isAvailable);
  const counts = new Map<string, number>();
  counts.set("All", live.length);
  for (const c of live) {
    const t = tcgOf(c);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const rest = [...counts.entries()]
    .filter(([type]) => type !== "All")
    .sort((a, b) => b[1] - a[1]);
  return [["All", counts.get("All") ?? 0] as [string, number], ...rest].map(
    ([type, count]) => ({ type, count }),
  );
});

const { discoveryOrder } = useShopOrdering();

const availableCards = computed(() => {
  const base = cards.value.filter(isAvailable);
  const sorted = filters.apply(base);
  // Only the default feed gets the discovery mix; an explicit sort is exact.
  return filters.sort.value === "newest" ? discoveryOrder(sorted) : sorted;
});

// ── Infinite scroll (batches of 60 — divides evenly into every grid column count) ──
// All listings are already in memory, so "loading more" just shows a longer
// slice. Phones keep loading as long as there's more; desktop (which has the
// footer) pauses after a few batches and shows a "Show more" button.
const AUTO_BATCHES_DESKTOP = 3;

const visibleCount = ref(SHOP_PAGE_SIZE);
const autoBatches = ref(0);
const isDesktop = ref(false);
const visibleCards = computed(() =>
  availableCards.value.slice(0, visibleCount.value),
);
const hasMore = computed(() => visibleCount.value < availableCards.value.length);
const autoPaused = computed(
  () => isDesktop.value && autoBatches.value >= AUTO_BATCHES_DESKTOP,
);

const loadMore = () => {
  if (!hasMore.value) return;
  visibleCount.value += SHOP_PAGE_SIZE;
  autoBatches.value++;
};
const showMore = () => {
  autoBatches.value = 0;
  loadMore();
};

const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let desktopQuery: MediaQueryList | null = null;
const onDesktopChange = () => {
  isDesktop.value = !!desktopQuery?.matches;
};
// Re-observing makes the observer report again, so a screen tall enough to
// still show the sentinel after a batch keeps filling without a scroll.
const reobserve = () => {
  if (!observer) return;
  observer.disconnect();
  if (sentinel.value) observer.observe(sentinel.value);
};
watch([visibleCount, sentinel, autoPaused], () => nextTick(reobserve));

// Changing filters / TCG / sort starts again from the first batch.
const route = useRoute();
const router = useRouter();
watch(
  [() => filters.sort.value, () => filters.tcg.value, () => filters.activeCount.value],
  () => {
    visibleCount.value = SHOP_PAGE_SIZE;
    autoBatches.value = 0;
  },
);

// ── Resume where the buyer left off ─────────────────────────────────────
// Opening a card, adding to cart and coming back to "/" used to drop the
// buyer at the top. Remember how many listings were shown + scroll + TCG tab
// for the session. The count/tab are restored here; the scroll offset is
// applied by app/router.options.ts because Nuxt's own scroll-to-top runs
// after mount and would otherwise override anything this component does.
const STATE_KEY = SHOP_STATE_KEY;
let scrollTicking = false;
let mountedAt = 0;
const saveState = () => {
  // Right after (re)mount the window sits at 0 until the router applies the
  // restored offset; a save in that window would wipe the real position.
  if (window.scrollY === 0 && Date.now() - mountedAt < 1500) return;
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ count: visibleCount.value, y: window.scrollY, tcg: filters.tcg.value }),
    );
  } catch {}
};
const onScroll = () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    saveState();
  });
};

onMounted(() => {
  mountedAt = Date.now();
  window.addEventListener("scroll", onScroll, { passive: true });
  desktopQuery = window.matchMedia("(min-width: 1024px)");
  onDesktopChange();
  desktopQuery.addEventListener("change", onDesktopChange);
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && !autoPaused.value) loadMore();
    },
    { rootMargin: "0px 0px 800px 0px" },
  );

  // Old ?page=N links: show everything up to that page, then drop the param.
  const legacyPage = Math.floor(Number(route.query.page)) || 1;
  if (legacyPage > 1) {
    visibleCount.value = legacyPage * SHOP_PAGE_SIZE;
    router.replace({ query: { ...route.query, page: undefined } });
  }

  let saved: { count?: number; y?: number; tcg?: string } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
  } catch {}
  if (saved && legacyPage <= 1) {
    if (saved.tcg) filters.tcg.value = saved.tcg;
    // Wait for the tcg watcher above to reset, then restore the count so the
    // saved scroll offset lands on the same listings.
    const count = Math.floor(Number(saved.count));
    if (count > SHOP_PAGE_SIZE) nextTick(() => (visibleCount.value = count));
  }
  nextTick(reobserve);
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  desktopQuery?.removeEventListener("change", onDesktopChange);
  observer?.disconnect();
  saveState();
});
</script>

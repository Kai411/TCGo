<template>
  <div class="lg:flex lg:gap-8 xl:gap-10">
    <!-- ── Filter sidebar (desktop only) ─────────────────────────────── -->
    <aside
      v-if="!loading"
      class="hidden lg:block w-56 xl:w-60 shrink-0 sticky top-[8.75rem] self-start max-h-[calc(100vh-10.25rem)] overflow-y-auto no-scrollbar"
    >
      <ListingFilters :filters="filters" :sidebar="true" />
    </aside>

    <!-- ── Main content ───────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0">
      <PremiumBanner />

      <!-- TCG filter pills -->
      <div
        v-if="!loading && tcgCounts.length > 1"
        class="-mx-4 px-4 mb-3 sm:mb-4 overflow-x-auto"
      >
        <div class="flex items-center gap-2 whitespace-nowrap">
          <button
            v-for="{ type, count } in tcgCounts"
            :key="type"
            @click="activeTcg = type"
            class="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ease-premium shrink-0"
            :class="
              activeTcg === type
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'bg-black/[0.04] text-ink-muted dark:bg-white/[0.06] dark:text-zinc-400 hover:text-ink dark:hover:text-white'
            "
          >
            {{ type }}
            <span class="ml-1 text-xs opacity-70 tabular-nums">{{ count }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile filter trigger (hidden on desktop where sidebar is shown) -->
      <div v-if="!loading" class="lg:hidden mb-2">
        <ListingFilters :filters="filters" />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-24">
        <div
          class="animate-spin rounded-full h-8 w-8 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <!-- Empty -->
      <div
        v-else-if="availableCards.length === 0"
        class="surface rounded-2xl py-20 text-center"
      >
        <p class="text-lg font-semibold text-ink dark:text-white">
          No cards listed yet
        </p>
        <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
          Be the first collector to list one.
        </p>
        <NuxtLink
          v-if="user"
          to="/seller/listings/new"
          class="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow ease-premium"
        >
          List your first card
        </NuxtLink>
      </div>

      <!-- Grid -->
      <template v-else>
        <div
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 xl:gap-5"
        >
          <CardTile v-for="card in pageCards" :key="card.id" :card="card" />
        </div>

        <!-- Pagination -->
        <nav
          v-if="pageCount > 1"
          class="mt-8 sm:mt-10 flex flex-col items-center gap-3"
          aria-label="Pagination"
        >
          <div class="flex items-center gap-1.5">
            <button
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
              class="pg-btn"
              aria-label="Previous page"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <template v-for="(p, i) in pageLinks" :key="i">
              <span
                v-if="p === '…'"
                class="w-9 h-9 inline-flex items-center justify-center text-sm text-ink-soft dark:text-zinc-500"
              >
                …
              </span>
              <button
                v-else
                @click="goToPage(p)"
                class="pg-btn"
                :class="p === page && 'pg-btn-active'"
                :aria-current="p === page ? 'page' : undefined"
              >
                {{ p }}
              </button>
            </template>
            <button
              :disabled="page >= pageCount"
              @click="goToPage(page + 1)"
              class="pg-btn"
              aria-label="Next page"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <p class="text-xs text-ink-muted dark:text-zinc-400 tabular-nums">
            Showing {{ rangeStart }}–{{ rangeEnd }} of {{ availableCards.length }}
          </p>
        </nav>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pg-btn {
  @apply w-9 h-9 inline-flex items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors ease-premium;
  @apply text-ink-muted hover:text-ink hover:bg-black/[0.04] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-default;
  @apply dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06];
}
.pg-btn-active {
  @apply bg-ink text-white hover:bg-ink hover:text-white;
  @apply dark:bg-white dark:text-ink dark:hover:bg-white dark:hover:text-ink;
}
</style>

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

const { user } = useAuth();
const { cards, loading } = useCards();
const filters = useListingFilters();

const activeTcg = ref<string>("All");
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
  const base = cards.value
    .filter(isAvailable)
    .filter(
      (c: Card) => activeTcg.value === "All" || tcgOf(c) === activeTcg.value,
    );
  const sorted = filters.apply(base);
  // Only the default feed gets the discovery mix; an explicit sort is exact.
  return filters.sort.value === "newest" ? discoveryOrder(sorted) : sorted;
});

// ── Pagination (60 per page — divides evenly into every grid column count) ──
const route = useRoute();
const router = useRouter();

const pageCount = computed(() =>
  Math.max(1, Math.ceil(availableCards.value.length / SHOP_PAGE_SIZE)),
);
const page = computed(() => {
  const raw = Number(route.query.page) || 1;
  return Math.min(Math.max(1, Math.floor(raw)), pageCount.value);
});
const pageCards = computed(() =>
  availableCards.value.slice(
    (page.value - 1) * SHOP_PAGE_SIZE,
    page.value * SHOP_PAGE_SIZE,
  ),
);
const rangeStart = computed(() => (page.value - 1) * SHOP_PAGE_SIZE + 1);
const rangeEnd = computed(() =>
  Math.min(page.value * SHOP_PAGE_SIZE, availableCards.value.length),
);

// 1 … 4 [5] 6 … 12 — always show first/last, current ±1.
const pageLinks = computed<(number | "…")[]>(() => {
  const n = pageCount.value;
  const cur = page.value;
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
  const set = new Set<number>([1, n, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (cur >= n - 2) [n - 1, n - 2, n - 3].forEach((p) => set.add(p));
  const pages = [...set].filter((p) => p >= 1 && p <= n).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i && p - pages[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
});

const goToPage = (p: number) => {
  const next = Math.min(Math.max(1, p), pageCount.value);
  if (next === page.value) return;
  router.push({ query: { ...route.query, page: next === 1 ? undefined : next } });
  if (import.meta.client) window.scrollTo({ top: 0, behavior: "smooth" });
};

// Changing filters / TCG / sort jumps back to page one.
watch(
  [activeTcg, () => filters.sort.value, () => filters.activeCount.value],
  () => {
    if (route.query.page) router.replace({ query: { ...route.query, page: undefined } });
  },
);

// ── Resume where the buyer left off ─────────────────────────────────────
// Opening a card, adding to cart and coming back to "/" used to drop the
// buyer on page 1 at the top. Remember page + scroll + TCG tab for the
// session. The page/tab are restored here; the scroll offset is applied by
// app/router.options.ts because Nuxt's own scroll-to-top runs after mount
// and would otherwise override anything this component does.
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
      JSON.stringify({ page: page.value, y: window.scrollY, tcg: activeTcg.value }),
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
  let saved: { page?: number; y?: number; tcg?: string } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
  } catch {}
  if (!saved || route.query.page) return;
  if (saved.tcg) activeTcg.value = saved.tcg;
  if ((saved.page ?? 1) > 1) {
    // Same path → router scrollBehavior returns false, so this swap doesn't
    // disturb the restored scroll offset.
    router.replace({ query: { ...route.query, page: saved.page } });
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  saveState();
});
watch(page, saveState);
</script>

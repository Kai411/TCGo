<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors">
    <!-- Top bar -->
    <header class="sticky top-0 z-40 glass">
      <div class="px-4 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink to="/" class="inline-flex items-center gap-1 text-sm text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span class="hidden sm:inline">Marketplace</span>
          </NuxtLink>
          <span class="text-ink-soft dark:text-zinc-600">/</span>
          <span class="font-bold text-ink dark:text-white truncate">Seller Dashboard</span>
        </div>
        <!-- Inventory and Auctions each have their own add button on-page, so
             duplicating them up here just crowded the bar. Settings takes the
             slot instead — it's the one destination with no other entry point. -->
        <div class="flex items-center gap-2 shrink-0">
          <NuxtLink
            to="/seller/settings"
            data-tour="settings"
            aria-label="Seller settings"
            class="p-2 rounded-full text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
            :class="route.path === '/seller/settings' ? '!text-pokemon-red' : ''"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="lg:flex">
      <!-- Sidebar (desktop) -->
      <aside class="hidden lg:block w-56 shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
        <nav class="p-3 space-y-0.5">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :data-tour="item.tour"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="
              isActive(item)
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            "
          >
            <component :is="item.icon" class="w-4 h-4 shrink-0" />
            {{ item.label }}
          </NuxtLink>

          <!-- Coming soon (roadmap signposts) -->
          <div v-if="soonItems.length" class="pt-3 mt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-600">Coming soon</p>
            <div
              v-for="item in soonItems"
              :key="item.label"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-soft dark:text-zinc-600 cursor-not-allowed"
            >
              <component :is="item.icon" class="w-4 h-4 shrink-0 opacity-60" />
              {{ item.label }}
              <span class="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06]">Soon</span>
            </div>
          </div>

          <!-- Learn: things *about* the product rather than parts of it, so
               they sit apart from the working destinations above. -->
          <div class="pt-3 mt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-600">Learn</p>
            <NuxtLink
              to="/landing"
              data-tour="nav-pricing"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <IconSparkle class="w-4 h-4 shrink-0" />
              Plans &amp; pricing
            </NuxtLink>
            <button
              type="button"
              @click="startTour"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <IconCompass class="w-4 h-4 shrink-0" />
              Take the tour
            </button>
          </div>
        </nav>
      </aside>

      <!-- Main -->
      <main class="flex-1 min-w-0 px-4 py-6 pb-28 lg:pb-10">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-black/[0.06] dark:border-white/[0.08] pb-[16px]">
      <!-- Four destinations and a More sheet, rather than nine in a
           horizontal scroller.
           The scroller kept every destination reachable but hid most of them:
           nothing on screen said there was more to the right, so Funds and
           Auctions were effectively invisible. Four fits a 375px screen at a
           full touch target, and the sheet shows the rest all at once instead
           of a swipe at a time.
           `More` highlights when the open page lives inside it, so the bar
           never claims you're nowhere. -->
      <div class="grid grid-cols-5 h-16">
        <NuxtLink
          v-for="item in primaryNav"
          :key="item.to"
          :to="item.to"
          :data-tour="item.tour"
          class="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide text-ink-soft dark:text-zinc-500 transition-colors"
          :class="isActive(item) ? '!text-pokemon-red' : ''"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.label }}</span>
        </NuxtLink>
        <button
          type="button"
          @click="moreOpen = true"
          :aria-expanded="moreOpen"
          aria-haspopup="menu"
          class="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide text-ink-soft dark:text-zinc-500 transition-colors"
          :class="moreIsActive ? '!text-pokemon-red' : ''"
        >
          <IconMore class="w-5 h-5" />
          <span>More</span>
        </button>
      </div>
    </nav>

    <!-- More sheet. Everything the bar doesn't have room for, shown at once
         rather than a swipe at a time. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="moreOpen"
          class="lg:hidden fixed inset-0 z-50 bg-black/40"
          @click="moreOpen = false"
        />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        leave-active-class="transition-transform duration-150 ease-in"
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="moreOpen"
          class="lg:hidden fixed bottom-0 inset-x-0 z-50 rounded-t-2xl bg-white dark:bg-[#17171c] border-t border-black/[0.06] dark:border-white/[0.08] pb-[env(safe-area-inset-bottom,16px)]"
          role="menu"
          aria-label="More seller pages"
        >
          <div class="flex justify-center pt-2.5 pb-1">
            <span class="h-1 w-9 rounded-full bg-black/15 dark:bg-white/20" />
          </div>
          <div class="grid grid-cols-4 gap-1 px-3 pb-4 pt-1">
            <NuxtLink
              v-for="item in moreNav"
              :key="item.to"
              :to="item.to"
              role="menuitem"
              class="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 text-[11px] font-semibold text-ink dark:text-zinc-200 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
              :class="isActive(item) ? '!text-pokemon-red' : ''"
            >
              <component :is="item.icon" class="w-[22px] h-[22px]" />
              <span>{{ item.label }}</span>
            </NuxtLink>
            <NuxtLink
              to="/landing"
              role="menuitem"
              class="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3.5 text-[11px] font-semibold text-ink dark:text-zinc-200 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
            >
              <IconSparkle class="w-[22px] h-[22px]" />
              <span>Pricing</span>
            </NuxtLink>
          </div>
        </div>
      </Transition>
    </Teleport>

    <SellerOnboardingTour />
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";

const route = useRoute();

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};
const IconDashboard = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z" }),
  ]);
const IconTag = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83z" }),
    h("circle", { cx: "7.5", cy: "7.5", r: "1.5", fill: "currentColor" }),
  ]);
const IconGavel = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M14 4l6 6-3 3-6-6 3-3z" }),
    h("path", { d: "M11 7l-7 7 3 3 7-7" }),
    h("path", { d: "M3 21h12" }),
  ]);
const IconBox = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
    h("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
    h("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" }),
  ]);

const IconScan = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" }),
    h("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
  ]);

const IconOrders = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" }),
    h("path", { d: "M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" }),
    h("path", { d: "m9 14 2 2 4-4" }),
  ]);

const IconWallet = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }),
    h("line", { x1: "2", y1: "10", x2: "22", y2: "10" }),
  ]);

const IconSparkle = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" }),
    h("path", { d: "M19 3v3M17.5 4.5h3M5 17v3M3.5 18.5h3" }),
  ]);

const IconCompass = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("circle", { cx: "12", cy: "12", r: "9" }),
    h("polygon", { points: "15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5" }),
  ]);

const { start: startTour } = useSellerTour();

// `tour` ids are what SellerOnboardingTour points its spotlight at.
const IconReceipt = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M4 2v20l2.5-1.5L9 22l3-1.5L15 22l2.5-1.5L20 22V2l-2.5 1.5L15 2l-3 1.5L9 2 6.5 3.5z" }),
    h("line", { x1: "8", y1: "9", x2: "16", y2: "9" }),
    h("line", { x1: "8", y1: "13", x2: "14", y2: "13" }),
  ]);

const navItems = [
  { to: "/seller", label: "Dashboard", icon: IconDashboard, exact: true, tour: "nav-dashboard" },
  { to: "/seller/pos", label: "POS", icon: IconScan, tour: "nav-pos" },
  // Sits next to POS because that's what fills it — counter takings, not
  // marketplace orders, which have their own queue below.
  { to: "/seller/sales", label: "Sales", icon: IconReceipt },
  { to: "/seller/orders", label: "Orders", icon: IconOrders, tour: "nav-orders" },
  { to: "/seller/items", label: "Inventory", icon: IconBox, tour: "nav-items" },
  { to: "/seller/listings", label: "Listings", icon: IconTag, tour: "nav-listings" },
  { to: "/seller/auctions", label: "Auctions", icon: IconGavel, tour: "nav-auctions" },
  { to: "/seller/funds", label: "Funds", icon: IconWallet, tour: "nav-funds" },
  // Bulk add is reached from inside Inventory rather than the top-level nav —
  // it's an occasional import, not a daily destination.
];

const soonItems: { label: string; icon: any }[] = [];

const isActive = (item: { to: string; exact?: boolean }) => {
  if (item.exact) return route.path === item.to;
  return route.path === item.to || route.path.startsWith(item.to + "/");
};

// ── Mobile: four destinations plus a sheet ────────────────────────────
//
// The first four are the daily ones — the till, what it earned, what's owed
// to the buyer, and what's on the shelf. The rest are things a seller opens
// deliberately rather than reaches for, so they live behind More.
//
// The desktop sidebar keeps showing all of navItems; this split is only for
// the bar at the bottom of a phone.
const PRIMARY = ["/seller", "/seller/pos", "/seller/orders", "/seller/items"];

const primaryNav = computed(() =>
  PRIMARY.map((to) => navItems.find((i) => i.to === to)!).filter(Boolean),
);
const moreNav = computed(() => navItems.filter((i) => !PRIMARY.includes(i.to)));

const moreOpen = ref(false);
// The bar must never read as "you are nowhere": when the open page lives in
// the sheet, More carries the active state on its behalf.
const moreIsActive = computed(() => moreNav.value.some((i) => isActive(i)));

// Any navigation closes it, including the browser's back button.
watch(
  () => route.fullPath,
  () => (moreOpen.value = false),
);

const IconMore = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("circle", { cx: "5", cy: "12", r: "1" }),
    h("circle", { cx: "12", cy: "12", r: "1" }),
    h("circle", { cx: "19", cy: "12", r: "1" }),
  ]);
</script>

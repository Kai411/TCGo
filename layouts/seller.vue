<template>
  <!-- Calm UI shell (same tokens as Mint Condition, scoped by `.mc`). The
       page area resets to the marketplace's 16px base so seller pages that
       haven't moved onto mc-* classes render exactly as before. -->
  <div class="mc sl-shell">
    <!-- Top bar -->
    <header class="sl-topbar">
      <div class="flex items-center gap-2 min-w-0">
        <NuxtLink to="/" class="mc-btn mc-btn-ghost mc-btn-sm sl-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          <span class="hidden sm:inline">Marketplace</span>
        </NuxtLink>
        <span class="sl-crumb-sep" aria-hidden="true">/</span>
        <span class="sl-topbar-title truncate">Seller dashboard</span>
      </div>
      <!-- Inventory and Auctions each have their own add button on-page, so
           duplicating them up here just crowded the bar. Settings takes the
           slot instead — it's the one destination with no other entry point. -->
      <div class="flex items-center gap-1 shrink-0">
        <ChatNavButton />
        <NotificationBell />
        <NuxtLink
          to="/seller/settings"
          data-tour="settings"
          aria-label="Seller settings"
          class="mc-btn mc-btn-ghost mc-btn-icon rounded-full"
          :aria-current="route.path === '/seller/settings' ? 'page' : undefined"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NuxtLink>
      </div>
    </header>

    <div class="lg:flex">
      <!-- Sidebar (desktop) -->
      <aside class="sl-side hidden lg:flex">
        <nav class="sl-nav" aria-label="Seller">
          <template v-for="group in navGroups" :key="group.label">
            <p class="mc-eyebrow sl-nav-group">{{ group.label }}</p>
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :data-tour="item.tour"
              class="sl-nav-link"
              :aria-current="isActive(item) ? 'page' : undefined"
            >
              <component :is="item.icon" class="sl-nav-icon" />
              <span class="truncate">{{ item.label }}</span>
            </NuxtLink>
          </template>

          <!-- Coming soon (roadmap signposts) -->
          <template v-if="soonItems.length">
            <p class="mc-eyebrow sl-nav-group">Coming soon</p>
            <div
              v-for="item in soonItems"
              :key="item.label"
              class="sl-nav-link is-soon"
              aria-disabled="true"
            >
              <component :is="item.icon" class="sl-nav-icon" />
              <span class="truncate">{{ item.label }}</span>
              <span class="mc-tag ml-auto">Soon</span>
            </div>
          </template>

          <!-- Learn: things *about* the product rather than parts of it, so
               they sit apart from the working destinations above. -->
          <p class="mc-eyebrow sl-nav-group">Learn</p>
          <NuxtLink to="/landing" data-tour="nav-pricing" class="sl-nav-link">
            <IconSparkle class="sl-nav-icon" />
            Plans &amp; pricing
          </NuxtLink>
          <button type="button" class="sl-nav-link w-full" @click="startTour">
            <IconCompass class="sl-nav-icon" />
            Take the tour
          </button>
        </nav>
      </aside>

      <!-- Main -->
      <main class="sl-main flex-1 min-w-0 px-4 py-6 pb-28 lg:pb-10">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <nav class="sl-tabbar lg:hidden" aria-label="Seller">
      <!-- Three destinations and two sheets, rather than nine in a horizontal
           scroller. The scroller kept everything reachable but signalled
           nothing: with no hint there was more to the right, Funds and
           Auctions were effectively invisible.
           Inventory and More both open a sheet, because each is a place with
           several rooms rather than a single page — grouping them keeps every
           bar item at a full touch target on a 375px screen.
           A sheet button highlights when the open page lives inside it, so
           the bar never claims you're nowhere. -->
      <div class="grid grid-cols-5 h-16">
        <NuxtLink
          v-for="item in primaryNav"
          :key="item.to"
          :to="item.to"
          :data-tour="item.tour"
          class="sl-tab"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.label }}</span>
        </NuxtLink>
        <button
          v-for="(sheet, key) in SHEETS"
          :key="key"
          type="button"
          @click="openSheet = key"
          :aria-expanded="openSheet === key"
          aria-haspopup="menu"
          class="sl-tab"
          :class="{ 'is-current': sheetIsActive(key) }"
        >
          <component :is="sheet.icon" class="w-5 h-5" />
          <span>{{ sheet.label }}</span>
        </button>
      </div>
    </nav>

    <!-- One sheet, whichever button opened it. Two near-identical panels
         would drift apart the first time either was touched. Teleported out
         of the shell, so it carries its own `.mc` for the tokens. -->
    <Teleport to="body">
      <div class="mc sl-sheet-root">
        <Transition name="sl-scrim">
          <div
            v-if="openSheet"
            class="lg:hidden fixed inset-0 z-50 sl-scrim"
            @click="openSheet = null"
          />
        </Transition>
        <Transition name="sl-sheet">
          <div
            v-if="openSheet"
            class="sl-sheet lg:hidden"
            role="menu"
            :aria-label="SHEETS[openSheet].label"
          >
            <div class="flex justify-center pt-2.5 pb-1">
              <span class="sl-grabber" />
            </div>
            <p class="mc-eyebrow px-4 pb-1">{{ SHEETS[openSheet].label }}</p>
            <div class="grid grid-cols-3 gap-1 px-3 pb-4 pt-1">
              <NuxtLink
                v-for="item in SHEETS[openSheet].items"
                :key="item.to"
                :to="item.to"
                :data-tour="item.tour"
                role="menuitem"
                class="sl-sheet-item"
                :aria-current="isActive(item) ? 'page' : undefined"
              >
                <component :is="item.icon" class="w-[22px] h-[22px]" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </div>
          </div>
        </Transition>
      </div>
    </Teleport>

    <SellerOnboardingTour />
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";
import "~/assets/css/mint-condition.css";

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
// A gavel tilted over its sound block (head on the right, striking end over the block): a barrel head with end caps, so it
// can't be mistaken for an axe or hammer.
const IconGavel = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [h("g", { transform: "translate(21 0.5) scale(-1 1) rotate(-45 10 10)" }, [
      h("path", { d: "M7 4.5h6M7 7.5h6" }),
      h("rect", { x: "4", y: "2.5", width: "3", height: "7", rx: "1" }),
      h("rect", { x: "13", y: "2.5", width: "3", height: "7", rx: "1" }),
      h("path", { d: "M10 7.5v10" }),
    ]),
    h("path", { d: "M12.5 21h8" }),
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

const IconMore = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("circle", { cx: "5", cy: "12", r: "1" }),
    h("circle", { cx: "12", cy: "12", r: "1" }),
    h("circle", { cx: "19", cy: "12", r: "1" }),
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

// The desktop sidebar groups the flat list by job, the way Mint Condition's
// does. Same items and order as navItems, so the tour targets don't move.
const NAV_GROUPS: { label: string; paths: string[] }[] = [
  { label: "Sell", paths: ["/seller", "/seller/pos", "/seller/sales", "/seller/orders"] },
  { label: "Stock", paths: ["/seller/items", "/seller/listings", "/seller/auctions"] },
  { label: "Money", paths: ["/seller/funds"] },
];
const navGroups = NAV_GROUPS.map((g) => ({
  label: g.label,
  items: g.paths.map((to) => navItems.find((i) => i.to === to)!).filter(Boolean),
}));

const isActive = (item: { to: string; exact?: boolean }) => {
  if (item.exact) return route.path === item.to;
  return route.path === item.to || route.path.startsWith(item.to + "/");
};

// ── Mobile: three destinations plus two sheets ────────────────────────
//
// The three are the ones opened without thinking — the till, what's owed to
// buyers, and the dashboard they land on. Everything else groups into a
// sheet, because each group is a place with several rooms rather than a
// single page:
//
//   Inventory  what you hold, and the two ways it goes on sale
//   More       money and reference
//
// The desktop sidebar still lists everything flat; this split is only for the
// bar at the bottom of a phone.
const PRIMARY = ["/seller", "/seller/pos", "/seller/orders"];

const primaryNav = computed(() =>
  PRIMARY.map((to) => navItems.find((i) => i.to === to)!).filter(Boolean),
);

type SheetKey = "inventory" | "more";

const SHEETS: Record<
  SheetKey,
  { label: string; icon: any; items: { to: string; label: string; icon: any; tour?: string }[] }
> = {
  inventory: {
    label: "Inventory",
    icon: IconBox,
    items: [
      // Spelled out rather than "Inventory" twice: the sheet is already
      // titled Inventory, so a row repeating it says nothing about what it
      // does. This is the one that manages stock.
      { to: "/seller/items", label: "Manage inventory", icon: IconBox, tour: "nav-items" },
      { to: "/seller/listings", label: "Listings", icon: IconTag, tour: "nav-listings" },
      { to: "/seller/auctions", label: "Auctions", icon: IconGavel, tour: "nav-auctions" },
    ],
  },
  more: {
    label: "More",
    icon: IconMore,
    items: [
      { to: "/seller/sales", label: "Sales", icon: IconReceipt },
      { to: "/seller/funds", label: "Funds", icon: IconWallet, tour: "nav-funds" },
      { to: "/landing", label: "Pricing", icon: IconSparkle },
    ],
  },
};

const openSheet = ref<SheetKey | null>(null);

// The bar must never read as "you are nowhere": when the open page lives in a
// sheet, that sheet's button carries the active state on its behalf.
const sheetIsActive = (key: SheetKey) => SHEETS[key].items.some((i) => isActive(i));

// Any navigation closes it, including the browser's back button.
watch(
  () => route.fullPath,
  () => (openSheet.value = null),
);

</script>

<style>
.sl-shell {
  min-height: 100vh;
  min-height: 100dvh;
}
/* Every seller page sits in one calm column. */
.sl-page {
  max-width: 1120px;
  margin: 0 auto;
  color: var(--ink);
}
@media (min-width: 721px) {
  .sl-page {
    padding: 4px 16px 0;
  }
}
.sl-page--narrow {
  max-width: 760px;
}

/* The app-wide helper classes, re-pointed at the calm tokens inside the
   seller area, so shared pieces (order cards, inventory rows, forms) match
   the pages around them without a second copy of each component. */
.sl-main .surface {
  background: var(--surface);
  border-color: var(--line);
  box-shadow: none;
}
.sl-main .eyebrow {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
}
.sl-main .chip {
  border-radius: 999px;
  font-weight: 550;
}
.sl-main .tcgo-input {
  border-radius: var(--radius-s);
  border-color: var(--line-strong);
  background: var(--surface);
  color: var(--ink);
}
.sl-main .tcgo-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus);
  --tw-ring-shadow: 0 0 #0000;
}
.sl-main .tcgo-input::placeholder {
  color: var(--ink-3);
}
@media (pointer: coarse) {
  .sl-main input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  .sl-main textarea,
  .sl-main select {
    font-size: 16px !important;
  }
}
@media (max-width: 1023.98px) {
  .sl-main .panel + .panel {
    border-top-color: var(--line) !important;
  }
}

.sl-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 12px 0 8px;
  background: color-mix(in oklch, var(--bg) 88%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  user-select: none;
}
.sl-back {
  padding-left: 6px;
}
.sl-crumb-sep {
  color: var(--line-strong);
}
.sl-topbar-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.sl-topbar .mc-btn-icon[aria-current="page"] {
  color: var(--ink);
  background: var(--surface-3);
}

.sl-side {
  width: 248px;
  flex-shrink: 0;
  flex-direction: column;
  position: sticky;
  top: 52px;
  align-self: flex-start;
  height: calc(100dvh - 52px);
  border-right: 1px solid var(--line);
  user-select: none;
}
.sl-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 16px;
}
.sl-nav-group {
  padding: 16px 10px 6px;
}
.sl-nav-group:first-child {
  padding-top: 12px;
}
.sl-nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink-2);
  text-align: left;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}
.sl-nav-link[aria-current="page"] {
  background: var(--surface-3);
  color: var(--ink);
}
.sl-nav-link.is-soon {
  color: var(--ink-3);
  cursor: default;
}
.sl-nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
@media (hover: hover) and (pointer: fine) {
  .sl-nav-link:not(.is-soon):not([aria-current="page"]):hover {
    background: var(--surface-2);
    color: var(--ink);
  }
}

/* Phone tab bar */
.sl-tabbar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 40;
  padding-bottom: 16px;
  background: color-mix(in oklch, var(--bg) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--line);
}
.sl-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 550;
  color: var(--ink-3);
  transition:
    color 120ms ease,
    transform 140ms var(--ease-out);
}
.sl-tab:active {
  transform: scale(0.94);
}
.sl-tab[aria-current="page"],
.sl-tab.is-current {
  color: var(--accent);
}

/* Bottom sheet */
.sl-scrim {
  background: var(--scrim);
}
.sl-sheet {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 50;
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  background: var(--surface);
  border-top: 1px solid var(--line);
  box-shadow: var(--shadow-3);
  padding-bottom: env(safe-area-inset-bottom, 16px);
}
.mc.sl-sheet-root {
  /* Only the tokens are wanted here, not the shell's paint. */
  background: none;
}
.sl-grabber {
  height: 4px;
  width: 36px;
  border-radius: 999px;
  background: var(--line-strong);
}
.sl-sheet-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 4px;
  border-radius: var(--radius);
  text-align: center;
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.25;
  color: var(--ink);
  transition:
    background-color 120ms ease,
    transform 140ms var(--ease-out);
}
.sl-sheet-item:active {
  background: var(--surface-2);
  transform: scale(0.97);
}
.sl-sheet-item[aria-current="page"] {
  color: var(--accent);
}
.sl-scrim-enter-active {
  transition: opacity 200ms ease;
}
.sl-scrim-leave-active {
  transition: opacity 150ms ease;
}
.sl-scrim-enter-from,
.sl-scrim-leave-to {
  opacity: 0;
}
.sl-sheet-enter-active {
  transition: transform 380ms var(--ease-drawer);
}
.sl-sheet-leave-active {
  transition: transform 220ms ease;
}
.sl-sheet-enter-from,
.sl-sheet-leave-to {
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .sl-tab:active,
  .sl-sheet-item:active {
    transform: none;
  }
}
</style>

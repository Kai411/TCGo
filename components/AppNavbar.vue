<template>
  <!-- Top bar (sticky, glassy) -->
  <nav
    ref="navEl"
    class="sticky top-0 z-40 glass shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.6)]"
  >
    <div
      class="container mx-auto px-4 h-16 lg:h-[72px] lg:pt-3 flex items-center justify-between gap-4"
    >
      <!-- Logo (matches LandingNavbar: square sprite cropped to wordmark slice).
           Links to /landing (marketing) — user prefers this over the shop
           home since the marketing surface is where new visitors land.
           Beta tag sits beside the wordmark, baseline-aligned to its bottom. -->
      <div class="flex items-end h-full shrink-0 gap-1.5">
        <NuxtLink to="/landing" class="flex items-center h-full">
          <img
            src="~/assets/images/tcgo_sprites.png"
            alt="TCGo"
            class="h-full w-[110px] object-cover block dark:hidden"
          />
          <img
            src="/tcgo_sprites_white.png"
            alt="TCGo"
            class="h-full w-[110px] object-cover hidden dark:block"
          />
        </NuxtLink>
      </div>

      <!-- Desktop search — stretched across the centre of the top bar
           (TCGplayer-style). Typing here seeds the full search modal, which
           owns results/history, so we don't duplicate that logic. -->
      <form
        class="hidden lg:flex flex-1 min-w-0 mx-4 items-center h-11 rounded-full border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-zinc-900 focus-within:border-ink dark:focus-within:border-white focus-within:ring-2 focus-within:ring-ink/10 dark:focus-within:ring-white/10 transition-[border-color,box-shadow] duration-200 ease-premium overflow-hidden"
        role="search"
        @submit.prevent="openSearch"
      >
        <input
          v-model="navQuery"
          type="search"
          placeholder="Search cards, sets, sellers…"
          aria-label="Search"
          autocomplete="off"
          class="flex-1 min-w-0 h-full px-5 bg-transparent text-sm text-ink dark:text-white placeholder:text-ink-soft dark:placeholder:text-zinc-500 outline-none [&::-webkit-search-cancel-button]:appearance-none"
          @focus="openSearch"
        />
        <button
          type="submit"
          aria-label="Search"
          class="h-full px-4 border-l border-black/[0.08] dark:border-white/[0.08] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </form>

      <!-- Right cluster -->
      <div class="flex items-center gap-1.5 lg:gap-2 shrink-0">
        <!-- Desktop sell CTAs → enter the inventory system -->
        <div v-if="user" class="hidden lg:flex items-center gap-2 ml-1">
          <!-- Single glowing Sell CTA; the menu asks card vs auction. -->
          <div class="relative" @click.stop>
            <button
              @click="desktopSellOpen = !desktopSellOpen"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white shadow-glow hover:shadow-[0_0_24px_rgba(220,38,38,0.65)] hover:brightness-110 transition-[box-shadow,filter] duration-200 ease-premium"
              aria-haspopup="true"
              :aria-expanded="desktopSellOpen"
            >
              <svg
                class="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Sell
              <svg
                class="w-3 h-3 -mr-0.5 transition-transform duration-200"
                :class="desktopSellOpen ? 'rotate-180' : ''"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <Transition
              enter-active-class="transition duration-150"
              enter-from-class="opacity-0 -translate-y-1"
              leave-active-class="transition duration-100"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="desktopSellOpen"
                class="absolute right-0 top-full mt-2 w-52 surface rounded-xl overflow-hidden py-1.5 z-50"
              >
                <NuxtLink
                  to="/seller/listings/new"
                  @click="desktopSellOpen = false"
                  class="block px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  Sell a card
                </NuxtLink>
                <NuxtLink
                  to="/seller/auctions/new"
                  @click="desktopSellOpen = false"
                  class="block px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  Start an auction
                </NuxtLink>
              </div>
            </Transition>
          </div>
        </div>


        <!-- The same bell as the seller dashboard: buyer and seller events
             in one feed, so neither role has to go looking for the other. -->
        <ChatNavButton v-if="user" />
        <NotificationBell v-if="user" />

        <!-- Cart — opens the slide-in drawer so shoppers keep their place
             instead of jumping to /cart. -->
        <button
          @click="cartOpen = true"
          aria-label="Cart"
          data-cart-target
          class="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-ink dark:text-white transition-colors"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path
              d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
            />
          </svg>
          <span
            v-if="cartCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
          >
            {{ cartCount > 99 ? "99+" : cartCount }}
          </span>
        </button>

        <!-- Auth: avatar/sign-in shown on desktop only; mobile gets it via
             the bottom-nav Account tab. Sell lives in the bottom nav too. -->
        <div
          v-if="authLoading"
          class="hidden lg:block w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 animate-pulse"
        />
        <!-- The avatar opens the Account page on desktop too: orders,
             selling, addresses, notifications and the customer code live
             there, with your public profile one click further. -->
        <NuxtLink
          v-else-if="user"
          to="/account"
          aria-label="Account"
          class="hidden lg:flex ml-1 items-center hover:opacity-80 transition-opacity"
        >
          <img
            :src="profile?.photoURL || user.photoURL || ''"
            :alt="profile?.customName || user.displayName || 'User'"
            class="w-9 h-9 rounded-full ring-2 ring-white dark:ring-zinc-900 object-cover"
          />
        </NuxtLink>
        <button
          v-else
          @click="goToLogin"
          class="hidden lg:inline-flex px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
        >
          Sign In
        </button>
      </div>
    </div>

    <!-- Mobile search row. A field rather than an icon: it reads as "search
         here" at a glance. Tapping it opens the same search popup, which owns
         results and history. Inside the nav so --app-nav-h grows with it.
         Not on the Account pages (settings screens, not places to shop) or
         Collection, which has its own search bar right beneath the nav. -->
    <div v-if="showMobileSearch" class="lg:hidden container mx-auto px-4 pb-3">
      <button
        type="button"
        @click="openSearch"
        aria-label="Search cards, auctions, sets, sellers"
        class="w-full h-10 flex items-center gap-2 px-4 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-left text-sm text-ink-soft dark:text-zinc-500 transition-colors active:bg-black/[0.08] dark:active:bg-white/[0.12]"
      >
        <svg
          class="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span class="truncate">Search cards, auctions, sets, sellers...</span>
      </button>
    </div>

    <!-- Second row (desktop): section nav — Shop / Auctions / Collection /
         Orders. Dark strip under the glassy top bar, TCGplayer-style. -->
    <div class="hidden lg:block">
      <div
        ref="tabsEl"
        class="container mx-auto px-4 h-11 flex items-center gap-1 relative"
      >
        <NuxtLink
          v-for="link in desktopLinks"
          :key="link.to"
          :to="link.to"
          :ref="(el) => setTabRef(link.to, el)"
          class="relative h-full inline-flex items-center px-4 text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors duration-200 ease-premium"
          active-class="!text-ink dark:!text-white"
        >
          {{ link.label }}
        </NuxtLink>
        <!-- Single red underline that slides between tabs. Hidden until the
             first measurement so it never flashes at x=0. -->
        <span
          aria-hidden="true"
          class="absolute left-0 bottom-0 h-0.5 rounded-full bg-pokemon-red transition-[transform,width,opacity] duration-300 ease-premium origin-left"
          :style="indicatorStyle"
        />
      </div>
    </div>
  </nav>

  <!-- Mobile bottom tab bar: Shop / Auctions / Sell / Collection / Account.
       Sell sits in the middle as the one raised action; Orders moved into the
       Account page. Pads for the iPhone home bar, keeping the old 16px as the floor. -->
  <nav
    class="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-black/[0.06] dark:border-white/[0.08] pb-[max(16px,env(safe-area-inset-bottom))]"
    aria-label="Main"
  >
    <div class="grid grid-cols-5 h-16 px-1">
      <template v-for="tab in mobileTabs" :key="tab.label">
        <button
          v-if="tab.sell"
          type="button"
          @click.stop="onSellTap"
          class="tab-press flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold tracking-wide text-ink dark:text-white"
          aria-haspopup="dialog"
          :aria-expanded="sellSheetOpen"
        >
          <span
            class="-mt-5 w-12 h-12 rounded-full bg-pokemon-red text-white shadow-glow ring-4 ring-canvas dark:ring-canvas-inverse flex items-center justify-center"
          >
            <component :is="tab.icon" class="w-6 h-6" />
          </span>
          <span>{{ tab.label }}</span>
        </button>
        <NuxtLink
          v-else
          :to="tab.to!"
          class="tab-press relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold tracking-wide text-ink-soft dark:text-zinc-500"
          :class="isTabActive(tab.to!) ? '!text-pokemon-red' : ''"
          :aria-current="isTabActive(tab.to!) ? 'page' : undefined"
        >
          <span class="relative">
            <component :is="tab.icon" class="w-6 h-6" />
            <span
              v-if="tab.dot"
              class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pokemon-red ring-2 ring-white dark:ring-zinc-900"
              aria-label="Unread seller notifications"
            />
          </span>
          <span>{{ tab.label }}</span>
        </NuxtLink>
      </template>
    </div>
  </nav>

  <!-- Sell sheet: the bottom-nav Sell button asks card or auction, like the
       desktop Sell menu, and keeps the dashboard one tap away. -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-out"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sellSheetOpen"
        class="lg:hidden fixed inset-0 z-[70] bg-black/40"
        @click="sellSheetOpen = false"
      />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      enter-from-class="translate-y-full"
      leave-active-class="transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="sellSheetOpen"
        role="dialog"
        aria-modal="true"
        aria-label="Sell"
        class="lg:hidden fixed inset-x-0 bottom-0 z-[71] surface rounded-t-3xl border-t border-black/[0.06] dark:border-white/[0.08] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15" aria-hidden="true" />
        <p class="px-2 pb-2 text-base font-bold text-ink dark:text-white">What are you selling?</p>
        <NuxtLink
          v-for="item in sellItems"
          :key="item.to"
          :to="item.to"
          class="tab-press flex items-center gap-3 px-2 min-h-[56px] rounded-xl active:bg-black/[0.04] dark:active:bg-white/[0.06]"
        >
          <span class="w-10 h-10 shrink-0 rounded-xl bg-pokemon-red/[0.08] text-pokemon-red flex items-center justify-center">
            <component :is="item.icon" class="w-5 h-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
              {{ item.label }}
              <span
                v-if="item.dot"
                class="w-2 h-2 rounded-full bg-pokemon-red"
                aria-label="Unread seller notifications"
              />
            </span>
            <span class="block text-xs text-ink-soft dark:text-zinc-500">{{ item.hint }}</span>
          </span>
        </NuxtLink>
      </div>
    </Transition>
  </Teleport>

  <SearchModal v-model="searchOpen" :initial-query="navQuery" />
  <CartDrawer v-model="cartOpen" />
</template>

<script setup lang="ts">
import { h, computed } from "vue";

const {user, authLoading} = useAuth();
const { goToLogin } = useSignInGate();
const { profile } = useMyProfile();
const { isAdmin } = useAdmin();
const { cartCount } = useCart();

const { premiumEnabled } = useFeatureFlags();

const desktopLinks = computed(() => {
  const links = [
    { to: "/", label: "Shop" },
    { to: "/auctions", label: "Auctions" },
  ];
  if (premiumEnabled) links.push({ to: "/membership", label: "Pricing" });
  if (user.value) {
    links.push({ to: "/collection", label: "Collection" });
    links.push({ to: "/activity", label: "Orders" });
    links.push({ to: "/seller", label: "Seller Dashboard" });
  }
  return links;
});

const stroke = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};
const IconShop = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 9l1.5-5h15L21 9" }),
    h("path", { d: "M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" }),
    h("path", { d: "M9 13h6" }),
  ]);
const IconGavel = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M14 4l6 6-3 3-6-6 3-3z" }),
    h("path", { d: "M11 7l-7 7 3 3 7-7" }),
    h("path", { d: "M3 21h12" }),
  ]);
const IconPlus = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke, "stroke-width": "2.5" }, [
    h("path", { d: "M12 5v14M5 12h14" }),
  ]);
const IconCollection = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }),
    h("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }),
    h("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }),
    h("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" }),
  ]);

const IconStore = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M3 9l1.5-5h15L21 9" }),
    h("path", { d: "M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" }),
    h("path", { d: "M9 13h6" }),
  ]);
// A person in a circle: the account, distinct from Collection's grid.
const IconAccount = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("circle", { cx: "12", cy: "12", r: "9.5" }),
    h("circle", { cx: "12", cy: "10", r: "3" }),
    h("path", { d: "M6.2 18.4a6.5 6.5 0 0 1 11.6 0" }),
  ]);

interface MobileTab {
  label: string;
  icon: any;
  to?: string;
  sell?: boolean;
  dot?: boolean;
}

// Collection is a public catalogue browser, and Account works signed out
// too (sign in plus the policy pages that used to live in the footer), so
// the bar is the same five tabs for everyone.
const mobileTabs = computed<MobileTab[]>(() => [
  { to: "/", label: "Shop", icon: IconShop },
  { to: "/auctions", label: "Auctions", icon: IconGavel },
  { label: "Sell", icon: IconPlus, sell: true },
  { to: "/collection", label: "Collection", icon: IconCollection },
  // The seller dot used to ride on the top-bar Sell menu; the dashboard
  // link now lives on the Account page, so the dot follows it there.
  { to: "/account", label: "Account", icon: IconAccount, dot: sellerHasUnread.value },
]);

// Exact match for Shop, prefix match for the rest, so /auctions/123 keeps
// Auctions lit. The account page's own sub-pages (orders, settings, your
// profile) count as Account, since that is where they're reached from now.
const isTabActive = (to: string) => {
  const path = route.path;
  if (to === "/") return path === "/";
  if (to === "/account") {
    return (
      path.startsWith("/account") ||
      path === "/activity" ||
      path === "/profile" ||
      (!!user.value && path === `/profile/${user.value.uid}`)
    );
  }
  return path === to || path.startsWith(to + "/");
};

const sellSheetOpen = ref(false);
const onSellTap = () => {
  if (!user.value) {
    goToLogin();
    return;
  }
  sellSheetOpen.value = !sellSheetOpen.value;
};
const sellItems = computed(() => [
  { to: "/seller/listings/new", label: "Sell a card", hint: "List it at a fixed price", icon: IconPlus, dot: false },
  { to: "/seller/auctions/new", label: "Start an auction", hint: "Let buyers bid on it", icon: IconGavel, dot: false },
  { to: "/seller", label: "Seller Dashboard", hint: "Listings, orders to ship and payouts", icon: IconStore, dot: sellerHasUnread.value },
]);

// ── Our height, published for anything that sticks beneath us ───────────
//
// Pages used to hardcode `top-16 lg:top-[116px]`. Those numbers were correct
// — 64px for the single mobile row, 72 + 44 for the desktop rows — but only
// until the nav changes, and it has changed twice recently. A page that
// guesses wrong doesn't fail loudly; it drifts.
//
// ResizeObserver rather than a media query, because the height changes for
// reasons a breakpoint doesn't describe: the tab strip is desktop-only, and
// anything conditional in the bar moves it too.
const navEl = ref<HTMLElement | null>(null);
let navObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!navEl.value || typeof ResizeObserver === "undefined") return;
  const publish = () => {
    const h = navEl.value?.offsetHeight ?? 0;
    // Zero means it is mid-teardown; keeping the last good value beats
    // collapsing every dependent sticky to the top of the screen.
    if (h > 0) document.documentElement.style.setProperty("--app-nav-h", `${h}px`);
  };
  publish();
  navObserver = new ResizeObserver(publish);
  navObserver.observe(navEl.value);
});

onBeforeUnmount(() => {
  navObserver?.disconnect();
  navObserver = null;
});

// ── Sliding tab indicator (row 2) ───────────────────────────────────────
// One underline that slides to the active link instead of blinking across.
const {
  containerEl: tabsEl,
  setTabRef,
  indicatorStyle,
  measure: measureTab,
} = useTabIndicator({ pad: 16 }); // pad matches px-4 on the link

const routeForIndicator = useRoute();
const activeTabKey = computed(() => {
  // Longest matching prefix wins, so /auctions/123 highlights Auctions.
  const path = routeForIndicator.path;
  let best: string | null = null;
  for (const { to } of desktopLinks.value) {
    const hit =
      to === "/" ? path === "/" : path === to || path.startsWith(to + "/");
    if (hit && (best === null || to.length > best.length)) best = to;
  }
  return best;
});
onMounted(() => nextTick(() => measureTab(activeTabKey.value)));
watch(
  () => [activeTabKey.value, desktopLinks.value.length],
  () => nextTick(() => measureTab(activeTabKey.value)),
);

const desktopSellOpen = ref(false);
const searchOpen = ref(false);
const cartOpen = ref(false);

// Inline desktop search field. Focusing or submitting hands off to the
// modal, seeded with whatever was typed; the field clears once handed off.
const navQuery = ref("");
const openSearch = () => {
  searchOpen.value = true;
};
watch(searchOpen, (open) => {
  if (!open) navQuery.value = "";
});

// Close the sell menu when user clicks anywhere else.
const handleDocClick = () => {
  desktopSellOpen.value = false;
};
const handleEsc = (e: KeyboardEvent) => {
  if (e.key === "Escape") sellSheetOpen.value = false;
};
onMounted(() => {
  document.addEventListener("click", handleDocClick);
  document.addEventListener("keydown", handleEsc);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocClick);
  document.removeEventListener("keydown", handleEsc);
});

// Close transient menus on route change.
const route = useRoute();
const showMobileSearch = computed(
  () => !["/account", "/collection"].some((p) => route.path === p || route.path.startsWith(p + "/")),
);
watch(
  () => route.fullPath,
  () => {
    sellSheetOpen.value = false;
    desktopSellOpen.value = false;
    searchOpen.value = false;
    cartOpen.value = false;
  },
);

// ── Seller notification dot ───────────────────────────────────────────
// The bell itself lives in the seller layout; out here only the dot matters,
// so this listens for the count and nothing else.
const { hasUnreadSeller: sellerHasUnread, listen: listenNotifications } = useNotifications();
watch(() => user.value?.uid, () => listenNotifications(), { immediate: true });
</script>

<style scoped>
/* Tabs switch instantly, like a native tab bar; the only motion is a slight
   scale while pressed, which never sticks after a tap. */
.tab-press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.tab-press:active {
  transform: scale(0.95);
}
</style>

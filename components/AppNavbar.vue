<template>
  <!-- Top bar (sticky, glassy) -->
  <nav
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

        <!-- Search button — mobile only; desktop has the inline field. -->
        <button
          @click="searchOpen = true"
          aria-label="Search"
          class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-ink dark:text-white transition-colors"
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

        <div v-if="user" class="lg:hidden relative" @click.stop>
          <button
            @click="sellMenuOpen = !sellMenuOpen"
            class="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white shadow-glow"
            aria-haspopup="true"
            :aria-expanded="sellMenuOpen"
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
              class="w-3 h-3 -mr-0.5"
              :class="sellMenuOpen ? 'rotate-180' : ''"
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
              v-if="sellMenuOpen"
              class="absolute right-0 top-full mt-2 w-48 surface rounded-xl overflow-hidden py-1.5 z-50"
            >
              <NuxtLink
                to="/seller/listings/new"
                @click="sellMenuOpen = false"
                class="block px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                Sell a card
              </NuxtLink>
              <NuxtLink
                to="/seller/auctions/new"
                @click="sellMenuOpen = false"
                class="block px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                Start an auction
              </NuxtLink>
              <div
                class="my-1 border-t border-black/[0.06] dark:border-white/[0.08]"
              />
              <NuxtLink
                to="/seller"
                @click="sellMenuOpen = false"
                class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                Seller Dashboard
                <!-- The dot follows the seller into the marketplace: a new
                     order is worth knowing about from wherever they are, not
                     only once they've already opened the dashboard. -->
                <span
                  v-if="sellerHasUnread"
                  class="w-2 h-2 rounded-full bg-pokemon-red shrink-0"
                  aria-label="Unread seller notifications"
                />
              </NuxtLink>
            </div>
          </Transition>
        </div>

        <!-- Auth: avatar/sign-in shown on desktop only; mobile gets it via
             the bottom-nav Profile tab. -->
        <div
          v-if="authLoading"
          class="hidden lg:block w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 animate-pulse"
        />
        <NuxtLink
          v-else-if="user"
          :to="`/profile/${user.uid}`"
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

  <!-- Mobile bottom tab bar (3 tabs: Shop / Auctions / Profile).
       Sell + Search both moved to the top bar. -->
  <nav
    class="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-black/[0.06] dark:border-white/[0.08] pb-[16px]"
  >
    <div
      class="grid h-16 px-1"
      :style="{
        gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))`,
      }"
    >
      <NuxtLink
        v-for="tab in mobileTabs"
        :key="tab.to"
        :to="tab.to"
        class="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide text-ink-soft dark:text-zinc-500 transition-colors duration-200 ease-premium"
        active-class="!text-pokemon-red [&_.tab-dot]:!opacity-100"
      >
        <component :is="tab.icon" class="w-6 h-6" />
        <span>{{ tab.label }}</span>
        <span
          class="tab-dot absolute -bottom-0.5 w-1 h-1 rounded-full bg-pokemon-red opacity-0 transition-opacity duration-200 ease-premium"
        />
      </NuxtLink>
    </div>
  </nav>

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
const IconUser = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("circle", { cx: "12", cy: "8", r: "4" }),
    h("path", { d: "M4 21a8 8 0 0 1 16 0" }),
  ]);
const IconActivity = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" }),
  ]);
const IconCollection = () =>
  h("svg", { viewBox: "0 0 24 24", ...stroke }, [
    h("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }),
    h("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }),
    h("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }),
    h("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" }),
  ]);

const mobileTabs = computed(() => {
  const tabs: {
    to: string;
    label: string;
    icon: any;
  }[] = [
    { to: "/", label: "Shop", icon: IconShop },
    { to: "/auctions", label: "Auctions", icon: IconGavel },
  ];
  if (user.value) {
    tabs.push(
      { to: "/collection", label: "Collection", icon: IconCollection },
      { to: "/activity", label: "Orders", icon: IconActivity },
      {
        to: `/profile/${user.value.uid}`,
        label: "Profile",
        icon: IconUser,
      },
    );
  } else {
    tabs.push({ to: "/profile", label: "Sign in", icon: IconUser });
  }
  return tabs;
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

const sellMenuOpen = ref(false);
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
  sellMenuOpen.value = false;
  desktopSellOpen.value = false;
};
onMounted(() => {
  document.addEventListener("click", handleDocClick);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocClick);
});

// Close transient menus on route change.
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    sellMenuOpen.value = false;
    desktopSellOpen.value = false;
    searchOpen.value = false;
    cartOpen.value = false;
  },
);

// ── Seller notification dot ───────────────────────────────────────────
// The bell itself lives in the seller layout; out here only the dot matters,
// so this listens for the count and nothing else.
const { hasUnread: sellerHasUnread, listen: listenNotifications } = useNotifications();
watch(() => user.value?.uid, () => listenNotifications(), { immediate: true });
</script>

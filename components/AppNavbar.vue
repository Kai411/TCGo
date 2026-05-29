<template>
  <!-- Top bar (sticky, glassy) -->
  <nav class="sticky top-0 z-40 glass">
    <div
      class="container mx-auto px-4 h-16 flex items-center justify-between gap-4"
    >
      <!-- Logo (matches LandingNavbar: square sprite cropped to wordmark slice).
           Links to /landing (marketing) — user prefers this over the shop
           home since the marketing surface is where new visitors land. -->
      <NuxtLink to="/landing" class="flex items-center h-full shrink-0">
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

      <!-- Desktop nav -->
      <div
        class="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-xl"
      >
        <NuxtLink
          v-for="link in desktopLinks"
          :key="link.to"
          :to="link.to"
          class="relative px-4 py-2 rounded-full text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors duration-200 ease-premium"
          :active-class="activeLinkClass"
        >
          {{ link.label }}
        </NuxtLink>
      </div>

      <!-- Right cluster -->
      <div class="flex items-center gap-1.5 lg:gap-2 shrink-0">
        <!-- Desktop sell CTAs -->
        <div v-if="user" class="hidden lg:flex items-center gap-2 ml-1">
          <NuxtLink
            to="/cards/create"
            class="px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
          >
            Sell
          </NuxtLink>
          <NuxtLink
            to="/auctions/create"
            class="px-4 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow"
          >
            Auction
          </NuxtLink>
        </div>

        <!-- Search button — visible on both mobile and desktop. Opens the
             full-screen search modal. -->
        <button
          @click="searchOpen = true"
          aria-label="Search"
          class="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-ink dark:text-white transition-colors"
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

        <!-- Cart -->
        <NuxtLink
          to="/cart"
          aria-label="Cart"
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
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span
            v-if="cartCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
          >
            {{ cartCount > 99 ? "99+" : cartCount }}
          </span>
        </NuxtLink>

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
                to="/cards/create"
                @click="sellMenuOpen = false"
                class="block px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                Sell a card
              </NuxtLink>
              <NuxtLink
                to="/auctions/create"
                @click="sellMenuOpen = false"
                class="block px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                Start an auction
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
          @click="signInWithGoogle"
          class="hidden lg:inline-flex px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
        >
          Sign In
        </button>
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

  <SearchModal v-model="searchOpen" />
</template>

<script setup lang="ts">
import { h, computed } from "vue";

const { user, authLoading, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { isAdmin } = useAdmin();
const { cartCount } = useCart();

const activeLinkClass =
  "!text-white dark:!text-ink !bg-ink dark:!bg-white shadow-card";

const { premiumEnabled } = useFeatureFlags();

const desktopLinks = computed(() => {
  const links = [
    { to: "/", label: "Shop" },
    { to: "/auctions", label: "Auctions" },
  ];
  if (premiumEnabled) links.push({ to: "/pricing", label: "Pricing" });
  if (user.value) {
    links.push({ to: "/collection", label: "Collection" });
    links.push({ to: "/activity", label: "Activity" });
  }
  if (isAdmin.value) links.push({ to: "/admin/reports", label: "Admin" });
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
      { to: "/activity", label: "Activity", icon: IconActivity },
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

const sellMenuOpen = ref(false);
const searchOpen = ref(false);

// Close the sell menu when user clicks anywhere else.
const handleDocClick = () => {
  sellMenuOpen.value = false;
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
    searchOpen.value = false;
  },
);
</script>

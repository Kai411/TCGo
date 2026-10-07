<template>
  <!-- The phone's Account tab: one place for orders, selling, settings and
       the policy pages that used to sit in the footer. Laid out like the
       account screens of the marketplace apps people already use — header,
       quick shortcuts, a selling card, order statuses, then a settings list. -->
  <div class="max-w-xl mx-auto space-y-4 select-none">
    <!-- Header. Signed out, it's a sign-in card instead; the policy links
         below stay visible either way, since visitors need them too. -->
    <div
      v-if="authLoading"
      class="flex items-center gap-4 py-2"
      aria-hidden="true"
    >
      <div class="w-14 h-14 rounded-full bg-black/5 dark:bg-white/10 animate-pulse" />
      <div class="h-5 w-36 rounded bg-black/5 dark:bg-white/10 animate-pulse" />
    </div>

    <div v-else-if="user" class="flex items-center gap-2">
      <NuxtLink
        :to="`/profile/${user.uid}`"
        class="press flex-1 min-w-0 flex items-center gap-4 min-h-[64px] py-2"
      >
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          alt=""
          class="w-14 h-14 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900 bg-black/5 dark:bg-white/10 shrink-0"
        />
        <span
          v-else
          aria-hidden="true"
          class="w-14 h-14 rounded-full shrink-0 bg-black/[0.06] dark:bg-white/10 text-ink-muted dark:text-zinc-300 text-xl font-bold flex items-center justify-center"
        >
          {{ displayName.charAt(0).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <p class="text-lg font-bold text-ink dark:text-white truncate">
              {{ displayName }}
            </p>
            <svg
              class="w-5 h-5 shrink-0 text-ink-soft dark:text-zinc-500"
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
          </div>
          <p class="text-xs text-ink-soft dark:text-zinc-500 mt-0.5">
            <span
              v-if="profile?.kycStatus === 'verified'"
              class="font-semibold text-emerald-700 dark:text-emerald-300"
            >
              Verified ·
            </span>
            View your profile
          </p>
        </div>
      </NuxtLink>
      <!-- Customer code: shown at a shop counter, so it opens as a popup
           right here instead of sending anyone into settings. -->
      <button
        type="button"
        @click="showBuyerQr = true"
        class="press shrink-0 flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[56px] rounded-2xl surface border border-black/[0.06] dark:border-white/[0.08] text-ink dark:text-white"
        aria-haspopup="dialog"
      >
        <IconQr class="w-6 h-6" />
        <span class="text-[10px] font-semibold">My code</span>
      </button>
    </div>

    <div
      v-else
      class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5"
    >
      <p class="text-lg font-bold text-ink dark:text-white">Your TCGo account</p>
      <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1">
        Sign in to see your orders, messages and selling.
      </p>
      <button
        type="button"
        @click="goToLogin"
        class="press mt-4 min-h-[44px] px-5 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
      >
        Sign in
      </button>
    </div>

    <template v-if="user">
      <!-- Quick shortcuts -->
      <div class="grid grid-cols-4">
        <NuxtLink
          v-for="s in shortcuts"
          :key="s.label"
          :to="s.to"
          class="press relative flex flex-col items-center justify-center gap-1.5 min-h-[64px] text-xs font-medium text-ink-muted dark:text-zinc-300"
        >
          <span class="relative">
            <component :is="s.icon" class="w-6 h-6" />
            <span
              v-if="s.badge"
              class="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
            >
              {{ badgeLabel(s.badge) }}
            </span>
          </span>
          {{ s.label }}
        </NuxtLink>
      </div>

      <!-- Selling. New sellers get the invitation; set-up sellers get their
           dashboard, with the same unread dot the nav used to carry. -->
      <NuxtLink
        v-if="!isSeller"
        to="/seller/onboarding"
        class="press block rounded-2xl p-5 bg-pokemon-red text-white shadow-glow"
      >
        <p class="text-lg font-bold">Start selling on TCGo</p>
        <p class="text-sm text-white/85 mt-1">
          List your cards or start an auction. Setting up takes a few minutes.
        </p>
        <span
          class="mt-4 inline-flex items-center min-h-[40px] px-4 rounded-full bg-white text-pokemon-red text-sm font-semibold"
        >
          Set up selling
        </span>
      </NuxtLink>
      <NuxtLink
        v-else
        to="/seller"
        class="press surface flex items-center gap-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 min-h-[64px]"
      >
        <span
          class="w-10 h-10 shrink-0 rounded-xl bg-pokemon-red/[0.08] text-pokemon-red flex items-center justify-center"
        >
          <IconStore class="w-5 h-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2 text-sm font-bold text-ink dark:text-white">
            Seller Dashboard
            <span
              v-if="sellerHasUnread"
              class="w-2 h-2 rounded-full bg-pokemon-red"
              aria-label="Unread seller notifications"
            />
          </span>
          <span class="block text-xs text-ink-soft dark:text-zinc-500 mt-0.5">
            Listings, orders to ship, sales and payouts
          </span>
        </span>
        <IconChevron class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" />
      </NuxtLink>

      <!-- My orders, by the same groups as the Orders page filters -->
      <section
        class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] pt-2 pb-3"
      >
        <NuxtLink
          to="/activity"
          class="press flex items-center justify-between px-4 min-h-[48px]"
        >
          <span class="text-base font-bold text-ink dark:text-white">My Orders</span>
          <span class="flex items-center gap-0.5 text-xs font-medium text-ink-soft dark:text-zinc-500">
            View all
            <IconChevron class="w-4 h-4" />
          </span>
        </NuxtLink>
        <div class="grid grid-cols-4 px-1">
          <NuxtLink
            v-for="g in orderGroups"
            :key="g.id"
            :to="`/activity?filter=${g.id}`"
            class="press flex flex-col items-center justify-center gap-1.5 min-h-[64px] text-xs font-medium text-ink-muted dark:text-zinc-300"
          >
            <span class="relative">
              <component :is="g.icon" class="w-6 h-6" />
              <span
                v-if="g.badge"
                class="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
              >
                {{ badgeLabel(g.badge) }}
              </span>
            </span>
            {{ g.label }}
          </NuxtLink>
        </div>
      </section>

      <!-- Settings list -->
      <section
        class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden"
      >
        <NuxtLink
          v-for="row in settingsRows"
          :key="row.to"
          :to="row.to"
          class="press flex items-center gap-4 px-4 min-h-[56px]"
        >
          <span
            class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
          >
            <component :is="row.icon" class="w-[18px] h-[18px]" />
          </span>
          <span class="flex-1 text-sm font-medium text-ink dark:text-white">{{ row.label }}</span>
          <IconChevron class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" />
        </NuxtLink>
        <!-- A label, not a link, so the whole row flips the switch. -->
        <label class="flex items-center gap-4 px-4 min-h-[56px] cursor-pointer">
          <span
            class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
          >
            <IconMoon class="w-[18px] h-[18px]" />
          </span>
          <span class="flex-1 text-sm font-medium text-ink dark:text-white">Dark mode</span>
          <ThemeToggle />
        </label>
      </section>
    </template>

    <!-- About and policies: what the footer used to hold. Shown signed out
         too, so the policy pages stay one tap away for visitors. -->
    <section
      class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] overflow-hidden"
    >
      <NuxtLink
        v-for="link in aboutLinks"
        :key="link.to"
        :to="link.to"
        class="press flex items-center justify-between gap-4 px-4 min-h-[52px] text-sm font-medium text-ink dark:text-white"
      >
        {{ link.label }}
        <IconChevron class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" />
      </NuxtLink>
    </section>

    <button
      v-if="user"
      type="button"
      @click="handleSignOut"
      class="press w-full min-h-[48px] rounded-2xl surface border border-black/[0.06] dark:border-white/[0.08] text-sm font-semibold text-pokemon-red"
    >
      Sign out
    </button>

    <BuyerQrDialog v-if="user" v-model="showBuyerQr" />

    <p class="text-center text-xs text-ink-soft dark:text-zinc-500 pt-2">
      © {{ new Date().getFullYear() }} TCGo Marketplace
    </p>
  </div>
</template>

<script setup lang="ts">
import { h, computed, ref, watch } from "vue";
import { LEGAL_LINKS } from "~/shared/legal";
import { badgeLabel } from "~/shared/notifications";
import { withoutMergedChildren } from "~/shared/delivery-stage";
import {
  ORDER_FILTER_LABELS,
  inOrderGroup,
  type OrderFilter,
} from "~/shared/order-filters";

const { user, authLoading, signOut } = useAuth();
const { goToLogin } = useSignInGate();
const { profile } = useMyProfile();
const { premiumEnabled } = useFeatureFlags();
const { unreadConversations, listenInbox } = useChat();
const { hasUnreadSeller: sellerHasUnread, listen: listenNotifications } =
  useNotifications();
const { buyerCompiledOrders, listenBuyerCompiledOrders } = useCompiledOrders();

watch(
  () => user.value?.uid,
  (uid) => {
    listenInbox();
    listenNotifications();
    if (uid) listenBuyerCompiledOrders();
  },
  { immediate: true },
);

const displayName = computed(
  () => profile.value?.customName || user.value?.displayName || "Your account",
);

const showBuyerQr = ref(false);

const avatarUrl = computed(() => profile.value?.photoURL || user.value?.photoURL || "");

// Set when the seller finishes onboarding (pages/seller/verify.vue).
const isSeller = computed(() => !!profile.value?.sellerKycCompletedAt);

// ── Icons ────────────────────────────────────────────────────────────
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};
const icon = (...paths: ReturnType<typeof h>[]) => () => h("svg", stroke, paths);
const p = (d: string) => h("path", { d });

const IconChevron = () =>
  h("svg", { ...stroke, "stroke-width": "2.5" }, [p("m9 18 6-6-6-6")]);
const IconGavel = icon(p("M14 4l6 6-3 3-6-6 3-3z"), p("M11 7l-7 7 3 3 7-7"), p("M3 21h12"));
const IconTrophy = icon(
  p("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"),
  p("M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"),
);
const IconHeart = icon(
  p("M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"),
);
const IconChat = icon(p("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"));
const IconStore = icon(p("M3 9l1.5-5h15L21 9"), p("M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"), p("M9 13h6"));
const IconWallet = icon(p("M3 7a2 2 0 0 1 2-2h14v4"), p("M3 7v12a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2z"), p("M16 15h2"));
const IconTruck = icon(p("M1 4h14v12H1z"), p("M15 9h4l3 3v4h-7"), h("circle", { cx: "5.5", cy: "18.5", r: "2" }), h("circle", { cx: "18.5", cy: "18.5", r: "2" }));
const IconCheck = icon(h("circle", { cx: "12", cy: "12", r: "9" }), p("m8 12 3 3 5-6"));
const IconX = icon(h("circle", { cx: "12", cy: "12", r: "9" }), p("m15 9-6 6M9 9l6 6"));
const IconPin = icon(p("M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"), h("circle", { cx: "12", cy: "9", r: "2.5" }));
const IconBell = icon(p("M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"), p("M13.7 21a2 2 0 0 1-3.4 0"));
const IconUserCog = icon(h("circle", { cx: "10", cy: "8", r: "4" }), p("M3 21a7 7 0 0 1 11-5.7"), h("circle", { cx: "18", cy: "17", r: "2.5" }));
const IconStar = icon(p("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"));
const IconSpark = icon(p("M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9"));
const IconQr = icon(
  h("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }),
  h("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }),
  h("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }),
  p("M14 14h3v3h-3zM19 19h2v2h-2z"),
);
const IconMoon = icon(p("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"));

// ── Shortcuts ────────────────────────────────────────────────────────
const shortcuts = computed(() => [
  { label: "Bidding", to: "/activity?tab=bidding", icon: IconGavel, badge: 0 },
  { label: "Won", to: "/activity?tab=won", icon: IconTrophy, badge: 0 },
  {
    label: "Favourites",
    to: `/profile/${user.value?.uid}?tab=favourites`,
    icon: IconHeart,
    badge: 0,
  },
  { label: "Messages", to: "/messages", icon: IconChat, badge: unreadConversations.value },
]);

// ── Orders by status ─────────────────────────────────────────────────
// Counted off the same de-duplicated list the Orders page shows, so a badge
// here never promises more rows than the page has.
const buyerOrders = computed(() => withoutMergedChildren([...buyerCompiledOrders.value]));
const countFor = (f: OrderFilter) =>
  buyerOrders.value.filter((o) => inOrderGroup(o.status, f)).length;

// Badges only where something is still moving; completed and cancelled
// counts would only grow and stop meaning anything.
const orderGroups = computed(() => [
  { id: "topay", icon: IconWallet, badge: countFor("topay") },
  { id: "intransit", icon: IconTruck, badge: countFor("intransit") },
  { id: "completed", icon: IconCheck, badge: 0 },
  { id: "cancelled", icon: IconX, badge: 0 },
].map((g) => ({ ...g, label: ORDER_FILTER_LABELS[g.id as OrderFilter] })));

// ── Settings ─────────────────────────────────────────────────────────
// Each row opens its own page, so none of them lands somewhere it didn't name.
const settingsRows = computed(() => {
  const rows = [
    { label: "Shipping addresses", to: "/account/addresses", icon: IconPin },
    { label: "Notifications", to: "/account/notifications", icon: IconBell },
    // Name, photo, contact details, membership and privacy.
    { label: "Account settings", to: "/profile", icon: IconUserCog },
  ];
  if (premiumEnabled) rows.push({ label: "TCGo Premium", to: "/membership", icon: IconStar });
  rows.push({ label: "What's new", to: "/update-notice", icon: IconSpark });
  return rows;
});

const aboutLinks = [{ to: "/landing", label: "About TCGo" }, ...LEGAL_LINKS];

const handleSignOut = async () => {
  await signOut();
  await navigateTo("/");
};
</script>

<style scoped>
/* Pressed feedback for touch: a slight scale on press, never on hover, so
   nothing sticks after a tap on a phone. */
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
</style>

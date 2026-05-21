<template>
  <div>
    <!-- Loading -->
    <div v-if="profileLoading" class="flex justify-center py-24">
      <div
        class="animate-spin rounded-full h-8 w-8 border-2 border-ink/10 border-t-pokemon-red"
      />
    </div>

    <!-- Not found -->
    <div v-else-if="!profile" class="surface rounded-2xl py-20 text-center">
      <p class="text-lg font-semibold text-ink dark:text-white">
        User not found
      </p>
      <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
        This profile doesn't exist or was removed.
      </p>
      <NuxtLink
        to="/"
        class="mt-6 inline-flex items-center gap-1 text-sm text-pokemon-red font-semibold hover:underline"
      >
        ← Back to shop
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Hero -->
      <section class="pt-2 pb-8 lg:pb-10">
        <div
          class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6"
        >
          <div class="flex items-center gap-4 sm:gap-6 min-w-0">
            <img
              :src="profile.photoURL || ''"
              :alt="profile.customName || profile.displayName"
              class="w-20 h-20 sm:w-28 sm:h-28 rounded-full ring-4 ring-white dark:ring-canvas-inverse shadow-card object-cover shrink-0"
            />
            <div class="min-w-0">
              <span class="eyebrow">Profile</span>
              <h1
                class="mt-1 font-display text-3xl sm:text-display font-extrabold tracking-tightest text-ink dark:text-white truncate"
              >
                {{ profile.customName || profile.displayName }}
              </h1>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  v-if="profile.whatsappVerified"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Beta Verified
                </span>
                <span v-else-if="profile.whatsappNumber" class="chip">
                  Contact added
                </span>
                <span
                  v-if="getScoreBadge(profile.trustScore ?? 100)"
                  class="chip"
                  :class="badgeChipVariant(profile.trustScore ?? 100)"
                >
                  {{ getScoreBadge(profile.trustScore ?? 100)?.label }}
                </span>
              </div>
              <p class="mt-2 text-xs text-ink-soft dark:text-zinc-500">
                Member since {{ formatDate(profile.createdAt) }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div v-if="isOwnProfile" class="flex gap-2 sm:self-end">
            <NuxtLink
              to="/profile"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-black/[0.08] dark:border-white/[0.08] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <svg
                class="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
              Settings
            </NuxtLink>
            <button
              @click="handleSignOut"
              class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-pokemon-red border border-pokemon-red/30 hover:bg-pokemon-red/[0.06] transition-colors"
            >
              Log out
            </button>
          </div>
          <button
            v-else-if="user"
            @click="showReportForm = true"
            class="self-start sm:self-end inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-pokemon-red border border-pokemon-red/30 hover:bg-pokemon-red/[0.06] transition-colors"
          >
            Report user
          </button>
        </div>
      </section>

      <!-- Trust score (Listed + Auctions counts now live in the tab bar) -->
      <section class="mb-6">
        <button
          type="button"
          @click="showTrustInfo = true"
          class="inline-flex items-center gap-2 surface rounded-full px-3 py-1.5 hover:shadow-card-hover transition-shadow ease-premium"
        >
          <span class="text-[11px] font-semibold tracking-wide uppercase text-ink-muted dark:text-zinc-400">
            Trust
          </span>
          <span
            class="tabular-price text-sm font-bold"
            :class="trustScoreColor(profile.trustScore ?? 100)"
          >
            {{ profile.trustScore ?? 100 }}<span
              class="text-ink-soft dark:text-zinc-500 font-medium"
              >/100</span
            >
          </span>
          <svg
            class="w-3 h-3 text-ink-soft"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </section>

      <!-- Underline tabs -->
      <div class="hairline mb-8">
        <div class="flex items-center gap-8 -mb-px">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="relative pb-4 pt-1 text-lg sm:text-xl font-bold tracking-tightest transition-colors ease-premium"
            :class="
              activeTab === tab.id
                ? 'text-ink dark:text-white'
                : 'text-ink-soft hover:text-ink-muted dark:text-zinc-500 dark:hover:text-zinc-300'
            "
          >
            {{ tab.label }}
            <span
              class="ml-2 tabular-price text-sm font-bold align-middle"
              :class="
                activeTab === tab.id
                  ? 'text-pokemon-red'
                  : 'text-ink-soft dark:text-zinc-600'
              "
            >
              {{ tab.count }}
            </span>
            <span
              v-if="activeTab === tab.id"
              class="absolute left-0 right-0 -bottom-px h-[2px] bg-pokemon-red rounded-full"
            />
          </button>
        </div>
      </div>

      <!-- Cards tab -->
      <div v-if="activeTab === 'cards'">
        <EmptyState
          v-if="userCards.length === 0"
          headline="Nothing listed yet"
          caption="When this collector lists a card, it'll show up here."
        />
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
        >
          <ProfileItem
            v-for="card in userCards"
            :key="card.id"
            :to="`/cards/${card.id}`"
            :image="card.imageUrls?.[0] || card.imageUrl"
            :title="card.cardName"
            :subtitle="card.cardSet || card.condition"
            :price="card.price"
            :status="card.sold ? 'sold' : 'available'"
          />
        </div>
      </div>

      <!-- Auctions tab -->
      <div v-if="activeTab === 'auctions'">
        <EmptyState
          v-if="userAuctions.length === 0"
          headline="No auctions yet"
          caption="Auctions this user runs will appear here."
        />
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
        >
          <ProfileItem
            v-for="auction in userAuctions"
            :key="auction.id"
            :to="`/auctions/${auction.id}`"
            :image="auction.imageUrls?.[0] || auction.imageUrl"
            :title="auction.cardName"
            :subtitle="auction.cardSet"
            :price="auction.currentPrice"
            :status="isActive(auction) ? 'active' : 'ended'"
          />
        </div>
      </div>

      <!-- Favourites tab -->
      <div v-if="activeTab === 'favourites' && showFavourites">
        <EmptyState
          v-if="favouriteCards.length === 0 && favouriteAuctions.length === 0"
          headline="No favourites yet"
          :caption="emptyFavouritesCaption"
        />
        <div v-else class="space-y-10">
          <section v-if="favouriteCards.length">
            <span class="eyebrow mb-3 block">Cards</span>
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
            >
              <ProfileItem
                v-for="card in favouriteCards"
                :key="card.id"
                :to="`/cards/${card.id}`"
                :image="card.imageUrls?.[0] || card.imageUrl"
                :title="card.cardName"
                :subtitle="card.cardSet"
                :price="card.price"
                :status="card.sold ? 'sold' : 'available'"
              />
            </div>
          </section>
          <section v-if="favouriteAuctions.length">
            <span class="eyebrow mb-3 block">Auctions</span>
            <div
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5"
            >
              <ProfileItem
                v-for="auction in favouriteAuctions"
                :key="auction.id"
                :to="`/auctions/${auction.id}`"
                :image="auction.imageUrls?.[0] || auction.imageUrl"
                :title="auction.cardName"
                :subtitle="auction.cardSet"
                :price="auction.currentPrice"
                :status="isActive(auction) ? 'active' : 'ended'"
              />
            </div>
          </section>
        </div>
      </div>
    </template>

    <!-- Report Form Modal -->
    <ReportForm
      v-if="showReportForm && profile"
      :reported-uid="uid"
      :reported-name="profile.customName || profile.displayName"
      @close="showReportForm = false"
      @submitted="reportSubmitted = true"
    />

    <!-- Trust Score Modal -->
    <Teleport to="body">
      <div
        v-if="showTrustInfo"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showTrustInfo = false"
      >
        <div
          class="surface rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 sm:p-7"
        >
          <div class="flex items-start justify-between mb-5">
            <div>
              <span class="eyebrow">How it works</span>
              <h2
                class="mt-1 text-xl font-bold tracking-tightest text-ink dark:text-white"
              >
                Trust Score
              </h2>
            </div>
            <button
              @click="showTrustInfo = false"
              class="w-8 h-8 rounded-full flex items-center justify-center text-ink-soft hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="space-y-5 text-sm text-ink-muted dark:text-zinc-300">
            <p>
              Every user starts at
              <strong class="text-ink dark:text-white">100 / 100</strong>. The
              score reflects how reliably they trade with the community.
            </p>

            <div>
              <span class="eyebrow mb-2 block">Penalties</span>
              <ul class="space-y-2">
                <li class="flex items-center justify-between">
                  <span>Scam (buyer or seller)</span>
                  <span class="tabular-price text-pokemon-red font-bold"
                    >−25</span
                  >
                </li>
                <li class="flex items-center justify-between">
                  <span>Auction bail</span>
                  <span class="tabular-price text-orange-500 font-bold"
                    >−10</span
                  >
                </li>
                <li class="flex items-center justify-between">
                  <span>Ghosted deal</span>
                  <span class="tabular-price text-yellow-500 font-bold"
                    >−5</span
                  >
                </li>
                <li class="flex items-center justify-between">
                  <span>Disruptive behaviour</span>
                  <span class="tabular-price text-yellow-500 font-bold"
                    >−5</span
                  >
                </li>
              </ul>
            </div>

            <div>
              <span class="eyebrow mb-2 block">How it recovers</span>
              <p class="text-xs text-ink-soft dark:text-zinc-500">
                +2 per completed deal. All reports are reviewed by admins before
                penalties apply, and evidence is required.
              </p>
            </div>

            <div>
              <span class="eyebrow mb-2 block">Restrictions</span>
              <ul class="space-y-1.5 text-xs">
                <li class="flex justify-between">
                  <span class="text-ink-muted dark:text-zinc-400"
                    >Below 80</span
                  >
                  <span>Warning badge shown</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-ink-muted dark:text-zinc-400"
                    >Below 60</span
                  >
                  <span>Cannot bid on auctions</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-ink-muted dark:text-zinc-400"
                    >Below 40</span
                  >
                  <span>Cannot list items</span>
                </li>
                <li class="flex justify-between">
                  <span class="text-ink-muted dark:text-zinc-400"
                    >Below 20</span
                  >
                  <span>Account suspended</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Report toast -->
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-200"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="reportSubmitted"
        class="fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-50 surface rounded-full pl-3 pr-4 py-2 flex items-center gap-2 shadow-card-hover"
      >
        <span class="w-2 h-2 rounded-full bg-emerald-500" />
        <span class="text-sm font-medium text-ink dark:text-white">
          Report submitted
        </span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { Auction } from "~/composables/useAuctions";

const route = useRoute();
const uid = route.params.uid as string;

const { profile, loading: profileLoading } = useProfile(uid);
const { user, signOut } = useAuth();
const { auctions } = useAuctions();
const { cards } = useCards();
const { userFavourites } = useUserFavourites(uid);
const { getScoreBadge } = useTrustScore();

const isOwnProfile = computed(() => user.value?.uid === uid);

const showReportForm = ref(false);
const reportSubmitted = ref(false);
const showTrustInfo = ref(false);

const showFavourites = computed(() => {
  if (isOwnProfile.value) return true;
  return profile.value?.favouritesPublic ?? true;
});

type TabId = "cards" | "auctions" | "favourites";
const activeTab = ref<TabId>("cards");

const userCards = computed(() =>
  cards.value
    .filter((c: any) => c.sellerUid === uid)
    .sort((a: any, b: any) => b.createdAt - a.createdAt),
);

const userAuctions = computed(() =>
  auctions.value
    .filter((a: any) => a.sellerUid === uid)
    .sort((a: any, b: any) => b.createdAt - a.createdAt),
);

const favouriteCards = computed(() => {
  const ids = userFavourites.value
    .filter((f: any) => f.itemType === "card")
    .map((f: any) => f.itemId);
  return cards.value.filter((c: any) => ids.includes(c.id));
});

const favouriteAuctions = computed(() => {
  const ids = userFavourites.value
    .filter((f: any) => f.itemType === "auction")
    .map((f: any) => f.itemId);
  return auctions.value.filter((a: any) => ids.includes(a.id));
});

const tabs = computed(() => {
  const base: { id: TabId; label: string; count: number }[] = [
    { id: "cards", label: "Cards", count: userCards.value.length },
    { id: "auctions", label: "Auctions", count: userAuctions.value.length },
  ];
  if (showFavourites.value) {
    base.push({
      id: "favourites",
      label: "Favourites",
      count: favouriteCards.value.length + favouriteAuctions.value.length,
    });
  }
  return base;
});

const emptyFavouritesCaption = computed(() =>
  isOwnProfile.value
    ? "Tap the heart on any card or auction to save it here."
    : "This collector has no favourites yet.",
);

const isActive = (auction: Auction) => auction.endsAt > Date.now();

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const trustScoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-500 dark:text-amber-400";
  if (score >= 40) return "text-orange-500 dark:text-orange-400";
  return "text-pokemon-red";
};

const badgeChipVariant = (score: number) => {
  if (score >= 80)
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 60) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (score >= 40)
    return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
  return "bg-pokemon-red/10 text-pokemon-red";
};

const handleSignOut = () => signOut();
</script>

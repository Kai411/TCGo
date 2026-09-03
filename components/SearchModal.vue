<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <!-- Mobile: full-screen takeover. Desktop (lg+): dimmed backdrop with a
           floating panel just under the top bar, so the page stays visible. -->
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[60] bg-canvas dark:bg-canvas-inverse lg:bg-black/40 lg:dark:bg-black/60 flex flex-col lg:items-center lg:pt-20 lg:px-4"
        @click.self="close"
      >
       <div
        class="flex flex-col flex-1 min-h-0 w-full lg:flex-none lg:max-w-3xl lg:max-h-[70vh] lg:rounded-2xl lg:surface lg:overflow-hidden"
       >
        <!-- Header -->
        <div
          class="flex items-center gap-3 px-3 sm:px-6 h-16 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0"
        >
          <button
            @click="close"
            class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-ink dark:text-white"
            aria-label="Close search"
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div
            class="flex-1 flex items-center gap-2 px-4 h-11 rounded-full bg-black/[0.04] dark:bg-white/[0.06]"
          >
            <svg
              class="w-4 h-4 text-ink-muted shrink-0"
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
            <input
              ref="inputEl"
              v-model="query"
              type="search"
              placeholder="Search cards, auctions, sets, sellers…"
              class="flex-1 bg-transparent outline-none text-sm sm:text-base text-ink dark:text-white placeholder-ink-soft [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              @keydown.enter="onEnter"
            />
            <button
              v-if="query"
              @click="query = ''"
              class="text-ink-soft hover:text-ink dark:hover:text-white"
              aria-label="Clear"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto">
          <div class="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-3xl">
            <!-- Empty state: recents + suggestions -->
            <template v-if="!query.trim()">
              <section v-if="history.length > 0" class="mb-6">
                <div class="flex items-center justify-between mb-2">
                  <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400">Recent</p>
                  <button
                    @click="clear"
                    class="text-xs font-semibold text-ink-muted dark:text-zinc-400 hover:text-pokemon-red"
                  >
                    Clear all
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="h in history"
                    :key="h"
                    @click="query = h"
                    class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-ink dark:text-white"
                  >
                    {{ h }}
                    <span
                      class="ml-0.5 text-ink-soft dark:text-zinc-500 hover:text-pokemon-red"
                      @click.stop="forget(h)"
                    >
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </span>
                  </button>
                </div>
              </section>

              <section v-if="topSets.length > 0" class="mb-6">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Popular sets</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="s in topSets"
                    :key="s.name"
                    @click="query = s.name"
                    class="px-3 py-1.5 rounded-full text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-ink dark:text-white"
                  >
                    {{ s.name }}
                    <span class="ml-1 text-ink-soft dark:text-zinc-500 tabular-nums">{{ s.count }}</span>
                  </button>
                </div>
              </section>

              <section v-if="topSellers.length > 0">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">Active sellers</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="s in topSellers"
                    :key="s.name"
                    @click="query = s.name"
                    class="px-3 py-1.5 rounded-full text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-ink dark:text-white"
                  >
                    @{{ s.name }}
                    <span class="ml-1 text-ink-soft dark:text-zinc-500 tabular-nums">{{ s.count }}</span>
                  </button>
                </div>
              </section>
            </template>

            <!-- Results -->
            <template v-else>
              <div v-if="totalResults === 0" class="py-12 text-center text-sm text-ink-muted dark:text-zinc-400">
                No results for "{{ query }}"
              </div>

              <section v-if="cardResults.length > 0" class="mb-6">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">
                  Cards ({{ cardResults.length }})
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NuxtLink
                    v-for="card in cardResults"
                    :key="card.id"
                    :to="`/cards/${card.id}`"
                    @click="commit()"
                    class="surface rounded-xl overflow-hidden hover:shadow-card-hover transition-shadow"
                  >
                    <div class="p-1.5 bg-white dark:bg-white/[0.04]">
                      <img
                        v-if="card.imageUrls?.length || card.imageUrl"
                        :src="cdnUrl(card.imageUrls?.[0] || card.imageUrl, 300)"
                        :alt="card.cardName"
                        loading="lazy"
                        class="w-full aspect-[3/4] object-cover rounded"
                      />
                    </div>
                    <div class="px-3 py-2">
                      <p class="text-sm font-semibold text-ink dark:text-white truncate">{{ card.cardName }}</p>
                      <p v-if="card.cardSet" class="text-xs text-ink-muted dark:text-zinc-400 truncate">{{ card.cardSet }}</p>
                      <p class="mt-1 tabular-price text-sm font-bold text-ink dark:text-white">RM {{ card.price.toFixed(2) }}</p>
                    </div>
                  </NuxtLink>
                </div>
              </section>

              <section v-if="auctionResults.length > 0">
                <p class="text-xs font-bold uppercase tracking-wider text-ink-muted dark:text-zinc-400 mb-2">
                  Auctions ({{ auctionResults.length }})
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NuxtLink
                    v-for="a in auctionResults"
                    :key="a.id"
                    :to="`/auctions/${a.id}`"
                    @click="commit()"
                    class="surface rounded-xl overflow-hidden hover:shadow-card-hover transition-shadow"
                  >
                    <div class="p-1.5 bg-white dark:bg-white/[0.04] relative">
                      <img
                        v-if="a.imageUrls?.length || a.imageUrl"
                        :src="cdnUrl(a.imageUrls?.[0] || a.imageUrl, 300)"
                        :alt="a.cardName"
                        loading="lazy"
                        class="w-full aspect-[3/4] object-cover rounded"
                      />
                      <span
                        class="absolute left-2 top-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide shadow-sm"
                        :class="a.endsAt > Date.now() ? 'bg-emerald-500/90 text-white' : 'bg-zinc-700 text-white'"
                      >
                        {{ a.endsAt > Date.now() ? 'LIVE' : 'ENDED' }}
                      </span>
                    </div>
                    <div class="px-3 py-2">
                      <p class="text-sm font-semibold text-ink dark:text-white truncate">{{ a.cardName }}</p>
                      <p v-if="a.cardSet" class="text-xs text-ink-muted dark:text-zinc-400 truncate">{{ a.cardSet }}</p>
                      <p class="mt-1 tabular-price text-sm font-bold text-ink dark:text-white">RM {{ a.currentPrice.toFixed(2) }}</p>
                    </div>
                  </NuxtLink>
                </div>
              </section>
            </template>
          </div>
        </div>
       </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";
import type { Card } from "~/composables/useCards";
import type { Auction } from "~/composables/useAuctions";
import { isAvailable } from "~/shared/card-availability";

const props = defineProps<{
  modelValue: boolean;
  /** Seed the query on open (used by the inline navbar search field). */
  initialQuery?: string;
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const { cards } = useCards();
const { auctions } = useAuctions();
const { history, remember, forget, clear } = useSearchHistory();

const query = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      query.value = props.initialQuery ?? "";
      await nextTick();
      inputEl.value?.focus();
    }
  },
);

const close = () => emit("update:modelValue", false);

const matches = (haystack: string, term: string) =>
  haystack.toLowerCase().includes(term.toLowerCase());

const cardResults = computed<Card[]>(() => {
  const term = query.value.trim();
  if (!term) return [];
  return cards.value
    .filter(isAvailable)
    .filter((c: Card) =>
      matches(
        `${c.cardName} ${c.cardSet ?? ""} ${c.seller ?? ""}`,
        term,
      ),
    )
    .slice(0, 24);
});

const auctionResults = computed<Auction[]>(() => {
  const term = query.value.trim();
  if (!term) return [];
  return auctions.value
    .filter((a: Auction) => !a.isPrivate)
    .filter((a: Auction) =>
      matches(
        `${a.cardName} ${a.cardSet ?? ""} ${a.seller ?? ""} ${a.title ?? ""}`,
        term,
      ),
    )
    .slice(0, 24);
});

const totalResults = computed(
  () => cardResults.value.length + auctionResults.value.length,
);

// Top sets and sellers — derived from live listings so suggestions
// reflect actual catalog content rather than a hardcoded list.
const topSets = computed(() => {
  const counts = new Map<string, number>();
  for (const c of cards.value) {
    if (!isAvailable(c) || !c.cardSet) continue;
    counts.set(c.cardSet, (counts.get(c.cardSet) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
});

const topSellers = computed(() => {
  const counts = new Map<string, number>();
  for (const c of cards.value) {
    if (!isAvailable(c) || !c.seller) continue;
    counts.set(c.seller, (counts.get(c.seller) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
});

const { dismissKeyboard } = useDismissKeyboard();

const commit = () => {
  if (query.value.trim()) remember(query.value);
  close();
};

const onEnter = () => {
  // Blurred, not closed: the modal shows results in place, and the keyboard
  // sitting over them is the whole complaint.
  dismissKeyboard(inputEl.value);
  if (query.value.trim()) remember(query.value);
};

// Close on route change so tapping a result doesn't leave the modal hanging.
const route = useRoute();
watch(() => route.fullPath, () => emit("update:modelValue", false));
</script>

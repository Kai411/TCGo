<template>
  <div>
    <!-- ── Sticky top: summary + search/filter ─────────────────────── -->
    <div
      class="sticky z-30 -mx-4 px-4 bg-canvas/95 dark:bg-canvas-inverse/95 backdrop-blur border-b border-black/[0.06] dark:border-white/[0.08]"
      :style="{ top: 'var(--app-nav-h, 4rem)' }"
    >
      <!-- Search row: [scanner] [search] [filter].
           An empty <p class="py-2"> used to sit above this — the remains of a
           summary strip — adding ~24px of padding to a block that looked like
           it had none. Symmetric padding now, so the bar sits the same
           distance from the nav as it does from the results. -->
      <div class="flex items-center gap-1.5 py-3">
        <!-- Scan cards into the collection: camera, then a review sheet. -->
        <button
          type="button"
          class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-200 hover:text-pokemon-red transition-colors"
          aria-label="Scan cards"
          @click="openScanner"
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
            <path
              d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"
            />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>

        <!-- Search input — Enter dispatches the search -->
        <div class="relative flex-1 min-w-0">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft dark:text-zinc-500 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="searchInput"
            type="search"
            enterkeyhint="search"
            placeholder="Search cards"
            aria-label='Search cards to add, e.g. "pikachu 151"'
            class="w-full h-10 pl-9 pr-3 rounded-full border-0 bg-black/[0.05] dark:bg-white/[0.08] text-sm text-ink dark:text-white collection-search placeholder:text-ink-soft dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-ink/10 dark:focus:ring-white/15 [&::-webkit-search-cancel-button]:appearance-none"
            @keydown.enter.prevent="runSearch"
          />
        </div>

        <!-- Price sort: one button, three states. -->
        <button
          type="button"
          @click="cyclePrice"
          class="shrink-0 inline-flex items-center gap-0.5 h-10 px-2.5 rounded-full text-sm font-semibold transition-colors"
          :class="
            priceSort
              ? 'bg-pokemon-red/10 text-pokemon-red'
              : 'bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-200'
          "
          :aria-label="priceLabel"
          :title="priceLabel"
        >
          <span>$</span>
          <!-- Both chevrons when off, so the control reads as a sort before
               it has been touched; the active one alone once it is on. -->
          <svg
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <template v-if="priceSort === 'desc'">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </template>
            <template v-else-if="priceSort === 'asc'">
              <path d="M12 19V5M6 11l6-6 6 6" />
            </template>
            <template v-else>
              <path d="M7 20V4M3 8l4-4 4 4" />
              <path d="M17 4v16M13 16l4 4 4-4" />
            </template>
          </svg>
        </button>

        <!-- Filter toggle -->
        <button
          type="button"
          @click="filtersOpen = !filtersOpen"
          class="relative shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors"
          :class="
            filtersOpen || hasActiveFilters
              ? 'bg-pokemon-red/10 text-pokemon-red'
              : 'bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-200'
          "
          aria-label="Sort and filter"
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
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          <span
            v-if="hasActiveFilters"
            class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pokemon-red"
          />
        </button>

        <!-- "Your collection" only exists once there's an account. A guest
             gets the same row pointed at sign-in rather than a dead link to
             /profile/undefined. -->
        <NuxtLink
          :to="user ? `/profile/${user.uid}?tab=collection` : { path: '/login', query: { next: $route.fullPath } }"
          class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-200 hover:text-pokemon-red transition-colors"
          aria-label="See your collection as others do"
          title="See your collection as others do"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </NuxtLink>
      </div>

      <!-- Expandable Sort + Filter panel -->
      <Transition
        enter-active-class="transition-all duration-200"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition-all duration-150"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="filtersOpen" class="pb-3">
          <div
            class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 space-y-3"
          >
            <!-- Sort -->
            <div>
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5"
              >
                Sort
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="opt in sortOptions"
                  :key="opt.value"
                  type="button"
                  @click="baseSort = opt.value"
                  class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors"
                  :class="
                    baseSort === opt.value
                      ? 'bg-pokemon-red text-white border-pokemon-red'
                      : 'border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300'
                  "
                >
                  {{ sortLabel(opt) }}
                </button>
              </div>
            </div>

            <!-- Language -->
            <div>
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5"
              >
                Language
              </p>
              <div class="flex gap-1.5">
                <button
                  v-for="opt in languageOptions"
                  :key="opt.value"
                  type="button"
                  @click="languageFilter = opt.value"
                  class="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors"
                  :class="
                    languageFilter === opt.value
                      ? 'bg-pokemon-red text-white border-pokemon-red'
                      : 'border-gray-200 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300'
                  "
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Filter -->
            <div>
              <p
                class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5"
              >
                Filter
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  v-model="setFilter"
                  class="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
                >
                  <option value="">All sets</option>
                  <option v-for="s in setOptions" :key="s.name" :value="s.name">
                    {{ s.name }} ({{ s.count }})
                  </option>
                </select>
                <select
                  v-model="rarityFilter"
                  class="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"
                >
                  <option value="">All rarities</option>
                  <option v-for="r in rarityOptions" :key="r.name" :value="r.name">
                    {{ r.name }} ({{ r.count }})
                  </option>
                </select>
              </div>
            </div>

            <div class="flex gap-2 pt-1">
              <button
                type="button"
                @click="resetFilters"
                class="flex-1 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200"
              >
                Reset
              </button>
              <button
                type="button"
                @click="applyFilters"
                class="flex-1 py-2 rounded-lg text-sm font-semibold bg-pokemon-red text-white hover:bg-red-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Portfolio value + trend ─────────────────────────────────
         Hidden while searching: the point of a search is to look at
         candidates, not at what you already own. -->
    <section v-if="!showingSearch && count > 0" class="pt-5">
      <div class="panel surface rounded-2xl p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="eyebrow">Estimated value</p>
            <p
              class="mt-1.5 text-2xl sm:text-4xl font-bold text-ink dark:text-white tabular-price leading-none tracking-tightest"
            >
              RM {{ formatMyr(totalValue) }}
            </p>
            <!-- The card count lives beside "Your collection" below; this
                 line only adds what that one does not say. -->
            <p
              v-if="valueNote"
              class="mt-1.5 text-xs text-ink-soft dark:text-zinc-500"
            >
              {{ valueNote }}
            </p>
          </div>
        </div>

        <div class="mt-4">
          <PriceTrendChart
            :trend="valueTrend.trend"
            :loading="trendLoading"
            :height="96"
            :show-header="false"
          />
        </div>
      </div>
    </section>

    <!-- ── Your collection ─────────────────────────────────────────── -->
    <section v-if="!showingSearch" class="pt-5">
      <div v-if="collectionLoading" class="flex justify-center py-16">
        <div
          class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <div v-else-if="!collectionCards.length" class="text-center py-16">
        <p class="text-ink dark:text-white font-semibold">
          Your collection is empty
        </p>
        <p
          class="text-sm text-ink-muted dark:text-zinc-400 mt-1 max-w-sm mx-auto"
        >
          Search the TCGo catalogue above and tap + on any card to start
          tracking it.
        </p>
      </div>

      <template v-else>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="eyebrow">Your collection</h2>
          <span
            class="text-xs text-ink-soft dark:text-zinc-500 tabular-price"
          >
            <template v-if="hasOwnedFilters">
              {{ visibleCollectionCards.length }} of
            </template>
            {{ collectionCards.length }} card{{
              collectionCards.length === 1 ? "" : "s"
            }}
          </span>
        </div>
        <!-- Flat cells divided by hairlines, edge to edge on phones. Each
             cell draws its own right and bottom line; overflow-hidden clips
             the ones on the outer right edge. -->
        <div
          class="-mx-4 lg:mx-0 grid grid-cols-3 lg:grid-cols-5 overflow-hidden border-t border-black/[0.06] dark:border-white/[0.08] lg:border-x lg:rounded-xl"
        >
          <CollectionOwnedTile
            v-for="card in visibleCollectionCards"
            :key="card.productId"
            :card="card"
            :quantity="quantityOf(card.productId)"
            :change="priceChanges.get(card.productId)"
            :busy="busyIds.has(card.productId)"
            class="shadow-[1px_0_0_0_rgba(0,0,0,0.06),0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.08),0_1px_0_0_rgba(255,255,255,0.08)]"
            @menu="openManage(card)"
          />
        </div>
        <div
          v-if="!visibleCollectionCards.length"
          class="text-center py-12 px-6"
        >
          <p class="text-sm text-ink-soft dark:text-zinc-500">
            None of your cards match these filters.
          </p>
          <button
            type="button"
            @click="resetFilters"
            class="mt-3 rounded-lg bg-pokemon-red px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Clear filters
          </button>
        </div>
      </template>
    </section>

    <!-- ── Search results ──────────────────────────────────────────── -->
    <!-- The title row sits between two hairlines (the search bar's and the
         grid's), so it gets the same gap above and below. -->
    <div v-else class="pt-4">
      <div
        v-if="searchLoading && searchResults.length === 0"
        class="flex justify-center py-16"
      >
        <div
          class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red"
        />
      </div>

      <p
        v-else-if="searchResults.length === 0"
        class="text-center text-ink-soft dark:text-zinc-500 py-16 px-6"
      >
        <!-- A DPBP number will never match, so say why rather than leaving
             them to retype it. -->
        <template v-if="looksLikeDpbp">
          Japanese DP-era cards are in the catalogue, but their DPBP number
          isn't — it isn't published with the card data we use.
          <span class="block mt-2 text-ink dark:text-white font-semibold">
            Search the name and set instead, like “omanyte dp4”.
          </span>
        </template>
        <!-- A search narrowed to one language finding nothing is the single
             most confusing empty state here: "charizard mur" is a Japanese-
             only rarity, "067/082" a Japanese-only number, and the page just
             looks broken. Say which way it is narrowed, and offer the fix. -->
        <template v-else-if="languageFilter !== 'ALL'">
          No {{ languageFilter === "EN" ? "English" : "Japanese" }} cards match.
          <button
            type="button"
            @click="searchBothLanguages"
            class="mt-3 block mx-auto rounded-lg bg-pokemon-red px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Search both languages
          </button>
        </template>
        <template v-else>No matches. Try a different name, set, or rarity.</template>
      </p>

      <template v-else>
        <div class="flex items-center justify-between mb-4 gap-3">
          <h2 class="eyebrow">Search results</h2>
          <div class="flex items-center gap-3">
            <span
              class="text-xs text-ink-soft dark:text-zinc-500 tabular-price"
            >
              {{ searchResults.length }} of {{ searchTotal }}
            </span>
            <button
              type="button"
              @click="clearSearch"
              class="text-xs font-semibold text-pokemon-red hover:underline"
            >
              Back to collection
            </button>
          </div>
        </div>
        <!-- Same flat hairline grid as Your collection: owned results get
             the ⋮ manage sheet, the rest an add button. -->
        <div
          class="-mx-4 lg:mx-0 grid grid-cols-3 lg:grid-cols-5 overflow-hidden border-t border-black/[0.06] dark:border-white/[0.08] lg:border-x lg:rounded-xl"
        >
          <CollectionOwnedTile
            v-for="card in searchResults"
            :key="card.productId"
            :card="card"
            :quantity="quantityOf(card.productId)"
            :change="priceChanges.get(card.productId)"
            :busy="busyIds.has(card.productId)"
            addable
            class="shadow-[1px_0_0_0_rgba(0,0,0,0.06),0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.08),0_1px_0_0_rgba(255,255,255,0.08)]"
            @menu="openManage(card)"
            @add="handleToggle(card.productId)"
          />
        </div>
        <!-- Scrolling to the bottom IS the request for more. The sentinel sits
             below the grid and fetches when it comes near the viewport; the
             button it replaced made every extra page a decision. -->
        <div
          v-if="hasMoreResults"
          ref="loadMoreSentinel"
          class="mt-4 flex justify-center py-4"
        >
          <span
            class="h-5 w-5 animate-spin rounded-full border-2 border-black/[0.12] border-t-pokemon-red dark:border-white/[0.16] dark:border-t-pokemon-red"
            aria-hidden="true"
          />
          <span class="sr-only">Loading more results</span>
        </div>
        <p
          v-else-if="searchResults.length >= SEARCH_PAGE_SIZE"
          class="mt-4 text-center text-[12px] text-gray-400 dark:text-zinc-500"
        >
          {{ searchTotal }} result{{ searchTotal === 1 ? "" : "s" }} — that's all
        </p>
      </template>
    </div>

    <!-- Card scanning. The scanner fills the collection's own queue; the
         review sheet is where matches are checked and added. -->
    <CardScanner
      v-if="scannerOpen"
      scope="collection"
      @close="onScannerClosed"
      @finished="onScannerClosed"
    />
    <CollectionScanReview
      v-if="scanReviewOpen"
      @close="scanReviewOpen = false"
      @scan-more="openScanner"
      @search="searchFromScan"
      @added="onScanAdded"
    />
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-out"
      leave-to-class="opacity-0"
    >
      <p
        v-if="scanAddedNote"
        role="status"
        class="fixed left-1/2 -translate-x-1/2 bottom-[calc(88px+env(safe-area-inset-bottom))] lg:bottom-6 z-[60] whitespace-nowrap rounded-full bg-ink dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-ink shadow-lg"
      >
        {{ scanAddedNote }}
      </p>
    </Transition>

    <!-- Manage sheet for one owned card: the ⋮ on a tile opens it. One
         sheet, three views: the actions, then a count for "Change amount"
         or "Mark as sold", or a confirm for "Remove". -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-out"
        leave-to-class="opacity-0"
      >
        <div
          v-if="manageCard"
          class="fixed inset-0 z-[70] bg-black/40"
          @click="closeManage"
        />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        enter-from-class="translate-y-full"
        leave-active-class="transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="manageCard"
          role="dialog"
          aria-modal="true"
          :aria-label="`Manage ${manageCard.name}`"
          class="fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-md surface rounded-t-3xl border-t border-black/[0.06] dark:border-white/[0.08] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]"
        >
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15" aria-hidden="true" />
          <div class="px-2 pb-2">
            <p class="truncate text-base font-bold text-ink dark:text-white">{{ manageCard.name }}</p>
            <p class="truncate text-xs text-ink-soft dark:text-zinc-500">
              {{ manageCard.setName }} · {{ manageOwned }} owned
            </p>
          </div>

          <template v-if="manageView === 'actions'">
            <button
              v-for="action in manageActions"
              :key="action.view"
              type="button"
              class="tab-press w-full flex items-center gap-3 px-2 min-h-[52px] rounded-xl text-left text-sm font-semibold active:bg-black/[0.04] dark:active:bg-white/[0.06]"
              :class="action.view === 'remove' ? 'text-pokemon-red' : 'text-ink dark:text-white'"
              @click="startManage(action.view)"
            >
              {{ action.label }}
            </button>
          </template>

          <template v-else-if="manageView === 'remove'">
            <p class="px-2 pb-4 text-sm text-ink-muted dark:text-zinc-400">
              Remove this card and all {{ manageOwned }}
              {{ manageOwned === 1 ? "copy" : "copies" }} from your collection?
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 h-11 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-sm font-semibold text-ink dark:text-white"
                @click="manageView = 'actions'"
              >
                Cancel
              </button>
              <button
                type="button"
                class="flex-1 h-11 rounded-xl bg-pokemon-red text-sm font-semibold text-white"
                @click="confirmManage"
              >
                Remove
              </button>
            </div>
          </template>

          <template v-else>
            <p class="px-2 text-sm font-semibold text-ink dark:text-white">
              {{ manageView === "sold" ? "How many did you sell?" : "How many do you own?" }}
            </p>
            <div class="my-4 flex items-center justify-center gap-6">
              <button
                type="button"
                class="w-11 h-11 rounded-full border border-black/[0.08] dark:border-white/[0.12] inline-flex items-center justify-center text-ink dark:text-white disabled:opacity-40"
                :disabled="manageCount <= manageMin"
                aria-label="One fewer"
                @click="manageCount--"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14" /></svg>
              </button>
              <span class="min-w-[3ch] text-center text-3xl font-bold tabular-price text-ink dark:text-white" aria-live="polite">
                {{ manageCount }}
              </span>
              <button
                type="button"
                class="w-11 h-11 rounded-full border border-black/[0.08] dark:border-white/[0.12] inline-flex items-center justify-center text-ink dark:text-white disabled:opacity-40"
                :disabled="manageCount >= manageMax"
                aria-label="One more"
                @click="manageCount++"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <p v-if="manageView === 'amount' && manageCount === 0" class="px-2 -mt-2 mb-3 text-center text-xs text-pokemon-red">
              Saving 0 removes the card from your collection.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 h-11 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-sm font-semibold text-ink dark:text-white"
                @click="manageView = 'actions'"
              >
                Back
              </button>
              <button
                type="button"
                class="flex-1 h-11 rounded-xl bg-ink dark:bg-white text-sm font-semibold text-white dark:text-ink"
                @click="confirmManage"
              >
                {{ manageView === "sold" ? "Mark sold" : "Save" }}
              </button>
            </div>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// The search bar is sticky and is the first thing on this page, so the
// layout's usual top padding leaves it floating below the nav with a gap that
// only appears once you scroll. See layouts/default.vue.
definePageMeta({ flushTop: true });

import {
  type CatalogMatch,
  type CatalogSort,
  type CollectionPriceTrend,
} from "~/composables/useCardCatalog";
import { parseSearchQuery } from "~/shared/search-query";
import { priceChange, type PriceChange } from "~/shared/price-change";
import { countBy, filterOwned, sortOwned } from "~/shared/collection-sort";

useHead({ title: "Add Cards | TCGo Marketplace" });

// Divisible by 3 and 5 — the grid widths — so the last row is never
// left with empty slots at any breakpoint.
const SEARCH_PAGE_SIZE = 30;

const { user } = useAuth();
const { requireSignIn } = useSignInGate();
const {
  searchCatalog,
  getCardsByIds,
  getReleaseDates,
  listSets,
  listRarities,
  getCollectionPriceTrend,
  getPriceHistories,
} = useCardCatalog();
const {
  entries,
  count,
  totalCopies,
  quantities,
  quantityOf,
  toggleInCollection,
  setQuantity,
  markSold,
  removeFromCollection,
  listenMyCollection,
} = useUserCollection();

onBeforeRouteLeave((to) => {
  // Only a card page. Anywhere else and the search is done with.
  resumeOnReturn.value = /^\/collection\/[^/]+$/.test(to.path);
  savedScroll.value = window.scrollY;
});

onMounted(async () => {
  if (user.value) listenMyCollection();
  loadDropdowns();

  // Arriving from a card's set name. The link already existed on the card
  // page and landed here doing nothing, because nothing read the query.
  const wantedSet = route.query.set;
  if (typeof wantedSet === "string" && wantedSet.trim()) {
    setFilter.value = wantedSet;
    searchInput.value = "";
    appliedQuery.value = "";
    // Skip the saved scroll: this is a new search, not a return trip.
    resumeOnReturn.value = false;
    await runSearch();
    return;
  }

  if (!resumeOnReturn.value || !searchResults.value.length) return;
  resumeOnReturn.value = false;
  // Two frames: one for the grid to render from the results already in hand,
  // one for the card images to claim their space. Without the second the page
  // is still short and the scroll lands well above where they left.
  await nextTick();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.scrollTo(0, savedScroll.value)),
  );
});
watch(user, (u) => {
  if (u) listenMyCollection();
});

// ── Filter dropdown data ──────────────────────────────────────────────
const sets = ref<Array<{ name: string; count: number }>>([]);
const rarities = ref<Array<{ name: string; count: number }>>([]);
// Rarities from every language, for parsing only — the dropdown above stays
// English. "mur" is Mega Ultra Rare, which has no English printing, so an
// English-only list cannot resolve the word at all.
const allRarities = ref<Array<{ name: string; count: number }>>([]);
const allSets = ref<Array<{ name: string; count: number }>>([]);
// Memoised, because runSearch awaits it too: set abbreviations ("ssp", "rc")
// can only resolve once the set list is here, and a fast typist reaches the
// search button before the mount-time fetch has returned.
let dropdownsPromise: Promise<void> | null = null;
const loadDropdowns = (): Promise<void> => {
  if (dropdownsPromise) return dropdownsPromise;
  dropdownsPromise = (async () => {
    const [s, r, sAll, rAll] = await Promise.all([
      listSets("EN"),
      listRarities("EN"),
      listSets("ALL"),
      listRarities("ALL"),
    ]);
    sets.value = s;
    rarities.value = r;
    allSets.value = sAll;
    allRarities.value = rAll;
    // A failed load must not be remembered for the session: with no set list
    // "151" and "ssp" stop being recognised as sets. Let the next search retry.
    if (!sAll.length || !rAll.length) dropdownsPromise = null;
  })();
  return dropdownsPromise;
};

// ── Search + filter state ─────────────────────────────────────────────
// Price is its own axis, not one of these. Sorting by price is the thing
// people flip back and forth while scanning results, and burying it in a
// panel meant opening the panel, choosing, and applying every time.
type BaseSort = Extract<CatalogSort, "newest" | "best" | "name">;

const languageOptions = [
  { value: "ALL", label: "Both" },
  { value: "EN", label: "English" },
  { value: "JP", label: "Japanese" },
] as const;

// Newest is the set's release date, newest first, and the default (kai,
// 2026-10-19). The same choice orders the owned grid, where there is no query
// to match, so Best match reads as the order cards were added.
const sortOptions: Array<{ value: BaseSort; label: string }> = [
  { value: "newest", label: "Newest release" },
  { value: "best", label: "Best match" },
  { value: "name", label: "Name A–Z" },
];
const sortLabel = (opt: { value: BaseSort; label: string }) =>
  opt.value === "best" && !showingSearch.value ? "Recently added" : opt.label;

/** Off, then dearest first, then cheapest first, then off again. */
const PRICE_CYCLE = [null, "desc", "asc"] as const;
type PriceSort = (typeof PRICE_CYCLE)[number];

const PRICE_LABEL: Record<string, string> = {
  null: "Sort by price",
  desc: "Price: high to low",
  asc: "Price: low to high",
};

// The search outlives this page on purpose.
//
// Opening a card and pressing back used to land on an empty search box: the
// component unmounts, its refs go with it, and the reader loses both their
// results and their place in them — after scrolling through several auto-
// loaded pages to get there. useState survives navigation, so coming back is
// coming back.
const searchInput = useState("collection:query-input", () => "");
const appliedQuery = useState("collection:query", () => "");
const setFilter = useState("collection:set", () => "");
const rarityFilter = useState("collection:rarity", () => "");
// Both languages by default. Half the catalogue is Japanese — 30,470 cards —
// and an English-only default hid all of it with no way to ask for it. It was
// also the real cause behind three separate "nothing found" reports: "mur" is
// a Japanese-only rarity, "067/082" a Japanese-only number, and a Gold Star's
// Japanese printing sits beside its English one.
const languageFilter = useState<"ALL" | "EN" | "JP">("collection:language", () => "ALL");
const baseSort = useState<BaseSort>("collection:sort", () => "newest");
const priceSort = useState<PriceSort>("collection:price-sort", () => null);
const filtersOpen = ref(false);

// What actually goes to the catalogue. Price wins while it is on, and the
// panel's choice is remembered underneath it — turning price off returns to
// the sort they had, rather than resetting them to Best match.
const sortBy = computed<CatalogSort>(() =>
  priceSort.value === null
    ? baseSort.value
    : priceSort.value === "asc"
      ? "price_asc"
      : "price_desc",
);

const priceLabel = computed(() => PRICE_LABEL[String(priceSort.value)]!);

/**
 * The number printed on Japanese Diamond & Pearl cards — "DPBP#168".
 *
 * It is a continuous count across the whole era rather than a per-set number,
 * and TCGPlayer does not record it, so no amount of parsing will find the
 * card. Every Japanese DP-era card in the catalogue has no number at all. The
 * cards themselves ARE here — that Omanyte is in DP4: Moonlit Pursuit — so
 * the useful thing is to point at the search that does work.
 */
const looksLikeDpbp = computed(() =>
  /\bdpbp\s*#?\s*\d+/i.test(appliedQuery.value),
);

const searchBothLanguages = () => {
  languageFilter.value = "ALL";
  runSearch();
};

const cyclePrice = () => {
  const i = PRICE_CYCLE.indexOf(priceSort.value);
  priceSort.value = PRICE_CYCLE[(i + 1) % PRICE_CYCLE.length]!;
};

// A toggle that needs a second button pressed is not a toggle. The panel
// keeps its Apply because changing a set or rarity is a considered edit;
// flipping price is not.
watch(priceSort, () => {
  if (hasRunSearch.value) runSearch();
});

const hasActiveFilters = computed(
  () =>
    !!setFilter.value ||
    !!rarityFilter.value ||
    languageFilter.value !== "ALL" ||
    baseSort.value !== "newest",
);

// One parser for every search surface — see useCardCatalog. This page used
// to call parseSmartQuery directly, which knows about rarities and numeric
// set hints but nothing about set names or card numbers, so "reshiram rc" and
// "pikachu 012" found nothing here while working in the seller's picker.
const parsed = computed(() =>
  parseSearchQuery(
    appliedQuery.value,
    // Every language, so Japanese set codes ("sm11b", "xy3", "sv2a") resolve.
    // Two rules make that safe: a bare word can no longer swallow the whole
    // query — sets are named after Pokémon, and "Pokemon TCG Classic:
    // Charizard" would otherwise claim "charizard" — and an abbreviation that
    // several sets share resolves to whichever reading has the most sets
    // behind it rather than being dropped.
    allSets.value.map((s) => s.name),
    // Rarities, though, are worth taking from every language: "mur" is Mega
    // Ultra Rare, which has no English printing at all.
    allRarities.value.map((r) => r.name),
  ),
);

// What the reader asked for, and nothing clever on top. This used to widen
// to every language on its own whenever a query named something with no
// English printing — a patch applied three times for three symptoms of the
// English-only default that is now gone.
const effectiveLanguage = computed(() => languageFilter.value);

// What the query said, else what the dropdown says. Typing beats the dropdown
// so a smart query is not silently narrowed by a filter left over from an
// earlier search.
const effectiveSetMatch = computed(
  () => parsed.value.setHint || setFilter.value || null,
);
const effectiveRarityMatch = computed(
  () => parsed.value.rarityHint || rarityFilter.value || null,
);

const searchResults = useState<CatalogMatch[]>("collection:results", () => []);
const searchTotal = useState("collection:total", () => 0);
const searchPage = useState("collection:page", () => 0);
// Where they were, and whether returning here should put them back there.
// Only a trip into a card counts — arriving from the nav bar is a fresh visit
// and should start at the top.
const savedScroll = useState("collection:scroll", () => 0);
const resumeOnReturn = useState("collection:resume", () => false);
const searchLoading = ref(false);
const hasRunSearch = useState("collection:has-run", () => false);

// Search replaces the collection view rather than stacking below it — the
// page is either "what I own" or "what I might add", never both at once.
const showingSearch = computed(() => hasRunSearch.value);

const clearSearch = () => {
  savedScroll.value = 0;
  resumeOnReturn.value = false;
  searchInput.value = "";
  appliedQuery.value = "";
  searchResults.value = [];
  searchTotal.value = 0;
  searchPage.value = 0;
  hasRunSearch.value = false;
};

const hasMoreResults = computed(
  () => searchResults.value.length < searchTotal.value,
);

const route = useRoute();
const { dismissKeyboard } = useDismissKeyboard();

const runSearch = async () => {
  // Results are about to replace the screen; the keyboard would cover them.
  dismissKeyboard();
  appliedQuery.value = searchInput.value;
  // The set list is what turns "ssp" into Surging Sparks.
  await loadDropdowns();
  const trimmed = parsed.value.name.trim();
  // Need a name (≥2) OR a filter to search.
  if (
    trimmed.length < 2 &&
    !parsed.value.numberMatch &&
    !effectiveSetMatch.value &&
    !effectiveRarityMatch.value
  ) {
    // Nothing left to search for: an emptied box (or reset filters) means
    // "back to my collection", not "keep the last results on screen".
    if (hasRunSearch.value) clearSearch();
    return;
  }
  searchPage.value = 0;
  hasRunSearch.value = true;
  searchLoading.value = true;
  const { results, total } = await searchCatalog(trimmed, {
    limit: SEARCH_PAGE_SIZE,
    page: 0,
    language: effectiveLanguage.value,
    rarityMatches: parsed.value.rarityMatches,
    numberMatch: parsed.value.numberMatch,
    setOrNumber: parsed.value.setOrNumber,
    setMatch: effectiveSetMatch.value,
    rarityMatch: effectiveRarityMatch.value,
    sort: sortBy.value,
  });
  searchResults.value = results;
  searchTotal.value = total;
  searchLoading.value = false;
};

// Emptying the box is the way back too. A search with no matches has no
// "Back to collection" button, so without this the page stayed on "No
// matches" after the text and filters were cleared. Not via runSearch: that
// dismisses the keyboard mid-edit.
watch(searchInput, (value) => {
  if (
    hasRunSearch.value &&
    !value.trim() &&
    !setFilter.value &&
    !rarityFilter.value
  ) {
    clearSearch();
  }
});

const loadMore = async () => {
  if (searchLoading.value || !hasMoreResults.value) return;
  searchLoading.value = true;
  const nextPage = searchPage.value + 1;
  const { results } = await searchCatalog(parsed.value.name.trim(), {
    limit: SEARCH_PAGE_SIZE,
    page: nextPage,
    language: effectiveLanguage.value,
    rarityMatches: parsed.value.rarityMatches,
    // Page 2 has to be the same search as page 1. Without this a number
    // search fell back to matching the name alone as soon as you scrolled.
    numberMatch: parsed.value.numberMatch,
    setOrNumber: parsed.value.setOrNumber,
    setMatch: effectiveSetMatch.value,
    rarityMatch: effectiveRarityMatch.value,
    sort: sortBy.value,
  });
  searchResults.value = [...searchResults.value, ...results];
  searchPage.value = nextPage;
  searchLoading.value = false;
};

// Auto-load when the sentinel nears the viewport.
//
// rootMargin fetches a screenful early, so the next page is usually already
// there by the time the reader arrives and the scroll never visibly stalls.
// The sentinel lives inside a v-if, so it is watched rather than grabbed once
// on mount — it does not exist until there is a second page to load.
const loadMoreSentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

watch(loadMoreSentinel, (el) => {
  observer?.disconnect();
  if (!el || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    },
    { rootMargin: "600px 0px" },
  );
  observer.observe(el);
});

onBeforeUnmount(() => observer?.disconnect());

// On the owned grid the filters already took effect as they were chosen;
// Apply only searches when there is a search to run.
const applyFilters = () => {
  filtersOpen.value = false;
  if (hasRunSearch.value || searchInput.value.trim()) runSearch();
};

const resetFilters = () => {
  setFilter.value = "";
  rarityFilter.value = "";
  languageFilter.value = "ALL";
  baseSort.value = "newest";
  priceSort.value = null;
  if (hasRunSearch.value) runSearch();
};

// ── Collection summary (for the sticky header) ────────────────────────
// Hydrate the pivot productIds so we can sum a live estimated value.
const collectionCards = ref<CatalogMatch[]>([]);
const collectionLoading = ref(false);
const collectionProductIds = computed(() =>
  [...entries.value]
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((e) => e.productId),
);

// Portfolio trend over the same basket. getCollectionPriceTrend holds the
// basket fixed across every point, so a card with a short history can't fake a
// jump by entering the series midway — see useCardCatalog.
const valueTrend = ref<CollectionPriceTrend>({
  trend: null,
  trackedCards: 0,
  historyCards: 0,
  totalCards: 0,
});
const trendLoading = ref(false);
// Each owned card's move over PRICE_CHANGE_DAYS, for the arrow on its tile.
const priceChanges = ref(new Map<number, PriceChange | null>());
// Set release dates, for the Newest sort. Empty until they load, which leaves
// the grid in added order rather than holding it back.
const releaseDates = ref(new Map<number, string>());
const valueNote = computed(() =>
  [
    totalCopies.value !== count.value ? `${totalCopies.value} copies` : "",
    valueTrend.value.trackedCards && valueTrend.value.trackedCards < count.value
      ? `Trend from ${valueTrend.value.trackedCards} with price history`
      : "",
  ]
    .filter(Boolean)
    .join(" · "),
);

// What the grid shows: the panel's filters, then its sort. Search sends the
// same choices to the catalogue instead.
const hasOwnedFilters = computed(
  () => !!setFilter.value || !!rarityFilter.value || languageFilter.value !== "ALL",
);
const visibleCollectionCards = computed(() =>
  sortOwned(
    filterOwned(collectionCards.value, {
      set: setFilter.value,
      rarity: rarityFilter.value,
      language: languageFilter.value,
    }),
    sortBy.value,
    releaseDates.value,
  ),
);
// Owned view lists only the sets and rarities the reader has, so every
// choice finds something. Search keeps the whole catalogue's lists.
const setOptions = computed(() =>
  showingSearch.value ? sets.value : countBy(collectionCards.value, (c) => c.setName),
);
const rarityOptions = computed(() =>
  showingSearch.value ? rarities.value : countBy(collectionCards.value, (c) => c.rarity),
);

watch(
  collectionProductIds,
  async (ids) => {
    if (!ids.length) {
      collectionCards.value = [];
      priceChanges.value = new Map();
      releaseDates.value = new Map();
      valueTrend.value = {
        trend: null,
        trackedCards: 0,
        historyCards: 0,
        totalCards: 0,
      };
      return;
    }
    collectionLoading.value = true;
    trendLoading.value = true;
    try {
      // getCardsByIds does not guarantee input order, so re-sort into the
      // newest-first order the ids were built in.
      const [cards, dates] = await Promise.all([
        getCardsByIds(ids),
        getReleaseDates(ids),
      ]);
      releaseDates.value = dates;
      const rank = new Map(ids.map((id, i) => [id, i]));
      collectionCards.value = [...cards].sort(
        (a, b) => (rank.get(a.productId) ?? 0) - (rank.get(b.productId) ?? 0),
      );
    } finally {
      collectionLoading.value = false;
    }
    try {
      // One fetch feeds both the portfolio chart and the tile arrows.
      const histories = await getPriceHistories(ids);
      priceChanges.value = new Map(
        [...histories].map(([id, points]) => [id, priceChange(points)]),
      );
      valueTrend.value = await getCollectionPriceTrend(
        ids,
        30,
        quantities.value,
        histories,
      );
    } finally {
      trendLoading.value = false;
    }
  },
  { immediate: true },
);
const totalValue = computed(() =>
  // Weighted by copies — owning four of a card is four times the value.
  collectionCards.value.reduce(
    (sum, c) => sum + (c.price?.market ?? 0) * quantityOf(c.productId),
    0,
  ),
);

// ── Card scanning ─────────────────────────────────────────────────────
const { queue: scanQueue } = useScanQueue("collection");
const scannerOpen = ref(false);
const scanReviewOpen = ref(false);

const openScanner = () => {
  // The scanner has its own sign-in screen, but a guest gets further sooner
  // with the usual prompt.
  if (!requireSignIn()) return;
  scanReviewOpen.value = false;
  scannerOpen.value = true;
};

// Closing the camera with scans in hand goes to the review; with none, it
// just closes.
const onScannerClosed = () => {
  scannerOpen.value = false;
  if (scanQueue.value.length) scanReviewOpen.value = true;
};

const searchFromScan = (query: string) => {
  scanReviewOpen.value = false;
  searchInput.value = query;
  runSearch();
};

const scanAddedNote = ref("");
let scanNoteTimer: ReturnType<typeof setTimeout> | undefined;
const onScanAdded = (copies: number) => {
  if (!scanQueue.value.length) scanReviewOpen.value = false;
  scanAddedNote.value = `Added ${copies} ${copies === 1 ? "card" : "cards"} to your collection`;
  clearTimeout(scanNoteTimer);
  scanNoteTimer = setTimeout(() => (scanAddedNote.value = ""), 2600);
};

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Per-card in-flight guard. A shared boolean would freeze the whole grid
// while one card saved.
const busyIds = ref<Set<number>>(new Set());

const withBusy = async (productId: number, fn: () => Promise<void>) => {
  if (busyIds.value.has(productId)) return;
  busyIds.value = new Set(busyIds.value).add(productId);
  try {
    await fn();
  } catch (err) {
    console.error("[collection] update failed:", err);
  } finally {
    const next = new Set(busyIds.value);
    next.delete(productId);
    busyIds.value = next;
  }
};

const handleToggle = (productId: number) => {
  // Browsing is open; adding needs an account.
  if (!requireSignIn()) return;
  withBusy(productId, () => toggleInCollection(productId));
};

// ── Manage sheet (⋮ on an owned tile) ─────────────────────────────────
type ManageView = "actions" | "amount" | "sold" | "remove";
const manageActions: { view: ManageView; label: string }[] = [
  { view: "amount", label: "Change amount" },
  { view: "sold", label: "Mark as sold" },
  { view: "remove", label: "Remove from collection" },
];
const manageCard = ref<CatalogMatch | null>(null);
const manageView = ref<ManageView>("actions");
const manageCount = ref(1);
const manageOwned = computed(() =>
  manageCard.value ? quantityOf(manageCard.value.productId) : 0,
);
// Amount can go to 0 (removes the card); a sale is at least one copy and
// at most what is owned. 999 keeps a held-down + from running away.
const manageMin = computed(() => (manageView.value === "sold" ? 1 : 0));
const manageMax = computed(() =>
  manageView.value === "sold" ? manageOwned.value : 999,
);

const openManage = (card: CatalogMatch) => {
  manageCard.value = card;
  manageView.value = "actions";
};
const closeManage = () => {
  manageCard.value = null;
};
const onManageKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && manageCard.value) closeManage();
};
onMounted(() => window.addEventListener("keydown", onManageKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onManageKey));
const startManage = (view: ManageView) => {
  manageView.value = view;
  manageCount.value = view === "amount" ? manageOwned.value : 1;
};
const confirmManage = () => {
  const card = manageCard.value;
  if (!card) return;
  const view = manageView.value;
  const n = manageCount.value;
  closeManage();
  withBusy(card.productId, () =>
    view === "remove"
      ? removeFromCollection(card.productId)
      : view === "sold"
        ? markSold(card.productId, n)
        : setQuantity(card.productId, n),
  );
};
</script>

<style scoped>
/* Phones force inputs to 16px so iOS doesn't zoom on focus (tailwind.css).
   That rule is on the input, not its placeholder, so the hint can match the
   app's 14px search pill while typed text stays 16px. */
.collection-search::placeholder {
  font-size: 14px;
}
</style>

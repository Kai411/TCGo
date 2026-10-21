<template>
  <div class="max-w-5xl mx-auto">
    <!-- Loading: same skeleton as a shop listing -->
    <div v-if="loading" class="grid md:grid-cols-2 gap-6 md:gap-10" role="status" aria-label="Loading auction">
      <div class="skeleton aspect-[3.55/5] rounded-2xl w-full max-w-[18rem] mx-auto md:max-w-none" />
      <div class="space-y-4 pt-2">
        <div class="skeleton h-8 w-3/4" />
        <div class="skeleton h-3 w-1/3" />
        <div class="skeleton h-10 w-1/2" />
        <div class="skeleton h-12 w-full rounded-xl" />
        <div class="skeleton h-32 w-full rounded-xl" />
      </div>
    </div>

    <EmptyState
      v-else-if="!auction"
      headline="This auction isn't available"
      caption="It may have been removed by the seller. There are more auctions running."
    >
      <NuxtLink
        to="/auctions"
        class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
      >
        Back to auctions
      </NuxtLink>
    </EmptyState>

    <template v-else>
      <!-- Breadcrumb, desktop only: on phones the header's back arrow
           does this job. -->
      <nav aria-label="Breadcrumb" class="hidden lg:block min-w-0 mb-6">
        <ol class="flex items-center gap-1.5 text-sm text-ink-muted dark:text-zinc-400">
          <li class="shrink-0">
            <button type="button" @click="goBackToAuctions" class="hover:text-ink dark:hover:text-white transition-colors">Auctions</button>
          </li>
          <li aria-hidden="true" class="text-ink-faint dark:text-zinc-600">/</li>
          <li class="truncate text-ink dark:text-white font-medium" aria-current="page">
            {{ auction.title }}
          </li>
        </ol>
      </nav>

      <div class="grid md:grid-cols-2 gap-6 md:gap-10 md:items-start">
        <!-- ── Gallery ─────────────────────────────────────────────── -->
        <section aria-label="Photos" class="w-full max-w-[18rem] mx-auto md:max-w-none md:sticky md:top-24 lg:top-[8.75rem]">
          <div
            class="relative aspect-[3.55/5] rounded-2xl overflow-hidden"
            tabindex="0"
            role="region"
            aria-roledescription="carousel"
            :aria-label="`Photo ${activeImageIndex + 1} of ${allImages.length || 1}`"
            @keydown.left.prevent="prevImage"
            @keydown.right.prevent="nextImage"
          >
            <div
              ref="scrollContainer"
              class="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory rounded-2xl"
              style="scrollbar-width: none; -ms-overflow-style: none;"
              @scroll.passive="onImageScroll"
            >
              <div v-if="allImages.length === 0" class="w-full h-full shrink-0 snap-start">
                <CardImage src="" :alt="auction.cardName" />
              </div>
              <div
                v-for="(img, i) in allImages"
                :key="i"
                class="w-full h-full shrink-0 snap-start flex items-center justify-center"
              >
                <img
                  :src="cdnUrl(img, 900)"
                  :alt="`${auction.cardName}, photo ${i + 1}`"
                  :loading="i === 0 ? 'eager' : 'lazy'"
                  class="w-full h-full object-contain cursor-zoom-in"
                  @click="openLightbox(allImages, i)"
                />
              </div>
            </div>

            <template v-if="allImages.length > 1">
              <button
                v-if="activeImageIndex > 0"
                type="button"
                @click="prevImage"
                aria-label="Previous photo"
                class="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-ink shadow-card hover:bg-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button
                v-if="activeImageIndex < allImages.length - 1"
                type="button"
                @click="nextImage"
                aria-label="Next photo"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-ink shadow-card hover:bg-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <span
                class="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full z-10"
                aria-hidden="true"
              >
                {{ activeImageIndex + 1 }}/{{ allImages.length }}
              </span>
            </template>

            <div
              v-if="isEnded"
              class="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none"
            >
              <span class="px-3 py-1 rounded-full text-sm font-bold bg-black/70 text-white tracking-wide uppercase">Ended</span>
            </div>
          </div>

          <!-- Thumbnails -->
          <div v-if="allImages.length > 1" class="flex gap-2 mt-3 overflow-x-auto pb-1">
            <button
              v-for="(img, i) in allImages"
              :key="i"
              type="button"
              @click="scrollToImage(i)"
              :aria-label="`Show photo ${i + 1}`"
              :aria-current="activeImageIndex === i ? 'true' : undefined"
              class="w-14 h-[4.75rem] shrink-0 rounded-lg overflow-hidden ring-2 transition"
              :class="activeImageIndex === i ? 'ring-pokemon-red' : 'ring-transparent opacity-70 hover:opacity-100'"
            >
              <img :src="cdnUrl(img, 160)" alt="" class="w-full h-full object-cover" />
            </button>
          </div>
        </section>

        <!-- ── Details ─────────────────────────────────────────────── -->
        <div class="min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink dark:text-white">
                {{ auction.title }}
              </h1>
              <p v-if="auction.cardSet" class="mt-1 text-sm font-medium text-ink-muted dark:text-zinc-400">{{ auction.cardSet }}</p>
            </div>
            <div class="flex items-center gap-0.5 shrink-0 -mr-1.5 text-ink-muted dark:text-zinc-400">
              <button
                type="button"
                @click="handleShare"
                :aria-label="copied ? 'Link copied' : 'Share auction'"
                class="relative w-9 h-9 rounded-full flex items-center justify-center hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <svg v-if="!copied" class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <svg v-else class="w-[18px] h-[18px] text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span v-if="copied" role="status" class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap pointer-events-none">
                  Copied!
                </span>
              </button>
              <FavouriteButton :item-id="auction.id" item-type="auction" size="md" />
            </div>
          </div>

          <!-- Condition + quick facts -->
          <div class="flex flex-wrap items-center gap-1.5 mt-3">
            <span
              v-if="auction.productType === 'Graded' && auction.grade"
              class="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 border border-amber-600"
            >
              <span class="uppercase tracking-wide">{{ gradingProviderLabel }}</span>
              <span>{{ auction.grade }}</span>
            </span>
            <span
              v-else-if="auction.productType === 'Sealed'"
              class="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500 text-white border border-blue-700"
            >
              Sealed
            </span>
            <span
              v-else-if="auction.condition"
              class="text-xs font-semibold px-2 py-0.5 rounded-md bg-white text-ink border border-ink-faint dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600"
            >
              {{ auction.condition }}
            </span>
            <span v-if="auction.language && auction.language !== 'EN'" class="text-xs font-bold tracking-wide px-2 py-0.5 rounded-md bg-black/85 text-white">
              {{ auction.language }}
            </span>
            <span v-if="auction.isPrivate" class="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Private auction
            </span>
            <span v-if="auction.pickupAvailable" class="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Pickup available
            </span>
          </div>

          <!-- Current bid + clock -->
          <div class="mt-5">
            <p class="text-xs font-medium text-ink-muted dark:text-zinc-400">
              {{ isEnded ? (bids.length ? "Winning bid" : "Starting price") : bids.length ? "Current bid" : "Starting bid" }}
            </p>
            <div class="flex items-baseline gap-2.5">
              <p class="tabular-price text-3xl font-extrabold text-ink dark:text-white">
                <span class="text-lg font-bold text-ink-muted dark:text-zinc-400 mr-1">RM</span>{{ formatRM(auction.currentPrice) }}
              </p>
              <span class="text-sm font-semibold text-ink-muted dark:text-zinc-400 tabular-nums">
                {{ bids.length }} {{ bids.length === 1 ? "bid" : "bids" }}
              </span>
            </div>
            <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
              RM {{ formatRM(auction.minIncrement || 1) }} increments · + shipping
            </p>
            <div
              class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums"
              :class="isEnded ? 'bg-black/[0.05] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400' : 'bg-pokemon-red/10 text-pokemon-red'"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {{ isEnded ? "Auction ended" : `Ends in ${timeLeft}` }}
            </div>
            <p v-if="antiSnipeActive && !isEnded" class="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              A late bid extended the clock.
            </p>
          </div>

          <!-- Bidding -->
          <div class="mt-6 space-y-3">
            <!-- Signed out: the phone bar carries "Sign in to bid" -->
            <button
              v-if="!user && !isEnded"
              type="button"
              @click="goToLogin"
              class="hidden lg:flex w-full items-center justify-center py-3 rounded-xl text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow"
            >
              Sign in to bid
            </button>

            <div
              v-else-if="user && !isEnded && isSeller"
              class="surface rounded-xl px-4 py-3 text-sm text-center text-ink-muted dark:text-zinc-400"
            >
              This is your auction. You can't bid on it.
            </div>

            <template v-else-if="user && !isEnded && !isSeller">
              <div
                v-if="isLeadingBidder"
                class="rounded-xl px-4 py-3 bg-emerald-500/10 text-center"
              >
                <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">You're the highest bidder</p>
                <p class="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">We'll let you know if someone outbids you.</p>
              </div>

              <template v-else>
                <!-- Bid / Auto bid -->
                <div class="grid grid-cols-2 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06]" role="tablist" aria-label="Bid type">
                  <button
                    v-for="m in BID_MODES"
                    :key="m"
                    type="button"
                    role="tab"
                    :aria-selected="bidMode === m"
                    @click="bidMode = m"
                    class="py-2 rounded-lg text-sm font-semibold transition-colors"
                    :class="bidMode === m ? 'bg-white dark:bg-zinc-800 text-ink dark:text-white shadow-sm' : 'text-ink-muted dark:text-zinc-400'"
                  >
                    {{ m === "manual" ? "Bid" : "Auto bid" }}
                  </button>
                </div>

                <p v-if="bidMode === 'manual'" class="text-sm text-ink-muted dark:text-zinc-400">
                  Your bid will be
                  <span class="font-semibold text-ink dark:text-white tabular-nums">RM {{ formatRM(minBidAmount) }}</span>,
                  the current bid plus one increment.
                </p>
                <div v-else class="space-y-2">
                  <label for="auto-bid-max" class="block text-sm text-ink-muted dark:text-zinc-400">
                    Your maximum (at least RM {{ formatRM(minBidAmount) }}). We bid one increment at a time for you, up to it.
                  </label>
                  <div class="flex items-center h-12 rounded-xl border border-black/[0.10] dark:border-white/[0.12] focus-within:border-ink dark:focus-within:border-white px-4 gap-2">
                    <span class="text-sm font-semibold text-ink-muted dark:text-zinc-400">RM</span>
                    <input
                      id="auto-bid-max"
                      v-model.number="autoBidMax"
                      type="number"
                      inputmode="decimal"
                      :min="minBidAmount"
                      step="0.01"
                      :placeholder="(minBidAmount + 10).toFixed(2)"
                      class="flex-1 min-w-0 bg-transparent text-base text-ink dark:text-white placeholder:text-ink-soft dark:placeholder:text-zinc-500 outline-none tabular-nums"
                    />
                  </div>
                </div>

                <!-- Desktop button; on phones the fixed bar does this -->
                <button
                  type="button"
                  @click="bidMode === 'manual' ? handleQuickBid() : handleAutoBid()"
                  :disabled="bidding"
                  class="hidden lg:flex w-full items-center justify-center py-3 rounded-xl text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow disabled:opacity-50"
                >
                  {{ bidButtonLabel }}
                </button>
              </template>

              <p v-if="bidError" role="alert" class="text-sm text-center text-red-600 dark:text-red-400">{{ bidError }}</p>
              <p v-if="bidSuccess" role="status" class="text-sm text-center text-emerald-600 dark:text-emerald-400">{{ bidSuccess }}</p>
            </template>

            <!-- Winner + settlement -->
            <div v-if="isEnded && bids.length > 0" class="surface rounded-xl px-4 py-4 text-center">
              <p class="text-xs text-ink-muted dark:text-zinc-400">Winner</p>
              <NuxtLink
                :to="`/profile/${bids[0].bidderUid}`"
                class="text-lg font-bold text-ink dark:text-white hover:underline"
              >
                @{{ bids[0].bidder }}
              </NuxtLink>
              <p class="text-sm text-ink-muted dark:text-zinc-400 tabular-nums">Final RM {{ formatRM(bids[0].amount) }}</p>
              <!-- Settlement: the winner pays via FPX, same rail as the shop -->
              <div class="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                <p v-if="settling" class="text-xs text-ink-muted dark:text-zinc-400">
                  Finalising the result…
                </p>
                <p v-else-if="settleError" class="text-xs text-red-600 dark:text-red-400">{{ settleError }}</p>

                <p v-else-if="auctionStatus === 'expired'" class="text-xs text-ink-muted dark:text-zinc-400">
                  The winner didn't pay in time, so this auction was voided.
                </p>

                <template v-else-if="settledOrderId">
                  <!-- Paid: the order takes it from here. -->
                  <template v-if="isWinner && winnerPaid">
                    <p class="text-xs font-medium text-emerald-700 dark:text-emerald-300">Paid. The seller is preparing your order.</p>
                    <NuxtLink
                      :to="`/orders/${settledOrderId}`"
                      class="w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      View order
                    </NuxtLink>
                  </template>
                  <template v-else-if="isWinner">
                    <!-- Desktop button; on phones the fixed bar carries it, so
                         the deadline line keeps this card from looking empty. -->
                    <NuxtLink
                      :to="`/orders/${settledOrderId}`"
                      class="hidden lg:flex w-full items-center justify-center py-3 rounded-xl text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow"
                    >
                      Pay now (FPX)
                    </NuxtLink>
                    <p class="text-xs text-ink-muted dark:text-zinc-400">
                      <template v-if="paymentDueAt">Pay by {{ formatDue(paymentDueAt) }} to keep it.</template>
                      <template v-else>Pay within {{ AUCTION_PAYMENT_WINDOW_HOURS }} hours to keep it.</template>
                    </p>
                  </template>
                  <NuxtLink
                    v-else-if="isSeller"
                    :to="`/orders/${settledOrderId}`"
                    class="w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    View order
                  </NuxtLink>
                  <p v-if="isSeller" class="text-xs text-ink-muted dark:text-zinc-400">
                    You'll be notified when the buyer pays. Funds are released after delivery.
                  </p>
                </template>
              </div>
            </div>

            <div
              v-if="isEnded && bids.length === 0"
              class="surface rounded-xl px-4 py-3 text-sm text-center text-ink-muted dark:text-zinc-400"
            >
              This auction ended with no bids.
              <NuxtLink to="/auctions" class="font-semibold text-ink dark:text-white underline underline-offset-2">See live auctions</NuxtLink>
            </div>
          </div>

          <!-- Seller: the badge opens their profile; the icon messages them
               with this auction ready to attach (hidden on your own). -->
          <div class="mt-6 surface rounded-xl pl-4 pr-2 py-2 flex items-center gap-2">
            <NuxtLink
              :to="`/profile/${auction.sellerUid}`"
              class="flex-1 min-w-0 flex items-center gap-3 py-1 rounded-lg transition-opacity active:opacity-60"
            >
              <img
                v-if="sellerPhotoURL"
                :src="sellerPhotoURL"
                alt=""
                class="w-10 h-10 rounded-full object-cover"
              />
              <div
                v-else
                class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-black/[0.06] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400 text-sm font-bold"
                aria-hidden="true"
              >
                {{ (auction.seller || "?").charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-ink-muted dark:text-zinc-400">Auction by</p>
                <p class="text-sm font-semibold text-ink dark:text-white truncate">@{{ auction.seller }}</p>
              </div>
              <svg class="w-4 h-4 shrink-0 text-ink-faint dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </NuxtLink>
            <MessageButton
              :uid="auction.sellerUid"
              :product-id="auction.id"
              product-kind="auction"
              icon-only
            />
          </div>

          <!-- Description -->
          <section v-if="auction.description" class="mt-8">
            <h2 class="text-sm font-semibold text-ink dark:text-white">From the seller</h2>
            <p class="mt-2 text-sm leading-relaxed text-ink-subtle dark:text-zinc-300 whitespace-pre-line">{{ auction.description }}</p>
          </section>

          <!-- Condition notes -->
          <section v-if="auction.defects?.length" class="mt-8">
            <h2 class="text-sm font-semibold text-ink dark:text-white">Condition notes</h2>
            <ul class="mt-2 space-y-1">
              <li
                v-for="d in auction.defects"
                :key="d"
                class="flex items-start gap-2 text-sm text-ink-subtle dark:text-zinc-300"
              >
                <span class="mt-[7px] w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                {{ d }}
              </li>
            </ul>
          </section>

          <!-- Bid history -->
          <section class="mt-8">
            <h2 class="text-sm font-semibold text-ink dark:text-white">Bids ({{ bids.length }})</h2>
            <p v-if="bids.length === 0" class="mt-2 text-sm text-ink-muted dark:text-zinc-400">
              No bids yet. Be the first!
            </p>
            <ul v-else class="mt-2 max-h-72 overflow-y-auto divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              <li
                v-for="(bid, index) in bids"
                :key="bid.id"
                class="flex items-center justify-between gap-4 py-2"
              >
                <div class="min-w-0">
                  <p
                    class="text-sm font-medium truncate"
                    :class="index === 0 ? 'text-pokemon-red' : 'text-ink dark:text-white'"
                  >
                    {{ bid.bidder }}
                    <span v-if="bid.isAutoBid" class="text-xs font-normal text-ink-muted dark:text-zinc-400 ml-1">(auto)</span>
                  </p>
                  <p class="text-xs text-ink-muted dark:text-zinc-400">{{ formatTime(bid.timestamp) }}</p>
                </div>
                <p
                  class="shrink-0 text-sm font-semibold tabular-nums"
                  :class="index === 0 ? 'text-pokemon-red' : 'text-ink dark:text-white'"
                >
                  <span v-if="bid.triggeredAntiSnipe" title="Extended the clock" aria-label="Extended the clock">⚡</span>
                  RM {{ formatRM(bid.amount) }}
                </p>
              </li>
            </ul>
          </section>

          <!-- Card details -->
          <section v-if="details.length" class="mt-8">
            <h2 class="text-sm font-semibold text-ink dark:text-white">Card details</h2>
            <dl class="mt-2 divide-y divide-black/[0.06] dark:divide-white/[0.06] text-sm">
              <div v-for="row in details" :key="row.label" class="flex justify-between gap-4 py-2">
                <dt class="text-ink-muted dark:text-zinc-400">{{ row.label }}</dt>
                <dd class="text-right font-medium text-ink dark:text-white">{{ row.value }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <!-- Phone action bar: fixed where the bottom nav would be (the nav
           hides on product pages). Carries the bid, or Pay now for the
           winner. Not shown to the seller or once there's nothing to do. -->
      <!-- Teleported: the page's enter animation leaves a transform on an
           ancestor, which would pin a fixed bar to the content instead of
           the screen. -->
      <Teleport to="body">
        <div
          v-if="showActionBar"
          class="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white dark:bg-[#111114] border-t border-black/[0.06] dark:border-white/[0.08] px-4 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]"
        >
          <!-- The page's own message may be scrolled away, so the bar repeats it. -->
          <p v-if="!isEnded && (bidError || bidSuccess)" class="mb-2 text-xs font-medium text-center" :class="bidError ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'">
            {{ bidError || bidSuccess }}
          </p>
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-xs text-ink-muted dark:text-zinc-400 truncate tabular-nums">
                {{ isEnded ? (winnerPaid ? "You won · paid" : "You won") : `Ends in ${timeLeft}` }}
              </p>
              <p class="tabular-price font-extrabold text-ink dark:text-white">
              RM {{ formatRM(auction.currentPrice) }}
              <span class="ml-1 text-xs font-semibold text-ink-muted dark:text-zinc-400 tabular-nums">{{ bids.length }} {{ bids.length === 1 ? "bid" : "bids" }}</span>
            </p>
            </div>
            <NuxtLink
              v-if="isEnded && winnerPaid"
              :to="`/orders/${settledOrderId}`"
              class="h-12 px-5 shrink-0 inline-flex items-center justify-center rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white transition-transform duration-150 active:scale-[0.97]"
            >
              View order
            </NuxtLink>
            <NuxtLink
              v-else-if="isEnded"
              :to="`/orders/${settledOrderId}`"
              class="h-12 px-5 shrink-0 inline-flex items-center justify-center rounded-xl text-sm font-semibold bg-pokemon-red text-white transition-transform duration-150 active:scale-[0.97]"
            >
              Pay now (FPX)
            </NuxtLink>
            <button
              v-else-if="!user"
              type="button"
              @click="goToLogin"
              class="h-12 px-5 shrink-0 rounded-xl text-sm font-semibold bg-pokemon-red text-white transition-transform duration-150 active:scale-[0.97]"
            >
              Sign in to bid
            </button>
            <span
              v-else-if="isLeadingBidder"
              class="h-12 px-4 shrink-0 inline-flex items-center rounded-xl text-sm font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              You're winning
            </span>
            <button
              v-else
              type="button"
              @click="bidMode === 'manual' ? handleQuickBid() : handleAutoBid()"
              :disabled="bidding"
              class="h-12 px-5 shrink-0 rounded-xl text-sm font-semibold bg-pokemon-red text-white transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
            >
              {{ bidButtonLabel }}
            </button>
          </div>
        </div>
      </Teleport>
    </template>

    <!-- First bid: what a bid commits you to, said once before it happens.
         A bottom sheet on phones, a floating card from sm up. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 ease-out"
        leave-to-class="opacity-0"
      >
        <div v-if="bidIntroOpen" class="fixed inset-0 z-[70] bg-black/40" @click="bidIntroOpen = false" />
      </Transition>
      <Transition
        enter-active-class="transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        enter-from-class="translate-y-full"
        leave-active-class="transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="bidIntroOpen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bid-intro-title"
          class="fixed inset-x-0 bottom-0 z-[71] surface rounded-t-3xl border-t border-black/[0.06] dark:border-white/[0.08] px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-[420px] sm:-translate-x-1/2 sm:rounded-2xl sm:border"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15 sm:hidden" aria-hidden="true" />
          <h2 id="bid-intro-title" class="text-lg font-bold text-ink dark:text-white">Before your first bid</h2>
          <ul class="mt-3 space-y-2.5 text-[14px] leading-relaxed text-ink-muted dark:text-zinc-300">
            <li>A bid is a promise to buy at that price if you win.</li>
            <li>If you win, you have {{ AUCTION_PAYMENT_WINDOW_HOURS }} hours to pay. Not paying cancels the win and can get your bidding restricted.</li>
            <li>The seller's shipping fee is added to the winning price when you pay.</li>
          </ul>
          <button
            type="button"
            @click="confirmBidIntro"
            class="mt-5 w-full rounded-xl bg-pokemon-red py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {{ pendingBidLabel }}
          </button>
          <button
            type="button"
            @click="bidIntroOpen = false"
            class="mt-2 w-full py-2 text-sm font-semibold text-ink-soft hover:text-ink dark:hover:text-white"
          >
            Not now
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { AUCTION_PAYMENT_WINDOW_HOURS } from "~/shared/auctions";
import { readyToBuy } from "~/shared/onboarding";
import { cdnUrl } from "~/composables/useStorage";

const route = useRoute();
const auctionId = route.params.id as string;

const { auction, bids, loading, placeBid, setAutoBid } =
  useAuctionDetail(auctionId);
const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { profile: myProfile } = useMyProfile();

// Image gallery
const activeImageIndex = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);

const { openLightbox } = useLightbox();

const allImages = computed(() => {
  if (!auction.value) return [];
  if (auction.value.imageUrls && auction.value.imageUrls.length > 0)
    return auction.value.imageUrls;
  return auction.value.imageUrl ? [auction.value.imageUrl] : [];
});

const scrollToImage = (index: number) => {
  activeImageIndex.value = index;
  nextTick(() => {
    if (!scrollContainer.value) return;
    scrollContainer.value.scrollTo({ left: index * scrollContainer.value.offsetWidth, behavior: "smooth" });
  });
};

const onImageScroll = () => {
  if (!scrollContainer.value) return;
  activeImageIndex.value = Math.round(scrollContainer.value.scrollLeft / scrollContainer.value.offsetWidth);
};

const prevImage = () => scrollToImage(Math.max(0, activeImageIndex.value - 1));
const nextImage = () => scrollToImage(Math.min(allImages.value.length - 1, activeImageIndex.value + 1));

const isSeller = computed(
  () =>
    user.value && auction.value && auction.value.sellerUid === user.value.uid,
);

const isLeadingBidder = computed(() => {
  if (!user.value || !bids.value.length) return false;
  return bids.value[0].bidderUid === user.value.uid;
});

const isWinner = computed(() => isEnded.value && isLeadingBidder.value);

// ── Settlement ────────────────────────────────────────────────────────
// There's no scheduler, so the auction settles lazily: whoever opens an ended
// auction (seller or winner) triggers it. The route is idempotent, so a race
// between the two of them converges on one order.
const { authedFetch } = useAuthedFetch();
const settling = ref(false);
const settleError = ref("");
const settledOrderId = ref("");
const auctionStatus = computed(() => (auction.value as any)?.status ?? "active");
// The payment webhook marks the auction sold, so the winner stops being
// asked to pay for something they've paid for.
const winnerPaid = computed(() => auctionStatus.value === "sold");
const paymentDueAt = computed(() => Number((auction.value as any)?.paymentDueAt ?? 0));
const formatDue = (ts: number) =>
  new Date(ts).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const settle = async () => {
  if (settling.value || !user.value || !auction.value) return;
  // Only the two parties can settle; everyone else just sees the result.
  if (!isSeller.value && !isLeadingBidder.value) return;
  settling.value = true;
  settleError.value = "";
  try {
    const res = await authedFetch<{ orderId: string | null }>("/api/auctions/settle", {
      method: "POST",
      body: { auctionId },
    });
    if (res.orderId) settledOrderId.value = res.orderId;
  } catch (e: any) {
    settleError.value = e?.data?.message || e?.message || "Couldn't finalise this auction.";
  } finally {
    settling.value = false;
  }
};

// Declared above the watch below: an immediate watch reads it during setup,
// and reading a const before its declaration throws, which took the whole
// page down with a 500 on any direct link or refresh.
const isEnded = ref(false);

// Fires once the clock runs out (and on load for an already-ended auction).
watch(
  () => isEnded.value && bids.value.length > 0 && !!user.value,
  (ready) => {
    if (!ready) return;
    const existing = (auction.value as any)?.orderId;
    if (existing) {
      settledOrderId.value = existing;
      // Still call through so a lapsed payment window gets enforced.
    }
    void settle();
  },
  { immediate: true },
);

const antiSnipeActive = computed(
  () => auction.value && (auction.value as any).antiSnipeTriggered,
);

const BID_MODES = ["manual", "auto"] as const;
const bidMode = ref<(typeof BID_MODES)[number]>("manual");
const autoBidMax = ref<number | null>(null);
const bidding = ref(false);
const bidError = ref("");
const bidSuccess = ref("");

const minBidAmount = computed(() => {
  if (!auction.value) return 0;
  return auction.value.currentPrice + (auction.value.minIncrement || 1);
});

const timeLeft = ref("");
let timer: ReturnType<typeof setInterval>;

const updateTimer = () => {
  if (!auction.value) return;
  const diff = auction.value.endsAt - Date.now();
  if (diff <= 0) {
    isEnded.value = true;
    timeLeft.value = "Ended";
    clearInterval(timer);
    return;
  }
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    timeLeft.value = `${days}d ${hours % 24}h ${minutes}m`;
  } else {
    timeLeft.value = `${hours}h ${minutes}m ${seconds}s`;
  }
};

watch(auction, () => updateTimer(), { immediate: true });
onMounted(() => {
  timer = setInterval(updateTimer, 1000);
});
onUnmounted(() => {
  clearInterval(timer);
});

// Play notification sound when a new bid arrives
const prevBidCount = ref(0);

const playBidSound = () => {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {}
};

watch(
  bids,
  (newBids: any[]) => {
    if (prevBidCount.value > 0 && newBids.length > prevBidCount.value) {
      // Only play sound if the new bid is NOT from the current user
      const latestBid = newBids[0]; // bids are sorted by amount desc
      if (!user.value || latestBid.bidderUid !== user.value.uid) {
        playBidSound();
      }
    }
    prevBidCount.value = newBids.length;
  },
  { immediate: true },
);

// ── First bid ───────────────────────────────────────────────────────
//
// Two things are checked before the first bid instead of at sign-up:
// a delivery address (a win becomes an order that has to be quoted and
// shipped), and that the bidder has seen once what a bid commits them to.
// Seen is remembered on this device only — losing it shows the note again,
// which costs one tap.
const BID_INTRO_KEY = "tcgo:bid-intro-seen";
const bidIntroOpen = ref(false);
const pendingBidLabel = ref("");
let pendingBid: (() => Promise<void>) | null = null;

const bidIntroSeen = () => {
  try {
    return localStorage.getItem(BID_INTRO_KEY) === "1";
  } catch {
    return false;
  }
};

const beforeBid = (label: string, action: () => Promise<void>) => {
  // A bid is a promise to pay, so it needs a confirmed email and somewhere
  // to ship. Onboarding asks for whichever is missing and comes back here.
  if (!readyToBuy(myProfile.value, !!user.value?.emailVerified)) {
    navigateTo({ path: "/onboarding", query: { next: route.fullPath } });
    return;
  }
  if (bidIntroSeen()) {
    void action();
    return;
  }
  pendingBid = action;
  pendingBidLabel.value = label;
  bidIntroOpen.value = true;
};

const confirmBidIntro = () => {
  try {
    localStorage.setItem(BID_INTRO_KEY, "1");
  } catch {
    // Private mode: the note shows again next time, nothing worse.
  }
  bidIntroOpen.value = false;
  const action = pendingBid;
  pendingBid = null;
  if (action) void action();
};

const handleQuickBid = () =>
  beforeBid(`Place bid RM ${minBidAmount.value.toFixed(2)}`, placeQuickBid);

const placeQuickBid = async () => {
  bidError.value = "";
  bidSuccess.value = "";
  bidding.value = true;
  try {
    await placeBid(
      user.value!.uid,
      myProfile.value?.customName || user.value!.displayName || "Anonymous",
      minBidAmount.value,
    );
    bidSuccess.value = `Bid placed: RM ${minBidAmount.value.toFixed(2)}`;
  } catch (e: any) {
    bidError.value = e.message || "Failed to place bid";
  } finally {
    bidding.value = false;
  }
};

const handleAutoBid = () => {
  bidError.value = "";
  bidSuccess.value = "";
  if (!autoBidMax.value || autoBidMax.value < minBidAmount.value) {
    bidError.value = `Max bid must be at least RM ${minBidAmount.value.toFixed(2)}`;
    return;
  }
  beforeBid(`Set auto bid up to RM ${autoBidMax.value.toFixed(2)}`, placeAutoBid);
};

const placeAutoBid = async () => {
  if (!autoBidMax.value) return;
  bidding.value = true;
  try {
    await setAutoBid(
      user.value!.uid,
      myProfile.value?.customName || user.value!.displayName || "Anonymous",
      autoBidMax.value,
    );
    bidSuccess.value = `Auto bid set! Max: RM ${autoBidMax.value.toFixed(2)}`;
    autoBidMax.value = null;
  } catch (e: any) {
    bidError.value = e.message || "Failed to set auto bid";
  } finally {
    bidding.value = false;
  }
};

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();

const formatRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const goBackToAuctions = useGoBack("/auctions");

const bidButtonLabel = computed(() => {
  if (bidding.value) return bidMode.value === "manual" ? "Placing bid…" : "Setting auto bid…";
  return bidMode.value === "manual"
    ? `Bid RM ${formatRM(minBidAmount.value)}`
    : "Set auto bid";
});

// Phone bar: bidders (or signed-out visitors) while it runs, and the winner
// once there's an order to pay. The seller manages theirs from the page.
const showActionBar = computed(() => {
  if (!auction.value) return false;
  // A voided result has nothing left to pay.
  if (isEnded.value) {
    return !!(isWinner.value && settledOrderId.value) && auctionStatus.value !== "expired";
  }
  return !isSeller.value;
});

const gradingProviderLabel = computed(() => {
  const a = auction.value;
  if (!a) return "";
  return a.gradingProvider === "Others"
    ? a.customGradingProvider || "Graded"
    : a.gradingProvider;
});

// Spec sheet, same rows as a shop listing: only what the seller filled in.
const details = computed(() => {
  const a = auction.value;
  if (!a) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | number | null) => {
    if (value !== undefined && value !== null && String(value).trim())
      rows.push({ label, value: String(value) });
  };
  add("Card", a.cardName !== a.title ? a.cardName : "");
  add("Set", a.cardSet);
  add("Card number", a.cardNumber);
  add("Rarity", a.rarity);
  add("Variant", a.variant);
  add("Edition", a.edition);
  add("Language", a.language || "EN");
  if (a.productType === "Graded") {
    add("Grade", `${gradingProviderLabel.value} ${a.grade}`.trim());
    add("Cert number", a.certNumber);
  } else if (a.productType === "Sealed") {
    add("Type", "Sealed product");
  } else {
    add("Condition", a.condition);
  }
  add("Illustrator", a.artist);
  add("Starting price", `RM ${formatRM(a.startingPrice)}`);
  return rows;
});

// Share button, as on a shop listing.
const { origin } = useRequestURL();
const copied = ref(false);
const handleShare = async () => {
  if (!auction.value) return;
  const url = `${origin}/auctions/${auctionId}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: auction.value.title, text: auction.value.cardSet || "", url });
    } catch {}
  } else {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  }
};

// Seller avatar for the badge.
const { firestore } = useFirebase();
const sellerPhotoURL = ref("");
watch(
  () => auction.value?.sellerUid,
  async (uid) => {
    if (!uid) return;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const userDoc = await getDoc(doc(firestore!, "users", uid));
      if (userDoc.exists()) sellerPhotoURL.value = (userDoc.data().photoURL || "") as string;
    } catch {}
  },
  { immediate: true },
);

</script>

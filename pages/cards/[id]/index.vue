<template>
  <div class="max-w-5xl mx-auto pb-20 md:pb-0">
    <!-- Loading -->
    <div v-if="loading" class="grid md:grid-cols-2 gap-6 md:gap-10" role="status" aria-label="Loading listing">
      <div class="skeleton aspect-[3.55/5] rounded-2xl" />
      <div class="space-y-4 pt-2">
        <div class="skeleton h-3 w-1/3" />
        <div class="skeleton h-8 w-3/4" />
        <div class="skeleton h-10 w-1/2" />
        <div class="skeleton h-12 w-full rounded-xl" />
        <div class="skeleton h-32 w-full rounded-xl" />
      </div>
    </div>

    <EmptyState
      v-else-if="!card"
      headline="This listing isn't available"
      caption="It may have been removed by the seller. There are plenty more cards in the shop."
    >
      <NuxtLink
        to="/"
        class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
      >
        Back to shop
      </NuxtLink>
    </EmptyState>

    <template v-else>
      <!-- Breadcrumb + owner actions -->
      <div class="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <nav aria-label="Breadcrumb" class="min-w-0">
          <ol class="flex items-center gap-1.5 text-sm text-ink-muted dark:text-zinc-400">
            <li class="shrink-0">
              <NuxtLink to="/" class="hover:text-ink dark:hover:text-white transition-colors">Shop</NuxtLink>
            </li>
            <li aria-hidden="true" class="text-ink-faint dark:text-zinc-600">/</li>
            <li class="truncate text-ink dark:text-white font-medium" aria-current="page">
              {{ card.cardName }}
            </li>
          </ol>
        </nav>
        <NuxtLink
          v-if="isOwnListing && !card.sold"
          :to="`/cards/${card.id}/edit`"
          class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-ink dark:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.10] transition-colors"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          Edit listing
        </NuxtLink>
      </div>

      <div class="grid md:grid-cols-2 gap-6 md:gap-10 md:items-start">
        <!-- ── Gallery ─────────────────────────────────────────────── -->
        <section aria-label="Photos" class="w-full max-w-[18rem] mx-auto md:max-w-none md:sticky md:top-[5.5rem]">
          <div
            class="relative aspect-[3.55/5] rounded-2xl overflow-hidden surface p-3"
            tabindex="0"
            role="region"
            aria-roledescription="carousel"
            :aria-label="`Photo ${activeImageIndex + 1} of ${allImages.length || 1}`"
            @keydown.left.prevent="prevImage"
            @keydown.right.prevent="nextImage"
          >
            <div
              ref="scrollContainer"
              class="absolute inset-3 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory rounded-lg"
              style="scrollbar-width: none; -ms-overflow-style: none;"
              @scroll.passive="onImageScroll"
            >
              <div
                v-if="allImages.length === 0"
                class="w-full h-full shrink-0 snap-start"
              >
                <CardImage src="" :alt="card.cardName" />
              </div>
              <div
                v-for="(img, i) in allImages"
                :key="i"
                class="w-full h-full shrink-0 snap-start flex items-center justify-center"
              >
                <img
                  :src="cdnUrl(img, 900)"
                  :alt="`${card.cardName}, photo ${i + 1}`"
                  :loading="i === 0 ? 'eager' : 'lazy'"
                  class="w-full h-full object-contain"
                />
              </div>
            </div>

            <template v-if="allImages.length > 1">
              <button
                v-if="activeImageIndex > 0"
                type="button"
                @click="prevImage"
                aria-label="Previous photo"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-ink shadow-card hover:bg-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button
                v-if="activeImageIndex < allImages.length - 1"
                type="button"
                @click="nextImage"
                aria-label="Next photo"
                class="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-ink shadow-card hover:bg-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <span
                class="absolute bottom-4 right-4 bg-black/70 text-white text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full z-10"
                aria-hidden="true"
              >
                {{ activeImageIndex + 1 }}/{{ allImages.length }}
              </span>
            </template>

            <div
              v-if="card.sold"
              class="absolute inset-0 bg-black/40 flex items-center justify-center z-10"
            >
              <span class="px-3 py-1 rounded-full text-sm font-bold bg-black/70 text-white tracking-wide uppercase">Sold</span>
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
          <p v-if="card.cardSet" class="eyebrow">{{ card.cardSet }}</p>
          <div class="mt-1 flex items-start justify-between gap-3">
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink dark:text-white">
              {{ card.cardName }}
            </h1>
            <div class="flex items-center gap-0.5 shrink-0 -mr-1.5 text-ink-muted dark:text-zinc-400">
              <button
                type="button"
                @click="handleShare"
                :aria-label="copied ? 'Link copied' : 'Share listing'"
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
              <FavouriteButton :item-id="card.id" item-type="card" size="md" />
            </div>
          </div>

          <!-- Condition + quick facts -->
          <div class="flex flex-wrap items-center gap-1.5 mt-3">
            <span
              v-if="card.productType === 'Graded' && card.grade"
              class="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 border border-amber-600"
            >
              <span class="uppercase tracking-wide">{{ gradingProviderLabel }}</span>
              <span>{{ card.grade }}</span>
            </span>
            <span
              v-else-if="card.productType === 'Sealed'"
              class="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500 text-white border border-blue-700"
            >
              Sealed
            </span>
            <span
              v-else-if="card.condition"
              class="text-xs font-semibold px-2 py-0.5 rounded-md bg-white text-ink border border-ink-faint dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600"
            >
              {{ card.condition }}
            </span>
            <span v-if="card.language && card.language !== 'EN'" class="text-xs font-bold tracking-wide px-2 py-0.5 rounded-md bg-black/85 text-white">
              {{ card.language }}
            </span>
            <span v-if="card.negotiable" class="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Negotiable
            </span>
            <span v-if="card.pickupAvailable" class="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Pickup available
            </span>
          </div>

          <!-- Price -->
          <div class="mt-5">
            <p class="tabular-price text-3xl font-extrabold text-ink dark:text-white">
              <span class="text-lg font-bold text-ink-muted dark:text-zinc-400 mr-1">RM</span>{{ formatRM(card.price) }}
            </p>
            <p
              v-if="card.shippingWM || card.shippingEM"
              class="mt-1 text-sm text-ink-muted dark:text-zinc-400"
            >
              + shipping RM {{ formatRM(card.shippingWM ?? 0) }} (West) ·
              RM {{ formatRM(card.shippingEM ?? 0) }} (East Malaysia)
            </p>
            <p
              v-if="card.interestedCount > 0 && !card.sold"
              class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted dark:text-zinc-400"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-pokemon-red" aria-hidden="true" />
              {{ card.interestedCount }}
              {{ card.interestedCount === 1 ? "person has" : "people have" }}
              contacted the seller
            </p>
          </div>

          <!-- Actions -->
          <div ref="actionsEl" class="mt-6">
            <div v-if="card.sold" class="surface rounded-xl px-4 py-3 text-sm text-center text-ink-muted dark:text-zinc-400">
              This card has been sold.
              <NuxtLink to="/" class="font-semibold text-ink dark:text-white underline underline-offset-2">Find similar cards</NuxtLink>
            </div>

            <div v-else-if="!isOwnListing" class="space-y-2.5">
              <div class="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  @click="handleAddToCart"
                  :disabled="inCart"
                  class="inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:cursor-default"
                >
                  <svg v-if="!inCart" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  {{ inCart ? "In cart" : "Add to cart" }}
                </button>
                <button
                  type="button"
                  @click="openBuyNow"
                  :aria-expanded="buyNowOpen"
                  aria-controls="buy-now-panel"
                  class="inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-pokemon-red text-white hover:shadow-glow transition-shadow"
                >
                  Buy now
                </button>
              </div>
              <NuxtLink
                v-if="inCart"
                to="/cart"
                class="block text-center text-sm font-semibold text-ink dark:text-white underline underline-offset-2"
              >
                View cart
              </NuxtLink>

              <!-- Buy Now: creates a Compiled Order; payment is arranged with the seller via WhatsApp -->
              <Transition
                enter-active-class="transition duration-200 ease-premium"
                enter-from-class="opacity-0 -translate-y-1"
                leave-active-class="transition duration-150"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div v-if="buyNowOpen" id="buy-now-panel" class="surface rounded-xl p-4 space-y-4">
                  <fieldset>
                    <legend class="text-xs font-semibold text-ink-muted dark:text-zinc-400 mb-1.5">Shipping to</legend>
                    <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
                      <button
                        v-for="r in regions"
                        :key="r.value"
                        type="button"
                        @click="buyNowRegion = r.value"
                        :aria-pressed="buyNowRegion === r.value"
                        class="py-2 rounded-lg text-xs font-semibold transition-colors"
                        :class="
                          buyNowRegion === r.value
                            ? 'bg-white text-ink shadow-ring-soft dark:bg-white/[0.12] dark:text-white'
                            : 'text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white'
                        "
                      >
                        {{ r.label }}
                      </button>
                    </div>
                  </fieldset>

                  <dl class="text-sm space-y-1">
                    <div class="flex justify-between text-ink-muted dark:text-zinc-400">
                      <dt>Card</dt><dd class="tabular-price">RM {{ formatRM(card.price) }}</dd>
                    </div>
                    <div class="flex justify-between text-ink-muted dark:text-zinc-400">
                      <dt>Shipping</dt><dd class="tabular-price">RM {{ formatRM(buyNowShipping) }}</dd>
                    </div>
                    <div class="hairline flex justify-between font-semibold pt-1.5 mt-1.5 text-ink dark:text-white">
                      <dt>Total</dt><dd class="tabular-price">RM {{ formatRM(buyNowTotal) }}</dd>
                    </div>
                  </dl>

                  <button
                    v-if="!user"
                    type="button"
                    @click="signInWithGoogle"
                    class="w-full bg-ink text-white dark:bg-white dark:text-ink py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Sign in to buy
                  </button>
                  <button
                    v-else
                    type="button"
                    @click="handleBuyNow"
                    :disabled="buyNowLoading"
                    class="w-full bg-pokemon-red text-white py-3 rounded-xl text-sm font-semibold hover:shadow-glow transition-shadow disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <span v-if="buyNowLoading" class="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" aria-hidden="true" />
                    {{ buyNowLoading ? "Placing order…" : `Place order · RM ${formatRM(buyNowTotal)}` }}
                  </button>
                  <p class="text-xs text-ink-muted dark:text-zinc-400">
                    After ordering you'll arrange payment and shipping with the seller on WhatsApp.
                  </p>
                </div>
              </Transition>

              <a
                :href="whatsappLink"
                target="_blank"
                rel="noopener"
                @click="handleContactClick"
                class="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#128C4B] dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
              >
                <svg class="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Ask the seller on WhatsApp
              </a>
            </div>
          </div>

          <!-- Seller -->
          <NuxtLink
            :to="`/profile/${card.sellerUid}`"
            class="mt-6 surface rounded-xl px-4 py-3 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
          >
            <img
              v-if="sellerPhotoURL"
              :src="sellerPhotoURL"
              alt=""
              class="w-10 h-10 rounded-full object-cover"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full flex items-center justify-center bg-black/[0.06] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400 text-sm font-bold"
              aria-hidden="true"
            >
              {{ card.seller.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-ink-muted dark:text-zinc-400">Sold by</p>
              <p class="text-sm font-semibold text-ink dark:text-white truncate">@{{ card.seller }}</p>
            </div>
            <span class="text-sm font-medium text-ink-muted dark:text-zinc-400">View profile</span>
          </NuxtLink>

          <!-- Description -->
          <section v-if="card.description" class="mt-8">
            <h2 class="text-sm font-semibold text-ink dark:text-white">From the seller</h2>
            <p class="mt-2 text-sm leading-relaxed text-ink-subtle dark:text-zinc-300 whitespace-pre-line">{{ card.description }}</p>
          </section>

          <!-- Condition notes -->
          <section v-if="card.defects?.length" class="mt-8">
            <h2 class="text-sm font-semibold text-ink dark:text-white">Condition notes</h2>
            <ul class="mt-2 space-y-1">
              <li
                v-for="d in card.defects"
                :key="d"
                class="flex items-start gap-2 text-sm text-ink-subtle dark:text-zinc-300"
              >
                <span class="mt-[7px] w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                {{ d }}
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

      <!-- Mobile buy bar: appears once the main buttons scroll out of view,
           sitting just above the bottom tab bar. -->
      <Transition
        enter-active-class="transition duration-200 ease-premium"
        enter-from-class="opacity-0 translate-y-2"
        leave-active-class="transition duration-150"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="showStickyBar"
          class="md:hidden fixed inset-x-0 bottom-[80px] z-30 glass border-t px-4 py-2.5 flex items-center gap-3"
        >
          <div class="min-w-0 flex-1">
            <p class="text-xs text-ink-muted dark:text-zinc-400 truncate">{{ card.cardName }}</p>
            <p class="tabular-price font-extrabold text-ink dark:text-white">RM {{ formatRM(card.price) }}</p>
          </div>
          <button
            type="button"
            @click="handleAddToCart"
            :disabled="inCart"
            :aria-label="inCart ? 'In cart' : 'Add to cart'"
            class="w-11 h-11 shrink-0 rounded-xl border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white flex items-center justify-center"
          >
            <svg v-if="!inCart" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <svg v-else class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
          <button
            type="button"
            @click="openBuyNow"
            class="h-11 px-5 shrink-0 rounded-xl text-sm font-semibold bg-pokemon-red text-white"
          >
            Buy now
          </button>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";
import { cdnUrl } from "~/composables/useStorage";

const route = useRoute();
const cardId = route.params.id as string;

const router = useRouter();
const { cards, loading, markInterested } = useCards();
const { firestore } = useFirebase();
const { user, signInWithGoogle } = useAuth();
const { profile: myProfile } = useMyProfile();
const { createCompiledOrders } = useCompiledOrders();
const { addToCart, isInCart } = useCart();

const inCart = computed(() => (card.value ? isInCart(card.value.id) : false));

const handleAddToCart = () => {
  if (!card.value || inCart.value) return;
  addToCart({
    id: card.value.id,
    cardName: card.value.cardName,
    cardSet: card.value.cardSet || '',
    condition: card.value.condition || '',
    price: card.value.price,
    imageUrl: card.value.imageUrls?.[0] || card.value.imageUrl || '',
    seller: card.value.seller,
    sellerUid: card.value.sellerUid,
    shippingWM: card.value.shippingWM ?? 0,
    shippingEM: card.value.shippingEM ?? 0,
  });
};

// Buy Now state
const buyNowOpen = ref(false);
const buyNowRegion = ref<'WM' | 'EM'>('WM');
const buyNowLoading = ref(false);

const buyNowShipping = computed(() => {
  if (!card.value) return 0;
  return buyNowRegion.value === 'WM' ? (card.value.shippingWM ?? 0) : (card.value.shippingEM ?? 0);
});

const buyNowTotal = computed(() => {
  if (!card.value) return 0;
  return card.value.price + buyNowShipping.value;
});

const handleBuyNow = async () => {
  if (!user.value || !card.value) return;
  buyNowLoading.value = true;
  try {
    const [order] = await createCompiledOrders(
      [{
        cardId: card.value.id,
        cardName: card.value.cardName,
        cardSet: card.value.cardSet || '',
        condition: card.value.condition || '',
        imageUrl: card.value.imageUrls?.[0] || card.value.imageUrl || '',
        price: card.value.price,
        shippingWM: card.value.shippingWM ?? 0,
        shippingEM: card.value.shippingEM ?? 0,
        sellerUid: card.value.sellerUid,
        sellerName: card.value.seller,
      }],
      buyNowRegion.value,
      myProfile.value?.customName || myProfile.value?.displayName || user.value.displayName || 'Buyer',
    );
    router.push(`/orders/${order.id}?placed=1`);
  } catch (e: any) {
    alert(e?.message || 'Could not place order. Please try again.');
  } finally {
    buyNowLoading.value = false;
  }
};

const card = computed(
  () => cards.value.find((c: Card) => c.id === cardId) || null,
);

const formatRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const regions = [
  { value: "WM" as const, label: "West Malaysia" },
  { value: "EM" as const, label: "East Malaysia" },
];

const gradingProviderLabel = computed(() => {
  const c = card.value;
  if (!c) return "";
  return c.gradingProvider === "Others"
    ? c.customGradingProvider || "Graded"
    : c.gradingProvider;
});

// Spec sheet — only rows the seller actually filled in.
const details = computed(() => {
  const c = card.value;
  if (!c) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | number | null) => {
    if (value !== undefined && value !== null && String(value).trim())
      rows.push({ label, value: String(value) });
  };
  add("Set", c.cardSet);
  add("Card number", c.cardNumber);
  add("Rarity", c.rarity);
  add("Variant", c.variant);
  add("Edition", c.edition);
  add("Language", c.language || "EN");
  if (c.productType === "Graded") {
    add("Grade", `${gradingProviderLabel.value} ${c.grade}`.trim());
    add("Cert number", c.certNumber);
  } else if (c.productType === "Sealed") {
    add("Type", "Sealed product");
  } else {
    add("Condition", c.condition);
  }
  add("Illustrator", c.artist);
  return rows;
});

// Opening Buy now from the sticky bar scrolls the panel into view.
const openBuyNow = () => {
  buyNowOpen.value = true;
  nextTick(() =>
    document
      .getElementById("buy-now-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
};

// Show the mobile buy bar only while the main action buttons are off-screen.
const actionsEl = ref<HTMLElement | null>(null);
const actionsVisible = ref(true);
let actionsObserver: IntersectionObserver | null = null;
watch(actionsEl, (el) => {
  actionsObserver?.disconnect();
  if (!el) return;
  actionsObserver = new IntersectionObserver(
    ([entry]) => (actionsVisible.value = entry.isIntersecting),
    { rootMargin: "0px 0px -80px 0px" },
  );
  actionsObserver.observe(el);
});
onBeforeUnmount(() => actionsObserver?.disconnect());
const showStickyBar = computed(
  () =>
    !!card.value &&
    !card.value.sold &&
    !isOwnListing.value &&
    !actionsVisible.value,
);

const isOwnListing = computed(
  () => user.value && card.value && card.value.sellerUid === user.value.uid,
);

const { origin } = useRequestURL();
const pageUrl = computed(() => `${origin}/cards/${cardId}`);

// Per-page SEO
useHead(() => {
  if (!card.value) return { title: "Card Details | TCGo Marketplace" };
  const title = `${card.value.cardName} — RM ${card.value.price.toFixed(2)} | TCGo`;
  const description = `${card.value.cardSet}${card.value.condition ? ` · ${card.value.condition}` : ""} · Listed by ${card.value.seller} on TCGo Marketplace.`;
  const image = card.value.imageUrls?.[0] || card.value.imageUrl || `${origin}/og.webp`;
  const url = pageUrl.value;
  return {
    title,
    link: [{ rel: "canonical", href: url }],
    meta: [
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
  };
});

// Share button
const copied = ref(false);
const handleShare = async () => {
  if (!card.value) return;
  const url = pageUrl.value;
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${card.value.cardName} — RM ${card.value.price.toFixed(2)}`,
        text: `${card.value.cardSet}${card.value.condition ? ` · ${card.value.condition}` : ""}`,
        url,
      });
    } catch {}
  } else {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  }
};

const activeImageIndex = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);

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

const allImages = computed(() => {
  if (!card.value) return [];
  const imgs = card.value.imageUrls?.length ? [...card.value.imageUrls] : [];
  if (card.value.imageUrl && !imgs.includes(card.value.imageUrl)) {
    imgs.unshift(card.value.imageUrl);
  }
  return imgs;
});

const activeImage = computed(
  () => allImages.value[activeImageIndex.value] || "",
);

// Fetch seller phone for WhatsApp link
const sellerPhone = ref("");
const sellerPhotoURL = ref("");

const fetchSellerPhone = async () => {
  if (!card.value) return;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const userDoc = await getDoc(
      doc(firestore!, "users", card.value.sellerUid),
    );
    if (userDoc.exists()) {
      const data = userDoc.data();
      sellerPhone.value = (data.whatsappNumber || data.phone || "") as string;
      sellerPhotoURL.value = (data.photoURL || "") as string;
    }
  } catch {}
};

watch(
  card,
  (c: any) => {
    if (c) fetchSellerPhone();
  },
  { immediate: true },
);

const whatsappLink = computed(() => {
  if (!card.value) return "#";
  let cleanPhone = sellerPhone.value.replace(/[^0-9]/g, "");
  // Fix: strip leading 0 and prepend 60 if no country code
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "60" + cleanPhone.slice(1);
  }
  const message = encodeURIComponent(
    `Hi, I'm interested in your listing on TCGo:\n${card.value.cardName} (${card.value.cardSet}${card.value.condition ? `, ${card.value.condition}` : ""}) — RM ${card.value.price.toFixed(2)}\n${pageUrl.value}`,
  );
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${message}`;
  }
  return `https://wa.me/?text=${message}`;
});

// Track interest when contact is clicked
const hasClicked = ref(false);

const handleContactClick = async () => {
  if (hasClicked.value || !card.value) return;
  hasClicked.value = true;
  try {
    await markInterested(card.value.id);
  } catch {}
};
</script>

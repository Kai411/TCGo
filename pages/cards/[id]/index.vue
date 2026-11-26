<template>
  <div class="max-w-5xl mx-auto">
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
      caption="It may have been removed by the seller. There are plenty more cards in the Marketplace."
    >
      <NuxtLink
        to="/"
        class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
      >
        Back to Marketplace
      </NuxtLink>
    </EmptyState>

    <template v-else>
      <!-- Breadcrumb, desktop only: on phones the header's back arrow
           does this job. -->
      <nav aria-label="Breadcrumb" class="hidden lg:block min-w-0 mb-6">
        <ol class="flex items-center gap-1.5 text-sm text-ink-muted dark:text-zinc-400">
          <li class="shrink-0">
            <!-- A button, not a NuxtLink: a NuxtLink would also push "/" on
                 top of our history.back(), and that second navigation
                 scrolls to top. -->
            <button type="button" @click="goBackToShop" class="hover:text-ink dark:hover:text-white transition-colors">Marketplace</button>
          </li>
          <li aria-hidden="true" class="text-ink-faint dark:text-zinc-600">/</li>
          <li class="truncate text-ink dark:text-white font-medium" aria-current="page">
            {{ card.cardName }}
          </li>
        </ol>
      </nav>

      <div class="grid md:grid-cols-2 gap-6 md:gap-10 md:items-start">
        <!-- ── Gallery ─────────────────────────────────────────────── -->
        <section aria-label="Photos" class="w-full max-w-[15rem] sm:max-w-[18rem] mx-auto md:max-w-none md:sticky md:top-24 lg:top-[8.75rem]">
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
              v-if="!available"
              class="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none"
            >
              <span class="px-3 py-1 rounded-full text-sm font-semibold bg-black/70 text-white">{{ reserved ? "Reserved" : "Sold" }}</span>
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
              <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-ink dark:text-white text-balance">
                {{ card.cardName }}
              </h1>
              <p v-if="subtitle" class="mt-1.5 text-base text-ink-muted dark:text-zinc-400">{{ subtitle }}</p>
            </div>
            <!-- Buyers: share and save. The owner gets Edit and Share as
                 buttons below the price instead. -->
            <div v-if="!isOwnListing" class="flex items-center gap-0.5 shrink-0 -mr-1.5 text-ink-muted dark:text-zinc-400">
              <button
                type="button"
                @click="handleShare"
                :aria-label="copied ? 'Link copied' : 'Share listing'"
                class="w-10 h-10 rounded-full flex items-center justify-center hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <svg v-if="!copied" class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <svg v-else class="w-[18px] h-[18px] text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <FavouriteButton :item-id="card.id" item-type="card" size="md" />
            </div>
          </div>

          <!-- Price. Shipping is priced on the checkout page, not here. -->
          <p class="mt-5 tabular-price text-4xl font-extrabold tracking-tight text-ink dark:text-white">
            RM&nbsp;{{ formatRM(card.price) }}
          </p>

          <!-- Actions -->
          <div class="mt-6">
            <div v-if="!available" class="surface rounded-xl px-4 py-3 text-sm text-center text-ink-muted dark:text-zinc-400">
              <template v-if="reserved">Being paid for in store. Check back in a few minutes.</template>
              <template v-else>
                This card has been sold.
                <NuxtLink to="/" class="font-semibold text-ink dark:text-white underline underline-offset-2">Find similar cards</NuxtLink>
              </template>
            </div>

            <!-- Owner: manage instead of buy. -->
            <div v-else-if="isOwnListing" class="grid grid-cols-2 gap-2.5">
              <NuxtLink
                :to="`/seller/listings/${card.id}/edit`"
                class="h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink transition-transform duration-150 active:scale-[0.97]"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                Edit listing
              </NuxtLink>
              <button
                type="button"
                @click="handleShare"
                class="h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-[background-color,transform] duration-150 active:scale-[0.97]"
              >
                <svg v-if="!copied" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <svg v-else class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                {{ copied ? "Link copied" : "Share" }}
              </button>
            </div>

            <!-- Buyer, desktop. Phones get the same buttons pinned to the
                 bottom of the screen (below). -->
            <div v-else class="hidden lg:block space-y-2.5">
              <!-- Buy Now: straight to checkout with this card only; it is
                   not added to the cart. -->
              <button
                type="button"
                @click="user ? handleBuyNow() : goToLogin()"
                class="w-full h-12 inline-flex items-center justify-center rounded-xl text-[15px] font-semibold bg-pokemon-red text-white transition-transform duration-150 active:scale-[0.98]"
              >
                {{ user ? "Buy now" : "Sign in to buy" }}
              </button>
              <div class="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  @click="handleAddToCart($event)"
                  :disabled="inCart"
                  class="h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-default disabled:active:scale-100"
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
                  @click="chatWithSeller"
                  class="h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-[background-color,transform] duration-150 active:scale-[0.97]"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Chat with seller
                </button>
              </div>
            </div>
          </div>

          <!-- One spec table, no heading: only rows the seller filled in. -->
          <dl v-if="details.length" class="mt-8 border-t border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.08] text-[15px]">
            <div v-for="row in details" :key="row.label" class="flex justify-between gap-4 py-3">
              <dt class="text-ink-muted dark:text-zinc-400">{{ row.label }}</dt>
              <dd class="text-right font-medium text-ink dark:text-white">{{ row.value }}</dd>
            </div>
          </dl>

          <!-- Description -->
          <section v-if="card.description" class="mt-8">
            <h2 class="text-base font-semibold text-ink dark:text-white">Description</h2>
            <p class="mt-2 text-[15px] leading-relaxed text-ink-subtle dark:text-zinc-300 whitespace-pre-line">{{ card.description }}</p>
          </section>

          <!-- Condition notes -->
          <section v-if="card.defects?.length" class="mt-8">
            <h2 class="text-base font-semibold text-ink dark:text-white">Condition notes</h2>
            <ul class="mt-2 space-y-1">
              <li
                v-for="d in card.defects"
                :key="d"
                class="flex items-start gap-2 text-[15px] text-ink-subtle dark:text-zinc-300"
              >
                <span class="mt-[8px] w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                {{ d }}
              </li>
            </ul>
          </section>

          <!-- Seller strip. The second line is the legally required
               disclosure (shared/seller-disclosure.ts): the seller's name, or
               business name and SSM number. -->
          <div class="mt-8 surface rounded-2xl p-4 flex items-center gap-3">
            <NuxtLink :to="`/profile/${card.sellerUid}`" class="shrink-0" tabindex="-1" aria-hidden="true">
              <img
                v-if="sellerPhotoURL"
                :src="sellerPhotoURL"
                alt=""
                class="w-12 h-12 rounded-full object-cover"
              />
              <div
                v-else
                class="w-12 h-12 rounded-full flex items-center justify-center bg-black/[0.06] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400 font-bold"
              >
                {{ card.seller.charAt(0).toUpperCase() }}
              </div>
            </NuxtLink>
            <div class="flex-1 min-w-0">
              <p class="flex items-center gap-1 min-w-0">
                <NuxtLink
                  :to="`/profile/${card.sellerUid}`"
                  class="truncate font-semibold text-ink dark:text-white hover:underline underline-offset-2"
                >@{{ card.seller }}</NuxtLink>
                <svg
                  v-if="sellerVerified"
                  class="w-4 h-4 shrink-0 text-sky-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  role="img"
                  aria-label="Identity verified"
                >
                  <title>Identity verified</title>
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              </p>
              <p v-if="disclosure" class="mt-0.5 text-sm text-ink-muted dark:text-zinc-400 break-words">
                <template v-if="disclosure.type === 'business'">
                  {{ disclosure.name }}<template v-if="disclosure.ssmNumber"> · SSM <span class="tabular-nums">{{ disclosure.ssmNumber }}</span></template>
                </template>
                <template v-else>{{ disclosure.name }}</template>
              </p>
            </div>
            <NuxtLink
              :to="`/profile/${card.sellerUid}`"
              class="shrink-0 h-9 px-3.5 inline-flex items-center rounded-full text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-[background-color,transform] duration-150 active:scale-[0.97]"
            >
              View shop
            </NuxtLink>
          </div>

          <ReportListingButton
            listing-kind="card"
            :listing-id="card.id"
            :seller-uid="card.sellerUid"
            :seller-name="card.seller"
            :item-name="card.cardName"
          />
        </div>
      </div>

      <!-- Related listings: each shows only when it has something. -->
      <section v-if="moreFromSeller.length" class="mt-14" aria-labelledby="more-from-seller">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h2 id="more-from-seller" class="text-lg font-bold text-ink dark:text-white">More from @{{ card.seller }}</h2>
          <NuxtLink :to="`/profile/${card.sellerUid}`" class="text-sm font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white">See all</NuxtLink>
        </div>
        <div class="-mx-1.5 md:mx-0 grid grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
          <CardTile v-for="c in moreFromSeller" :key="c.id" :card="c" hide-seller />
        </div>
      </section>

      <section v-if="sameCardListings.length" class="mt-14" aria-labelledby="same-card">
        <h2 id="same-card" class="mb-4 text-lg font-bold text-ink dark:text-white">Other listings of this card</h2>
        <div class="-mx-1.5 md:mx-0 grid grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
          <CardTile v-for="c in sameCardListings" :key="c.id" :card="c" />
        </div>
      </section>

      <!-- Phone action bar: fixed where the bottom nav would be (the nav
           hides on product pages). Only while the card can be bought by
           someone other than its seller. -->
      <!-- Teleported: the page's enter animation leaves a transform on an
           ancestor, which would pin a fixed bar to the content instead of
           the screen. -->
      <Teleport to="body">
        <div
          v-if="available && !isOwnListing"
          class="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white dark:bg-canvas-inverse border-t border-black/[0.06] dark:border-white/[0.08] px-4 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]"
        >
          <div class="flex gap-2.5">
            <button
              type="button"
              @click="chatWithSeller"
              aria-label="Chat with seller"
              class="w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-xl border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white transition-transform duration-150 active:scale-[0.95]"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </button>
            <button
              type="button"
              @click="handleAddToCart($event)"
              :disabled="inCart"
              class="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white transition-transform duration-150 active:scale-[0.97] disabled:cursor-default disabled:active:scale-100"
            >
              <svg v-if="inCart" class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              {{ inCart ? "In cart" : "Add to cart" }}
            </button>
            <button
              type="button"
              @click="user ? handleBuyNow() : goToLogin()"
              class="flex-1 h-12 inline-flex items-center justify-center rounded-xl text-sm font-semibold bg-pokemon-red text-white transition-transform duration-150 active:scale-[0.97]"
            >
              {{ user ? "Buy now" : "Sign in to buy" }}
            </button>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatRM } from "~/shared/format-money";
import type { Card } from "~/composables/useCards";
import { isAvailable, isReserved } from "~/shared/card-availability";
import { cdnUrl } from "~/composables/useStorage";
import type { SellerDisclosure } from "~/shared/seller-disclosure";

const route = useRoute();
const cardId = route.params.id as string;

const router = useRouter();
const { cards, loading, markInterested, recordView } = useCards();
const { firestore } = useFirebase();
const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { profile: myProfile } = useMyProfile();
const { addToCart, isInCart } = useCart();

const inCart = computed(() => (card.value ? isInCart(card.value.id) : false));

// Prefer real history so the shop resumes at the same page/scroll; fall back
// to "/" for deep links opened in a fresh tab (the shop restores from its own
// session state either way).
const goBackToShop = () => {
  if (import.meta.client && window.history.state?.back) router.back();
  else router.push("/");
};

// Buyer-interest signal. Originally fired on "Contact Seller"; with that gone
// and Buy Now no longer a panel to open, adding to cart is the equivalent
// intent. Fires once per page view.
const hasClicked = ref(false);
const markIntent = () => {
  if (hasClicked.value || !card.value) return;
  hasClicked.value = true;
  markInterested(card.value.id).catch(() => {});
};

// The listing as a line item, for the cart and for Buy Now alike.
const asLineItem = () => ({
  id: card.value!.id,
  cardName: card.value!.cardName,
  cardSet: card.value!.cardSet || "",
  condition: card.value!.condition || "",
  price: card.value!.price,
  imageUrl: card.value!.imageUrls?.[0] || card.value!.imageUrl || "",
  seller: card.value!.seller,
  sellerUid: card.value!.sellerUid,
  shippingWM: card.value!.shippingWM ?? 0,
  shippingEM: card.value!.shippingEM ?? 0,
});

// Buy Now goes straight to checkout with just this card. It does NOT add it to
// the cart: a buyer who taps Buy Now and backs out shouldn't find it there.
// Checkout still owns the address, the live courier quote and the guard that
// blocks ordering when shipping can't be priced.
const { startBuyNow } = useCheckout();
const handleBuyNow = () => {
  if (!card.value) return;
  markIntent();
  startBuyNow(asLineItem());
  router.push("/checkout");
};

const { flyToCart } = useFlyToCart();

const handleAddToCart = (e?: MouseEvent) => {
  if (!card.value || inCart.value) return;
  markIntent();
  // Decorative: thumbnail flies from the button to the navbar cart icon.
  flyToCart(
    (e?.currentTarget as HTMLElement | null) ?? null,
    card.value.imageUrls?.[0] || card.value.imageUrl || "",
  );
  addToCart(asLineItem());
};


const card = computed(
  () => cards.value.find((c: Card) => c.id === cardId) || null,
);

// Availability reads both the legacy `sold` flag and the lifecycle status, so
// a card held for an in-store QR payment stops being buyable here too.
const available = computed(() => !!card.value && isAvailable(card.value));
const reserved = computed(() => !!card.value && isReserved(card.value));

const formatRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const gradingProviderLabel = computed(() => {
  const c = card.value;
  if (!c) return "";
  return c.gradingProvider === "Others"
    ? c.customGradingProvider || "Graded"
    : c.gradingProvider;
});

// "Set · number" under the title. Both live here only, not in the table.
const subtitle = computed(() => {
  const c = card.value;
  if (!c) return "";
  return [c.cardSet, c.cardNumber].map((v) => (v ?? "").toString().trim()).filter(Boolean).join(" · ");
});

// Spec sheet — only rows the seller actually filled in. Condition first: it
// is what a buyer checks first, and the page has no condition badge.
const details = computed(() => {
  const c = card.value;
  if (!c) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | number | null) => {
    if (value !== undefined && value !== null && String(value).trim())
      rows.push({ label, value: String(value) });
  };
  if (c.productType === "Graded") {
    add("Grade", `${gradingProviderLabel.value} ${c.grade}`.trim());
    add("Cert number", c.certNumber);
  } else if (c.productType === "Sealed") {
    add("Type", "Sealed product");
  } else {
    add("Condition", c.condition);
  }
  add("Rarity", c.rarity);
  add("Variant", c.variant);
  add("Edition", c.edition);
  add("Language", c.language || "EN");
  add("Illustrator", c.artist);
  if (c.pickupAvailable) add("Pickup", "Available");
  if (c.negotiable) add("Price", "Negotiable");
  return rows;
});

// Opens the chat with this listing ready to attach (same as MessageButton).
const { requireSignIn } = useSignInGate();
const chatWithSeller = () => {
  if (!card.value || !requireSignIn()) return;
  navigateTo({
    path: `/messages/${card.value.sellerUid}`,
    query: { product: card.value.id, kind: "listing" },
  });
};

// Related listings, from the cards already loaded for the shop.
const RELATED_LIMIT = 5;
const otherAvailable = computed(() =>
  card.value ? cards.value.filter((c: Card) => c.id !== card.value!.id && isAvailable(c)) : [],
);
const moreFromSeller = computed(() =>
  otherAvailable.value
    .filter((c: Card) => c.sellerUid === card.value!.sellerUid)
    .sort((a: Card, b: Card) => (b.listedAt ?? b.createdAt ?? 0) - (a.listedAt ?? a.createdAt ?? 0))
    .slice(0, RELATED_LIMIT),
);
// Same printing from other listings, cheapest first. Matches on the catalog
// id when both have one, else on name + number.
const norm = (v?: string | null) => (v ?? "").toString().trim().toLowerCase();
const sameCardListings = computed(() => {
  const c = card.value;
  if (!c) return [];
  const name = norm(c.cardName);
  const num = norm(c.cardNumber);
  return otherAvailable.value
    .filter((o: Card) => {
      if (c.productId && o.productId) return o.productId === c.productId;
      return !!num && norm(o.cardName) === name && norm(o.cardNumber) === num;
    })
    .sort((a: Card, b: Card) => a.price - b.price)
    .slice(0, RELATED_LIMIT);
});

const isOwnListing = computed(
  () => user.value && card.value && card.value.sellerUid === user.value.uid,
);

// Count a view once the listing has resolved. Waits for auth to settle so a
// seller opening their own card isn't counted; recordView dedupes per session.
const { authLoading } = useAuth();
const viewRecorded = ref(false);
watch(
  [card, authLoading],
  ([c, authBusy]) => {
    if (viewRecorded.value || !c || authBusy) return;
    if (user.value && c.sellerUid === user.value.uid) return;
    viewRecorded.value = true;
    recordView(c.id).catch(() => {});
  },
  { immediate: true },
);

const { origin } = useRequestURL();
const pageUrl = computed(() => `${origin}/cards/${cardId}`);

// Per-page SEO
useHead(() => {
  if (!card.value) return { title: "Card Details | TCGo Marketplace" };
  const title = `${card.value.cardName} — ${formatRM(card.value.price)} | TCGo`;
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
        title: `${card.value.cardName} — ${formatRM(card.value.price)}`,
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

const { openLightbox } = useLightbox();

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

// Seller avatar and verified tick for the seller strip. users/{uid} is only
// readable signed in, so signed-out visitors get the tick from the public
// disclosure (an individual's name there comes from their verified MyKad).
const sellerPhotoURL = ref("");
const sellerKycVerified = ref(false);
const disclosure = ref<SellerDisclosure | null>(null);
const sellerVerified = computed(
  () => sellerKycVerified.value || disclosure.value?.type === "individual",
);
watch(
  () => card.value?.sellerUid,
  async (uid) => {
    disclosure.value = null;
    if (!uid) return;
    try {
      disclosure.value = await $fetch<SellerDisclosure | null>(`/api/sellers/${uid}/disclosure`);
    } catch {}
  },
  { immediate: true },
);

const fetchSellerProfile = async () => {
  if (!card.value) return;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const userDoc = await getDoc(
      doc(firestore!, "users", card.value.sellerUid),
    );
    if (userDoc.exists()) {
      sellerPhotoURL.value = (userDoc.data().photoURL || "") as string;
      sellerKycVerified.value = userDoc.data().kycStatus === "verified";
    }
  } catch {}
};

watch(
  card,
  (c: any) => {
    if (c) fetchSellerProfile();
  },
  { immediate: true },
);

</script>

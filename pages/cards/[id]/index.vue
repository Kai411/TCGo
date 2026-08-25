<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="!card" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">Card not found.</p>
      <NuxtLink
        to="/"
        class="text-pokemon-blue hover:underline mt-2 inline-block text-sm"
      >
        ← Back to shop
      </NuxtLink>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-4">
        <NuxtLink
          to="/"
          class="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
        >
          ← Back to shop
        </NuxtLink>
        <NuxtLink
          v-if="isOwnListing && !card.sold"
          :to="`/inventory/listings/${card.id}/edit`"
          class="text-sm bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] px-4 py-1.5 rounded-lg text-gray-700 dark:text-zinc-200 transition-colors"
        >
          Edit Listing
        </NuxtLink>
      </div>

      <div
        class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-0">
          <!-- Images -->
          <div class="bg-gray-100 dark:bg-white/[0.02] p-4">
            <div class="relative aspect-square rounded-lg overflow-hidden bg-white dark:bg-white/[0.04]">
              <!-- Scroll-snap strip -->
              <div
                ref="scrollContainer"
                class="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
                style="scrollbar-width: none; -ms-overflow-style: none;"
                @scroll.passive="onImageScroll"
              >
                <div
                  v-if="allImages.length === 0"
                  class="w-full h-full shrink-0 snap-start flex items-center justify-center"
                >
                  <span class="text-gray-400 dark:text-zinc-500">No Image</span>
                </div>
                <div
                  v-for="(img, i) in allImages"
                  :key="i"
                  class="w-full h-full shrink-0 snap-start flex items-center justify-center"
                >
                  <img :src="img" :alt="card.cardName" class="w-full h-full object-contain" />
                </div>
              </div>

              <!-- Prev arrow -->
              <button
                v-if="allImages.length > 1 && activeImageIndex > 0"
                @click="prevImage"
                class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <!-- Next arrow -->
              <button
                v-if="allImages.length > 1 && activeImageIndex < allImages.length - 1"
                @click="nextImage"
                class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              <!-- Counter badge -->
              <span
                v-if="allImages.length > 1"
                class="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full z-10"
              >
                {{ activeImageIndex + 1 }}/{{ allImages.length }}
              </span>
            </div>

            <!-- Thumbnails -->
            <div v-if="allImages.length > 1" class="flex gap-2 mt-3">
              <button
                v-for="(img, i) in allImages"
                :key="i"
                @click="scrollToImage(i)"
                class="w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
                :class="activeImageIndex === i ? 'border-pokemon-blue' : 'border-gray-200 dark:border-white/[0.08]'"
              >
                <img :src="img" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>

          <!-- Details -->
          <div class="p-6 flex flex-col">
            <div class="flex-1">
              <div class="flex items-start justify-between gap-3">
                <h1 class="text-2xl font-bold">{{ card.cardName }}</h1>
                <div class="flex items-center gap-1.5">
                  <!-- Share button -->
                  <button
                    @click="handleShare"
                    :title="copied ? 'Link copied!' : 'Share listing'"
                    class="relative w-8 h-8 rounded-full flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <!-- share icon -->
                    <svg v-if="!copied" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    <!-- check icon after copy -->
                    <svg v-else class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <!-- "Copied!" tooltip -->
                    <span v-if="copied" class="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap pointer-events-none">
                      Copied!
                    </span>
                  </button>

                  <FavouriteButton
                    :item-id="card.id"
                    item-type="card"
                    size="md"
                  />
                  <span
                    v-if="card.sold"
                    class="bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-zinc-400 text-xs px-2 py-1 rounded-full font-medium"
                  >
                    Sold
                  </span>
                </div>
              </div>

              <p class="text-gray-500 dark:text-zinc-400 text-sm mt-1">
                <span v-if="card.cardSet">{{ card.cardSet }}</span>
                <span v-if="card.cardSet && card.condition"> · </span>
                <span
                  v-if="card.productType === 'Ungraded' && card.condition"
                  >{{ card.condition }}</span
                >
                <span v-else-if="card.productType === 'Graded'">
                  {{
                    card.gradingProvider === "Others"
                      ? card.customGradingProvider
                      : card.gradingProvider
                  }}
                  {{ card.grade }}
                </span>
                <span v-else-if="card.productType === 'Sealed'">Sealed</span>
              </p>

              <div class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-if="card.cardNumber"
                  class="bg-gray-100 dark:bg-white/[0.04] text-gray-700 dark:text-zinc-200 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  {{ card.cardNumber }}
                </span>
                <span
                  v-if="card.language && card.language !== 'EN'"
                  class="bg-black/85 text-white text-xs font-bold tracking-wide px-2 py-0.5 rounded-full"
                >
                  {{ card.language }}
                </span>
                <span
                  v-if="card.productType === 'Graded' && card.grade"
                  class="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 border border-amber-600"
                >
                  <span class="uppercase tracking-wide">{{
                    card.gradingProvider === "Others"
                      ? card.customGradingProvider || "Graded"
                      : card.gradingProvider
                  }}</span>
                  <span>{{ card.grade }}</span>
                </span>
                <span
                  v-else-if="card.productType === 'Sealed'"
                  class="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white border border-blue-700"
                >
                  Sealed
                </span>
                <span
                  v-else-if="card.productType === 'Ungraded' && card.condition"
                  class="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-ink border border-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600"
                >
                  {{ conditionShort(card.condition) }}
                </span>
                <span
                  v-if="card.pickupAvailable"
                  class="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  Pickup OK
                </span>
                <span
                  v-if="card.negotiable"
                  class="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  Negotiable
                </span>
              </div>
              <p
                v-if="card.artist"
                class="text-xs text-gray-500 dark:text-zinc-400 mt-2"
              >
                Illus. {{ card.artist }}
              </p>

              <p class="text-pokemon-red text-2xl font-bold mt-4">
                RM {{ card.price.toFixed(2) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                + shipping, quoted at checkout for your address
              </p>

              <div v-if="card.description" class="mt-4">
                <p
                  class="text-sm text-gray-600 dark:text-zinc-300 whitespace-pre-line"
                >
                  {{ card.description }}
                </p>
              </div>

              <!-- Seller Info -->
              <div
                class="mt-6 pt-4 border-t border-gray-200 dark:border-white/[0.08]"
              >
                <NuxtLink
                  :to="`/profile/${card.sellerUid}`"
                  class="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <img
                    v-if="sellerPhotoURL"
                    :src="sellerPhotoURL"
                    :alt="card.seller"
                    class="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-white/[0.08]"
                  />
                  <div
                    v-else
                    class="w-8 h-8 bg-gray-200 dark:bg-white/[0.08] rounded-full flex items-center justify-center text-gray-500 dark:text-zinc-400 text-xs font-bold"
                  >
                    {{ card.seller.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p
                      class="text-sm font-medium text-gray-900 dark:text-zinc-100"
                    >
                      {{ card.seller }}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-zinc-500">
                      Seller
                    </p>
                  </div>
                </NuxtLink>
              </div>

              <!-- Interested count -->
              <div v-if="card.interestedCount > 0" class="mt-4">
                <p class="text-xs text-gray-500 dark:text-zinc-400">
                  🔥 {{ card.interestedCount }}
                  {{ card.interestedCount === 1 ? "person" : "people" }}
                  interested
                </p>
              </div>
            </div>

            <!-- Contact Seller + Buy Now + Add to cart -->
            <div v-if="!card.sold && !isOwnListing" class="mt-6 space-y-3">
              <!-- Buy Now · adds to cart and jumps to checkout, so shipping is
                   quoted live in one place instead of two. -->
              <button
                v-if="!user"
                @click="signInWithGoogle"
                class="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-gray-700 transition-colors"
              >
                Sign in to buy
              </button>
              <button
                v-else
                @click="handleBuyNow"
                class="w-full inline-flex items-center justify-center gap-2 bg-pokemon-red text-white py-3 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M9 13h6"/></svg>
                Buy Now
              </button>

              <!-- Add to cart -->
              <button
                @click="handleAddToCart"
                :disabled="inCart"
                class="w-full inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-white/[0.08] text-ink dark:text-white py-3 rounded-lg text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-60 disabled:cursor-default"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                {{ inCart ? "In cart" : "Add to cart" }}
              </button>

              <p
                v-if="card.interestedCount > 0"
                class="text-center text-xs text-gray-400 dark:text-zinc-500"
              >
                {{ card.interestedCount }}
                {{ card.interestedCount === 1 ? "person has" : "people have" }}
                shown interest
              </p>
            </div>

            <div v-else-if="card.sold" class="mt-6">
              <div
                class="w-full text-center bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-zinc-400 py-3 rounded-lg font-medium"
              >
                This card has been sold
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Card } from "~/composables/useCards";

const route = useRoute();
const cardId = route.params.id as string;

const router = useRouter();
const { cards, loading, markInterested } = useCards();
const { firestore } = useFirebase();
const { user, signInWithGoogle } = useAuth();
const { profile: myProfile } = useMyProfile();
const { addToCart, isInCart } = useCart();

const inCart = computed(() => (card.value ? isInCart(card.value.id) : false));

// Buyer-interest signal. Originally fired on "Contact Seller"; with that gone
// and Buy Now no longer a panel to open, adding to cart is the equivalent
// intent. Fires once per page view.
const hasClicked = ref(false);
const markIntent = () => {
  if (hasClicked.value || !card.value) return;
  hasClicked.value = true;
  markInterested(card.value.id).catch(() => {});
};

// Buy Now is a shortcut, not a second checkout: add to cart, then go there.
// The cart is the only place that holds the delivery address, the live courier
// quote and the guard that blocks checkout when shipping can't be priced.
const handleBuyNow = () => {
  if (!card.value) return;
  if (!isInCart(card.value.id)) handleAddToCart();
  router.push("/cart");
};

const handleAddToCart = () => {
  if (!card.value || inCart.value) return;
  markIntent();
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


const card = computed(
  () => cards.value.find((c: Card) => c.id === cardId) || null,
);

// Short condition label — extract abbreviation from "Near Mint (NM)" format
const conditionShort = (condition: string): string => {
  const m = condition.match(/\(([^)]+)\)/);
  return m ? m[1] : condition;
};

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

// Seller avatar for the listing header.
const sellerPhotoURL = ref("");

const fetchSellerProfile = async () => {
  if (!card.value) return;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const userDoc = await getDoc(
      doc(firestore!, "users", card.value.sellerUid),
    );
    if (userDoc.exists()) {
      sellerPhotoURL.value = (userDoc.data().photoURL || "") as string;
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

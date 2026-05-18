<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="!card" class="text-center py-12">
      <p class="text-gray-500 text-lg">Card not found.</p>
      <NuxtLink
        to="/"
        class="text-pokemon-blue hover:underline mt-2 inline-block text-sm"
      >
        ← Back to shop
      </NuxtLink>
    </div>

    <template v-else>
      <NuxtLink
        to="/"
        class="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← Back to shop
      </NuxtLink>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-0">
          <!-- Images -->
          <div class="bg-gray-100 p-4">
            <div
              class="aspect-square rounded-lg overflow-hidden bg-white flex items-center justify-center"
            >
              <img
                v-if="activeImage"
                :src="activeImage"
                :alt="card.cardName"
                class="w-full h-full object-contain"
              />
              <span v-else class="text-gray-400">No Image</span>
            </div>
            <div v-if="allImages.length > 1" class="flex gap-2 mt-3">
              <button
                v-for="(img, i) in allImages"
                :key="i"
                @click="activeImageIndex = i"
                class="w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors"
                :class="
                  activeImageIndex === i
                    ? 'border-pokemon-blue'
                    : 'border-gray-200'
                "
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
                <div class="flex items-center gap-2">
                  <FavouriteButton
                    :item-id="card.id"
                    item-type="card"
                    size="md"
                  />
                  <span
                    v-if="card.sold"
                    class="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full font-medium"
                  >
                    Sold
                  </span>
                </div>
              </div>

              <p class="text-gray-500 text-sm mt-1">
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
                  class="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  {{ card.cardNumber }}
                </span>
                <span
                  v-if="card.productType"
                  class="text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-blue-100 text-blue-700':
                      card.productType === 'Ungraded',
                    'bg-purple-100 text-purple-700':
                      card.productType === 'Graded',
                    'bg-amber-100 text-amber-700':
                      card.productType === 'Sealed',
                  }"
                >
                  {{ card.productType }}
                </span>
              </div>

              <p class="text-pokemon-red text-2xl font-bold mt-4">
                RM {{ card.price.toFixed(2) }}
              </p>
              <p
                v-if="card.shippingWM || card.shippingEM"
                class="text-xs text-gray-500 mt-1"
              >
                Shipping: WM RM {{ (card.shippingWM ?? 0).toFixed(2) }} · EM RM
                {{ (card.shippingEM ?? 0).toFixed(2) }}
              </p>

              <div v-if="card.description" class="mt-4">
                <p class="text-sm text-gray-600 whitespace-pre-line">
                  {{ card.description }}
                </p>
              </div>

              <!-- Seller Info -->
              <div class="mt-6 pt-4 border-t border-gray-200">
                <NuxtLink
                  :to="`/profile/${card.sellerUid}`"
                  class="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <img
                    v-if="sellerPhotoURL"
                    :src="sellerPhotoURL"
                    :alt="card.seller"
                    class="w-8 h-8 rounded-full object-cover border border-gray-200"
                  />
                  <div
                    v-else
                    class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs font-bold"
                  >
                    {{ card.seller.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900">
                      {{ card.seller }}
                    </p>
                    <p class="text-xs text-gray-400">Seller</p>
                  </div>
                </NuxtLink>
              </div>

              <!-- Interested count -->
              <div v-if="card.interestedCount > 0" class="mt-4">
                <p class="text-xs text-gray-500">
                  🔥 {{ card.interestedCount }}
                  {{ card.interestedCount === 1 ? "person" : "people" }}
                  interested
                </p>
              </div>
            </div>

            <!-- Contact Seller Button -->
            <div v-if="!card.sold && !isOwnListing" class="mt-6">
              <a
                :href="whatsappLink"
                target="_blank"
                rel="noopener"
                @click="handleContactClick"
                class="w-full inline-flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                  />
                </svg>
                Contact Seller
              </a>
              <p
                v-if="card.interestedCount > 0"
                class="text-center text-xs text-gray-400 mt-2"
              >
                {{ card.interestedCount }}
                {{ card.interestedCount === 1 ? "person has" : "people have" }}
                shown interest
              </p>
            </div>

            <div v-else-if="card.sold" class="mt-6">
              <div
                class="w-full text-center bg-gray-100 text-gray-500 py-3 rounded-lg font-medium"
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

const { cards, loading, markInterested } = useCards();
const { firestore } = useFirebase();
const { user } = useAuth();

const card = computed(
  () => cards.value.find((c: Card) => c.id === cardId) || null,
);

const isOwnListing = computed(
  () => user.value && card.value && card.value.sellerUid === user.value.uid,
);

// Per-page SEO
useHead(() => ({
  title: card.value
    ? `${card.value.cardName} - RM ${card.value.price.toFixed(2)} | TCGo Marketplace`
    : "Card Details | TCGo Marketplace",
  meta: card.value
    ? [
        {
          name: "description",
          content: `${card.value.cardName} from ${card.value.cardSet} (${card.value.condition}) for RM ${card.value.price.toFixed(2)}. ${card.value.description || "Available on TCGo Marketplace."}`,
        },
        {
          property: "og:title",
          content: `${card.value.cardName} - RM ${card.value.price.toFixed(2)}`,
        },
        {
          property: "og:description",
          content: `${card.value.cardSet} · ${card.value.condition} · Sold by ${card.value.seller}`,
        },
        {
          property: "og:image",
          content:
            card.value.imageUrls?.[0] || card.value.imageUrl || "/og.webp",
        },
      ]
    : [],
}));

const activeImageIndex = ref(0);

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
    `Hi, I'm interested in your card: ${card.value.cardName} (${card.value.cardSet}, ${card.value.condition}) listed at RM ${card.value.price.toFixed(2)} on TCGo Marketplace.`,
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

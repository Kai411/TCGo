<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="!card || !isOwner" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg">
        Card not found or you don't have permission to edit.
      </p>
      <NuxtLink
        to="/"
        class="text-pokemon-blue hover:underline mt-2 inline-block text-sm"
        >← Back to shop</NuxtLink
      >
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold mb-6">Edit Listing</h1>

      <form id="edit-listing-form" @submit.prevent="handleSubmit" class="space-y-4 pb-36 lg:pb-0">
        <p class="text-xs text-gray-500 dark:text-zinc-400 -mt-2">
          Only the price can be changed on a live listing. To change the card
          details or photos, delete this listing and add the card again.
        </p>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Everything but price is read-only. A disabled <fieldset> greys
               out every input, select and button inside (including the
               catalogue search) without touching CardFormFields itself. -->
          <fieldset
            disabled
            aria-label="Card details (read-only)"
            class="contents"
          >
            <div class="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-60 pointer-events-none select-none">
              <CardFormFields v-model="cardForm" />

              <!-- Photos (read-only) -->
              <div
                v-if="existingImages.length > 0"
                class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-3 lg:col-span-2"
              >
                <h3 class="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  Photos
                </h3>
                <div class="grid grid-cols-4 gap-2">
                  <img
                    v-for="(url, i) in existingImages"
                    :key="'existing-' + i"
                    :src="url"
                    class="w-full aspect-square object-cover rounded-lg border border-gray-200 dark:border-white/[0.08]"
                  />
                </div>
              </div>
            </div>
          </fieldset>

          <!-- Price -->
          <div
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5"
          >
            <label
              class="block text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-2"
            >
              Price (RM) <span class="text-pokemon-red">*</span>
            </label>
            <input
              v-model.number="price"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="10.00"
              class="w-full border border-gray-300 dark:border-white/[0.10] rounded-lg px-4 py-2.5 text-gray-900 dark:text-zinc-100 placeholder-gray-400 focus:border-pokemon-blue focus:outline-none focus:ring-1 focus:ring-pokemon-blue"
            />
          </div>

          <!-- Shipping -->
          <div
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-3"
          >
            <h3 class="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Shipping
            </h3>
            <p class="text-xs text-gray-500 dark:text-zinc-400">
              Buyers are quoted a live courier rate from your pickup address to
              theirs at checkout — there's no price to set per listing.
              <NuxtLink to="/seller/verify" class="text-pokemon-red hover:underline">
                Check your pickup address →
              </NuxtLink>
            </p>
          </div>
        </div>

        <div
          v-if="error"
          class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm"
        >
          {{ error }}
        </div>

      </form>

      <!-- Actions: fixed above bottom-nav on mobile, sticky bottom on desktop -->
      <div class="fixed bottom-20 inset-x-0 z-30 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-white/[0.10] px-4 py-3 space-y-2 lg:sticky lg:bottom-0 lg:inset-x-auto lg:mt-4 lg:rounded-xl lg:border lg:border-gray-200 dark:lg:border-white/[0.08] lg:px-4 lg:py-4">
        <div class="flex gap-3">
          <NuxtLink
            :to="`/cards/${cardId}`"
            class="flex-1 text-center py-3 rounded-lg border border-gray-300 dark:border-white/[0.10] text-gray-600 dark:text-zinc-300 font-medium hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            form="edit-listing-form"
            :disabled="submitting"
            class="flex-1 bg-pokemon-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {{ submitting ? "Saving..." : "Save Changes" }}
          </button>
        </div>
        <button
          type="button"
          @click="handleDelete"
          :disabled="deleting"
          class="w-full py-3 rounded-lg border border-red-300 dark:border-red-500/30 text-pokemon-red font-medium hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {{ deleting ? "Deleting..." : "Delete Listing" }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import type { CardFormData } from "~/components/CardFormFields.vue";
import type { Card } from "~/composables/useCards";

definePageMeta({ layout: "seller" });

const route = useRoute();
const router = useRouter();
const cardId = route.params.id as string;

const { cards, loading, deleteCard } = useCards();
const { firestore } = useFirebase();
const { user } = useAuth();

const card = computed(
  () => cards.value.find((c: Card) => c.id === cardId) || null,
);
const isOwner = computed(
  () => user.value && card.value && card.value.sellerUid === user.value.uid,
);

const cardForm = ref<CardFormData>({
  productType: "Ungraded",
  cardName: "",
  cardSet: "",
  cardNumber: "",
  condition: "",
  gradingProvider: "",
  grade: "",
  customGradingProvider: "",
  description: "",
  language: "EN",
  tcgType: "Pokemon",
  rarity: "",
  variant: "",
  edition: "",
  artist: "",
  certNumber: "",
  quantity: 1,
  negotiable: false,
  pickupAvailable: false,
});

const price = ref<number | null>(null);
const existingImages = ref<string[]>([]);
const submitting = ref(false);
const error = ref("");

// Pre-fill from existing card
watch(
  card,
  (c: any) => {
    if (c) {
      cardForm.value = {
        productType: c.productType || "Ungraded",
        cardName: c.cardName || "",
        cardSet: c.cardSet || "",
        cardNumber: c.cardNumber || "",
        condition: c.condition || "",
        gradingProvider: c.gradingProvider || "",
        grade: c.grade || "",
        customGradingProvider: c.customGradingProvider || "",
        description: c.description || "",
        language: c.language || "EN",
        tcgType: c.tcgType || "Pokemon",
        rarity: c.rarity || "",
        variant: c.variant || "",
        edition: c.edition || "",
        artist: c.artist || "",
        certNumber: c.certNumber || "",
        quantity: c.quantity ?? 1,
        negotiable: c.negotiable === true,
        pickupAvailable: c.pickupAvailable === true,
      };
      price.value = c.price;
      existingImages.value = [
        ...(c.imageUrls?.length ? c.imageUrls : c.imageUrl ? [c.imageUrl] : []),
      ];
    }
  },
  { immediate: true },
);

const handleSubmit = async () => {
  error.value = "";
  if (!price.value || price.value <= 0) {
    error.value = "Price must be greater than 0";
    return;
  }

  submitting.value = true;
  try {
    // Price is the only editable field on a live listing — card details and
    // photos are locked so buyers see what was originally listed.
    const cardDoc = doc(firestore!, "cards", cardId);
    await updateDoc(cardDoc, { price: price.value });
    // Keep the mirrored inventory row's list price in step.
    try {
      const snap = await getDocs(
        query(collection(firestore!, "inventory"), where("listingId", "==", cardId)),
      );
      await Promise.all(
        snap.docs.map((d) => updateDoc(d.ref, { listPrice: price.value, updatedAt: Date.now() })),
      );
    } catch {}

    await router.push(`/cards/${cardId}`);
  } catch (e: any) {
    error.value = e.message || "Failed to save changes";
  } finally {
    submitting.value = false;
  }
};

const deleting = ref(false);

const handleDelete = async () => {
  if (
    !window.confirm(
      "Are you sure you want to delete this listing? This cannot be undone.",
    )
  )
    return;
  deleting.value = true;
  try {
    await deleteCard(cardId);
    await router.push("/seller/listings");
  } catch (e: any) {
    error.value = e.message || "Failed to delete listing";
  } finally {
    deleting.value = false;
  }
};
</script>

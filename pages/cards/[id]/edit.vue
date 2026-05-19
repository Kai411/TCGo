<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
      ></div>
    </div>

    <div v-else-if="!card || !isOwner" class="text-center py-12">
      <p class="text-gray-500 text-lg">
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

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardFormFields
            v-model="cardForm"
            @import-image="handleImportImage"
          />

          <!-- Card: Photos -->
          <div
            class="bg-white rounded-xl border border-gray-200 p-5 space-y-3 lg:col-span-2"
          >
            <h3 class="text-sm font-semibold text-gray-900">Photos</h3>

            <!-- Existing images -->
            <div
              v-if="existingImages.length > 0"
              class="grid grid-cols-4 gap-2"
            >
              <div
                v-for="(url, i) in existingImages"
                :key="'existing-' + i"
                class="relative group"
              >
                <img
                  :src="url"
                  class="w-full aspect-square object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  @click="removeExistingImage(i)"
                  class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Upload new -->
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-pokemon-blue transition-colors cursor-pointer"
              @click="triggerFileInput"
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleFileSelect"
              />
              <p class="text-sm text-gray-400">Add more photos</p>
            </div>

            <div v-if="newFiles.length > 0" class="grid grid-cols-4 gap-2">
              <div
                v-for="(file, i) in newFiles"
                :key="'new-' + i"
                class="relative group"
              >
                <img
                  :src="file.preview"
                  class="w-full aspect-square object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  @click="removeNewFile(i)"
                  class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Price -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <label class="block text-sm font-semibold text-gray-900 mb-2">
              Price (RM) <span class="text-pokemon-red">*</span>
            </label>
            <input
              v-model.number="price"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="10.00"
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-blue focus:outline-none focus:ring-1 focus:ring-pokemon-blue"
            />
          </div>

          <!-- Shipping -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 class="text-sm font-semibold text-gray-900">Shipping</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-600 mb-1"
                  >West Malaysia (RM)</label
                >
                <input
                  v-model.number="cardForm.shippingWM"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1"
                  >East Malaysia (RM)</label
                >
                <input
                  v-model.number="cardForm.shippingEM"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="error"
          class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm"
        >
          {{ error }}
        </div>

        <div class="flex gap-3">
          <NuxtLink
            :to="`/cards/${cardId}`"
            class="flex-1 text-center py-3 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            :disabled="submitting"
            class="flex-1 bg-pokemon-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {{ submitting ? "Saving..." : "Save Changes" }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { doc, updateDoc } from "firebase/firestore";
import type { CardFormData } from "~/components/CardFormFields.vue";
import type { Card } from "~/composables/useCards";

const route = useRoute();
const router = useRouter();
const cardId = route.params.id as string;

const { cards, loading } = useCards();
const { firestore } = useFirebase();
const { user } = useAuth();
const { uploadAuctionImages } = useStorage();

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
  shippingWM: 8,
  shippingEM: 12,
});

const price = ref<number | null>(null);
const existingImages = ref<string[]>([]);
const newFiles = ref<{ file: File; preview: string }[]>([]);
const importedImageUrl = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
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
        shippingWM: c.shippingWM ?? 8,
        shippingEM: c.shippingEM ?? 12,
      };
      price.value = c.price;
      existingImages.value = [
        ...(c.imageUrls?.length ? c.imageUrls : c.imageUrl ? [c.imageUrl] : []),
      ];
    }
  },
  { immediate: true },
);

const handleImportImage = (url: string) => {
  importedImageUrl.value = url;
  existingImages.value.push(url);
};

const triggerFileInput = () => fileInput.value?.click();

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    if (file.size > 5 * 1024 * 1024) continue;
    newFiles.value.push({ file, preview: URL.createObjectURL(file) });
  }
};

const removeExistingImage = (index: number) => {
  existingImages.value.splice(index, 1);
};

const removeNewFile = (index: number) => {
  URL.revokeObjectURL(newFiles.value[index].preview);
  newFiles.value.splice(index, 1);
};

const handleSubmit = async () => {
  error.value = "";
  if (!price.value || price.value <= 0) {
    error.value = "Price must be greater than 0";
    return;
  }
  if (existingImages.value.length === 0 && newFiles.value.length === 0) {
    error.value = "At least one photo is required";
    return;
  }

  submitting.value = true;
  try {
    // Upload new files
    let allImages = [...existingImages.value];
    if (newFiles.value.length > 0) {
      for (const { file } of newFiles.value) {
        const urls = await uploadAuctionImages([file]);
        allImages.push(...urls);
      }
    }

    const cardDoc = doc(firestore!, "cards", cardId);
    await updateDoc(cardDoc, {
      cardName: cardForm.value.cardName,
      cardSet: cardForm.value.cardSet,
      cardNumber: cardForm.value.cardNumber,
      productType: cardForm.value.productType,
      condition: cardForm.value.condition,
      gradingProvider: cardForm.value.gradingProvider,
      grade: cardForm.value.grade,
      customGradingProvider: cardForm.value.customGradingProvider,
      description: cardForm.value.description,
      price: price.value,
      shippingWM: cardForm.value.shippingWM,
      shippingEM: cardForm.value.shippingEM,
      imageUrl: allImages[0] || "",
      imageUrls: allImages,
    });

    newFiles.value.forEach((f) => URL.revokeObjectURL(f.preview));
    await router.push(`/cards/${cardId}`);
  } catch (e: any) {
    error.value = e.message || "Failed to save changes";
  } finally {
    submitting.value = false;
  }
};
</script>

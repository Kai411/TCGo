<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 text-lg mb-4">
        You need to sign in to list a card.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold mb-6">List Card for Sale</h1>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardFormFields
            v-model="cardForm"
            @import-image="handleImportImage"
          />

          <!-- Card: Photos (full width) -->
          <div
            class="bg-white rounded-xl border border-gray-200 p-5 space-y-3 lg:col-span-2"
          >
            <h3 class="text-sm font-semibold text-gray-900">
              Photos <span class="text-pokemon-red">*</span>
            </h3>
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-pokemon-blue transition-colors cursor-pointer"
              @click="triggerFileInput"
              @dragover.prevent="dragOver = true"
              @dragleave="dragOver = false"
              @drop.prevent="handleDrop"
              :class="{ 'border-pokemon-blue bg-blue-50': dragOver }"
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleFileSelect"
              />
              <div class="text-gray-400">
                <svg
                  class="mx-auto h-8 w-8 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p class="text-sm">Click or drag photos here</p>
                <p class="text-xs text-gray-400 mt-1">
                  PNG, JPG, WEBP up to 5MB each
                </p>
              </div>
            </div>

            <div v-if="selectedFiles.length > 0" class="grid grid-cols-4 gap-2">
              <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="relative group"
              >
                <img
                  :src="file.preview"
                  class="w-full aspect-square object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  @click="removeFile(index)"
                  class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Card: Price -->
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

          <!-- Card: Shipping -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900">Shipping</h3>
              <span class="text-xs text-gray-400">Profile defaults</span>
            </div>
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

        <div
          v-if="uploading"
          class="bg-blue-50 border border-blue-200 rounded-lg p-3"
        >
          <div class="flex items-center gap-3">
            <div
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-pokemon-blue"
            ></div>
            <span class="text-sm text-gray-600">
              Uploading photos... {{ uploadProgress }}/{{
                selectedFiles.length
              }}
            </span>
          </div>
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full bg-pokemon-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitting ? "Listing..." : "List for Sale" }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CardFormData } from "~/components/CardFormFields.vue";

const router = useRouter();
const { createCard } = useCards();
const { uploadAuctionImages } = useStorage();
const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();

// Unsaved changes guard
const formDirty = computed(() => {
  return (
    cardForm.value.cardName !== "" ||
    cardForm.value.cardSet !== "" ||
    cardForm.value.description !== "" ||
    selectedFiles.value.length > 0 ||
    (price.value !== null && price.value > 0)
  );
});

const submitted = ref(false);

onBeforeRouteLeave(() => {
  if (formDirty.value && !submitted.value) {
    const answer = window.confirm(
      "You have unsaved changes. Are you sure you want to leave?",
    );
    if (!answer) return false;
  }
});

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (formDirty.value && !submitted.value) {
    e.preventDefault();
  }
};

interface SelectedFile {
  file: File;
  preview: string;
}

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<SelectedFile[]>([]);
const dragOver = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);

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
const submitting = ref(false);
const error = ref("");

// Pre-fill shipping from profile
watch(
  profile,
  (p: any) => {
    if (p) {
      cardForm.value.shippingWM = p.shippingWM ?? 8;
      cardForm.value.shippingEM = p.shippingEM ?? 12;
    }
  },
  { immediate: true },
);

const triggerFileInput = () => fileInput.value?.click();

// Handle imported image from Collectr/Shiny
const importedImageUrl = ref("");
const handleImportImage = (url: string) => {
  importedImageUrl.value = url;
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) addFiles(Array.from(input.files));
};

const handleDrop = (event: DragEvent) => {
  dragOver.value = false;
  if (event.dataTransfer?.files) addFiles(Array.from(event.dataTransfer.files));
};

const addFiles = (files: File[]) => {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 5 * 1024 * 1024) {
      error.value = `${file.name} is too large (max 5MB)`;
      continue;
    }
    if (selectedFiles.value.length >= 10) {
      error.value = "Maximum 10 photos";
      break;
    }
    selectedFiles.value.push({ file, preview: URL.createObjectURL(file) });
  }
};

const removeFile = (index: number) => {
  URL.revokeObjectURL(selectedFiles.value[index].preview);
  selectedFiles.value.splice(index, 1);
};

const handleSubmit = async () => {
  error.value = "";

  if (!profile.value?.phone && !profile.value?.whatsappNumber) {
    error.value =
      "Please add your contact number in your Profile before listing a card.";
    return;
  }

  submitting.value = true;

  try {
    if (!cardForm.value.cardName) throw new Error("Card name is required");
    if (cardForm.value.productType === "Ungraded" && !cardForm.value.condition)
      throw new Error("Please select a condition");
    if (cardForm.value.productType === "Graded") {
      if (!cardForm.value.gradingProvider)
        throw new Error("Please select a grading provider");
      if (!cardForm.value.grade) throw new Error("Please enter a grade");
    }
    if (!price.value || price.value <= 0)
      throw new Error("Price must be greater than 0");
    if (selectedFiles.value.length === 0 && !importedImageUrl.value)
      throw new Error("Please upload at least one photo or import from a link");

    let imageUrls: string[] = [];

    // Use imported image if no files uploaded
    if (importedImageUrl.value) {
      imageUrls.push(importedImageUrl.value);
    }

    uploading.value = true;
    uploadProgress.value = 0;
    for (let i = 0; i < selectedFiles.value.length; i++) {
      const urls = await uploadAuctionImages([selectedFiles.value[i].file]);
      imageUrls.push(...urls);
      uploadProgress.value = i + 1;
    }
    uploading.value = false;

    await createCard({
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
      imageUrl: imageUrls[0] || "",
      imageUrls,
      seller:
        profile.value?.customName || user.value!.displayName || "Anonymous",
      sellerUid: user.value!.uid,
    });

    selectedFiles.value.forEach((f: any) => URL.revokeObjectURL(f.preview));
    submitted.value = true;
    await router.push("/");
  } catch (e: any) {
    error.value = e.message || "Failed to list card";
    uploading.value = false;
  } finally {
    submitting.value = false;
  }
};
</script>

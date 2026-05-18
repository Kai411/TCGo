<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 text-lg mb-4">
        You need to sign in to create an auction.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold mb-6">Create an Auction</h1>

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
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-pokemon-red transition-colors cursor-pointer"
              @click="triggerFileInput"
              @dragover.prevent="dragOver = true"
              @dragleave="dragOver = false"
              @drop.prevent="handleDrop"
              :class="{ 'border-pokemon-red bg-red-50': dragOver }"
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
                <div
                  v-if="index === 0"
                  class="absolute bottom-1 left-1 bg-pokemon-yellow text-gray-900 text-xs px-1.5 py-0.5 rounded"
                >
                  Cover
                </div>
              </div>
            </div>
          </div>

          <!-- Card: Auction Settings (full width) -->
          <div
            class="bg-white rounded-xl border border-gray-200 p-5 space-y-4 lg:col-span-2"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900">
                Auction Settings
              </h3>
              <label class="flex items-center gap-2 cursor-pointer">
                <span class="text-xs text-gray-500">Private</span>
                <div
                  class="relative w-9 h-5 rounded-full transition-colors"
                  :class="isPrivate ? 'bg-pokemon-red' : 'bg-gray-300'"
                  @click="isPrivate = !isPrivate"
                >
                  <div
                    class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    :class="isPrivate ? 'translate-x-4' : 'translate-x-0.5'"
                  ></div>
                </div>
              </label>
            </div>
            <p
              v-if="isPrivate"
              class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
            >
              🔒 This auction will only be visible to people with the direct
              link.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Starting Price (RM) <span class="text-pokemon-red">*</span>
                </label>
                <input
                  v-model.number="startingPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="1.00"
                  class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Min Increment (RM) <span class="text-pokemon-red">*</span>
                </label>
                <input
                  v-model.number="minIncrement"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="1.00"
                  class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Duration <span class="text-pokemon-red">*</span>
              </label>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <button
                  v-for="opt in durationOptions"
                  :key="opt.value"
                  type="button"
                  @click="duration = opt.value"
                  class="py-2 px-2 rounded-lg text-xs font-medium border-2 transition-all"
                  :class="
                    duration === opt.value
                      ? 'border-pokemon-red bg-red-50 text-pokemon-red'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  "
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Card: Shipping -->
          <div
            class="bg-white rounded-xl border border-gray-200 p-5 space-y-3 lg:col-span-2"
          >
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
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-pokemon-red"
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
          class="w-full bg-pokemon-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitting ? "Creating Auction..." : "Start Auction" }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CardFormData } from "~/components/CardFormFields.vue";

const router = useRouter();
const { createAuction } = useAuctions();
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
    (startingPrice.value !== null && startingPrice.value > 0)
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

const startingPrice = ref<number | null>(null);
const minIncrement = ref(1);
const duration = ref(86400000);
const isPrivate = ref(false);
const submitting = ref(false);
const error = ref("");

const durationOptions = [
  { value: 3600000, label: "1 Hour" },
  { value: 21600000, label: "6 Hours" },
  { value: 43200000, label: "12 Hours" },
  { value: 86400000, label: "1 Day" },
  { value: 259200000, label: "3 Days" },
  { value: 604800000, label: "7 Days" },
];

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
      "Please add your contact number in your Profile before creating an auction.";
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
    if (!startingPrice.value || startingPrice.value <= 0)
      throw new Error("Starting price must be greater than 0");
    if (!minIncrement.value || minIncrement.value <= 0)
      throw new Error("Minimum increment must be greater than 0");
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

    const auctionId = await createAuction({
      title: cardForm.value.cardName,
      description: cardForm.value.description,
      cardName: cardForm.value.cardName,
      cardSet: cardForm.value.cardSet,
      cardNumber: cardForm.value.cardNumber,
      productType: cardForm.value.productType,
      condition: cardForm.value.condition,
      gradingProvider: cardForm.value.gradingProvider,
      grade: cardForm.value.grade,
      customGradingProvider: cardForm.value.customGradingProvider,
      shippingWM: cardForm.value.shippingWM,
      shippingEM: cardForm.value.shippingEM,
      imageUrl: imageUrls[0] || "",
      imageUrls,
      startingPrice: startingPrice.value,
      minIncrement: minIncrement.value,
      seller:
        profile.value?.customName || user.value!.displayName || "Anonymous",
      sellerUid: user.value!.uid,
      endsAt: Date.now() + duration.value,
      isPrivate: isPrivate.value,
    });

    selectedFiles.value.forEach((f: any) => URL.revokeObjectURL(f.preview));
    submitted.value = true;
    await router.push(`/auctions/${auctionId}`);
  } catch (e: any) {
    error.value = e.message || "Failed to create auction";
    uploading.value = false;
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <!-- Card: Quick Import (full width) -->
  <div class="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
    <h3 class="text-sm font-semibold text-gray-900 mb-2">Quick Import</h3>
    <p class="text-xs text-gray-400 mb-3">
      Paste a Collectr link to auto-fill card details
    </p>
    <div class="flex gap-2">
      <input
        v-model="importUrl"
        type="url"
        placeholder="https://www.getcollectr.com/products/..."
        class="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
        @keydown.enter.prevent="handleImport"
      />
      <button
        type="button"
        @click="handleImport"
        :disabled="importing || !importUrl"
        class="bg-pokemon-blue text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {{ importing ? "Loading..." : "Import" }}
      </button>
    </div>
    <p v-if="importError" class="text-red-500 text-xs mt-2">
      {{ importError }}
    </p>
    <p v-if="importSuccess" class="text-green-600 text-xs mt-2">
      {{ importSuccess }}
    </p>
  </div>

  <!-- Card: Product Type (full width) -->
  <div class="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
    <h3 class="text-sm font-semibold text-gray-900 mb-3">
      Product Type <span class="text-pokemon-red">*</span>
    </h3>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="type in PRODUCT_TYPES"
        :key="type"
        type="button"
        @click="updateField('productType', type)"
        class="py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all"
        :class="
          modelValue.productType === type
            ? 'border-pokemon-red bg-red-50 text-pokemon-red'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        "
      >
        {{ type }}
      </button>
    </div>
  </div>

  <!-- Card: Card Details -->
  <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
    <h3 class="text-sm font-semibold text-gray-900">Card Details</h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Card Name <span class="text-pokemon-red">*</span>
      </label>
      <input
        :value="modelValue.cardName"
        @input="onInput('cardName', $event)"
        type="text"
        required
        placeholder="e.g. Charizard VMAX"
        class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
      />
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Card Set
        </label>
        <input
          :value="modelValue.cardSet"
          @input="onInput('cardSet', $event)"
          type="text"
          placeholder="e.g. Darkness Ablaze"
          class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Set No.
        </label>
        <input
          :value="modelValue.cardNumber"
          @input="onInput('cardNumber', $event)"
          type="text"
          placeholder="020/189"
          class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
        />
      </div>
    </div>
  </div>

  <!-- Card: Description -->
  <div class="bg-white rounded-xl border border-gray-200 p-5">
    <label class="block text-sm font-semibold text-gray-900 mb-2">
      Description
    </label>
    <textarea
      :value="modelValue.description"
      @input="onInput('description', $event)"
      rows="6"
      placeholder="Additional notes about the card..."
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red resize-none"
    ></textarea>
  </div>

  <!-- Card: Condition (full width) -->
  <div
    v-if="modelValue.productType === 'Ungraded'"
    class="bg-white rounded-xl border border-gray-200 p-5 space-y-3 lg:col-span-2"
  >
    <h3 class="text-sm font-semibold text-gray-900">
      Condition <span class="text-pokemon-red">*</span>
    </h3>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <button
        v-for="c in UNGRADED_CONDITIONS"
        :key="c"
        type="button"
        @click="updateField('condition', c)"
        class="py-2 px-3 rounded-lg text-xs font-medium border-2 transition-all text-center"
        :class="
          modelValue.condition === c
            ? 'border-pokemon-red bg-red-50 text-pokemon-red'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        "
      >
        {{ c }}
      </button>
    </div>
  </div>

  <!-- Card: Grading (full width) -->
  <div
    v-else-if="modelValue.productType === 'Graded'"
    class="bg-white rounded-xl border border-gray-200 p-5 space-y-4 lg:col-span-2"
  >
    <h3 class="text-sm font-semibold text-gray-900">Grading</h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Grading Provider <span class="text-pokemon-red">*</span>
      </label>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <button
          v-for="p in GRADING_PROVIDERS"
          :key="p"
          type="button"
          @click="onProviderSelect(p)"
          class="py-2 px-2 rounded-lg text-xs font-bold border-2 transition-all"
          :class="
            modelValue.gradingProvider === p
              ? 'border-pokemon-red bg-red-50 text-pokemon-red'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          "
        >
          {{ p }}
        </button>
      </div>
    </div>

    <div v-if="modelValue.gradingProvider === 'Others'">
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Provider Name <span class="text-pokemon-red">*</span>
      </label>
      <input
        :value="modelValue.customGradingProvider"
        @input="onInput('customGradingProvider', $event)"
        type="text"
        required
        placeholder="e.g. SGC"
        class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
      />
    </div>

    <div v-if="modelValue.gradingProvider">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Grade <span class="text-pokemon-red">*</span>
      </label>
      <div
        v-if="modelValue.gradingProvider !== 'Others'"
        class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2"
      >
        <button
          v-for="g in getGradesForProvider(modelValue.gradingProvider)"
          :key="g"
          type="button"
          @click="updateField('grade', g)"
          class="py-2 px-2 rounded-lg text-xs font-bold border-2 transition-all"
          :class="
            modelValue.grade === g
              ? 'border-pokemon-red bg-red-50 text-pokemon-red'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          "
        >
          {{ g }}
        </button>
      </div>
      <input
        v-else
        :value="modelValue.grade"
        @input="onInput('grade', $event)"
        type="text"
        required
        placeholder="Grade"
        class="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  PRODUCT_TYPES,
  UNGRADED_CONDITIONS,
  GRADING_PROVIDERS,
  getGradesForProvider,
} from "~/composables/useCardConstants";

export interface CardFormData {
  productType: string;
  cardName: string;
  cardSet: string;
  cardNumber: string;
  condition: string;
  gradingProvider: string;
  grade: string;
  customGradingProvider: string;
  description: string;
  shippingWM: number;
  shippingEM: number;
}

const props = defineProps<{
  modelValue: CardFormData;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CardFormData];
  "import-image": [url: string];
}>();

// Quick Import
const importUrl = ref("");
const importing = ref(false);
const importError = ref("");
const importSuccess = ref("");

const handleImport = async () => {
  if (!importUrl.value) return;
  importError.value = "";
  importSuccess.value = "";
  importing.value = true;

  try {
    const data = await $fetch<{
      cardName: string;
      cardNumber: string;
      cardSet: string;
      imageUrl: string;
    }>("/api/fetch-card-meta", {
      query: { url: importUrl.value },
    });

    // Auto-fill fields
    const updates: Partial<CardFormData> = { ...props.modelValue };
    if (data.cardName) updates.cardName = data.cardName;
    if (data.cardNumber) updates.cardNumber = data.cardNumber;
    if (data.cardSet) updates.cardSet = data.cardSet;
    emit("update:modelValue", updates as CardFormData);

    // Emit image URL for parent to handle
    if (data.imageUrl) {
      emit("import-image", data.imageUrl);
    }

    importSuccess.value = `Imported: ${data.cardName || "card data"}`;
  } catch (e: any) {
    importError.value =
      e.data?.message || e.message || "Failed to import. Check the URL.";
  } finally {
    importing.value = false;
  }
};

const updateField = (key: keyof CardFormData, value: any) => {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
};

const onInput = (key: keyof CardFormData, event: Event) => {
  const target = event.target as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
  updateField(key, target.value);
};

const onNumberInput = (key: keyof CardFormData, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateField(key, parseFloat(target.value) || 0);
};

const onProviderSelect = (provider: string) => {
  emit("update:modelValue", {
    ...props.modelValue,
    gradingProvider: provider,
    grade: "",
  });
};
</script>

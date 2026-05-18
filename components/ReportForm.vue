<template>
  <div
    v-if="showForm"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    @click.self="close"
  >
    <div
      class="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">Report User</h2>
        <button @click="close" class="text-gray-400 hover:text-gray-600">
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <p class="text-sm text-gray-500">
        Reporting: <strong>{{ reportedName }}</strong>
      </p>

      <!-- Report Type -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Reason <span class="text-pokemon-red">*</span>
        </label>
        <select
          v-model="reportType"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
        >
          <option value="">Select reason</option>
          <option v-for="t in REPORT_TYPES" :key="t.value" :value="t.value">
            {{ t.label }}
          </option>
        </select>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Description <span class="text-pokemon-red">*</span>
        </label>
        <textarea
          v-model="description"
          rows="4"
          placeholder="Describe what happened..."
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red resize-none"
        ></textarea>
      </div>

      <!-- Evidence Upload -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Evidence (screenshots)
        </label>
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-pokemon-red transition-colors"
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
          <p class="text-sm text-gray-400">Click to upload screenshots</p>
          <p class="text-xs text-gray-300 mt-1">PNG, JPG up to 5MB each</p>
        </div>
        <div
          v-if="evidenceFiles.length > 0"
          class="grid grid-cols-4 gap-2 mt-2"
        >
          <div
            v-for="(file, i) in evidenceFiles"
            :key="i"
            class="relative group"
          >
            <img
              :src="file.preview"
              class="w-full aspect-square object-cover rounded-lg border"
            />
            <button
              type="button"
              @click="removeEvidence(i)"
              class="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <!-- Submit -->
      <div class="flex gap-3">
        <button
          @click="close"
          class="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="submitting"
          class="flex-1 py-2.5 rounded-lg bg-pokemon-red text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {{ submitting ? "Submitting..." : "Submit Report" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { REPORT_TYPES } from "~/composables/useReports";

const props = defineProps<{
  reportedUid: string;
  reportedName: string;
  relatedItemId?: string;
  relatedItemType?: "card" | "auction" | "";
}>();

const emit = defineEmits<{
  close: [];
  submitted: [];
}>();

const showForm = ref(true);
const reportType = ref("");
const description = ref("");
const evidenceFiles = ref<{ file: File; preview: string }[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const submitting = ref(false);
const error = ref("");

const { submitReport } = useReports();
const { uploadImage } = useStorage();

const close = () => {
  showForm.value = false;
  emit("close");
};

const triggerFileInput = () => fileInput.value?.click();

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    if (file.size > 5 * 1024 * 1024) continue;
    if (evidenceFiles.value.length >= 5) break;
    evidenceFiles.value.push({ file, preview: URL.createObjectURL(file) });
  }
};

const removeEvidence = (index: number) => {
  URL.revokeObjectURL(evidenceFiles.value[index].preview);
  evidenceFiles.value.splice(index, 1);
};

const handleSubmit = async () => {
  error.value = "";

  if (!reportType.value) {
    error.value = "Please select a reason.";
    return;
  }
  if (!description.value.trim()) {
    error.value = "Please describe what happened.";
    return;
  }

  submitting.value = true;

  try {
    // Upload evidence images
    let evidenceUrls: string[] = [];
    for (const { file } of evidenceFiles.value) {
      const url = await uploadImage(file);
      evidenceUrls.push(url);
    }

    await submitReport({
      reportedUid: props.reportedUid,
      reportedName: props.reportedName,
      type: reportType.value,
      description: description.value.trim(),
      evidenceUrls,
      relatedItemId: props.relatedItemId,
      relatedItemType: props.relatedItemType,
    });

    evidenceFiles.value.forEach((f) => URL.revokeObjectURL(f.preview));
    emit("submitted");
    close();
  } catch (e: any) {
    error.value = e.message || "Failed to submit report.";
  } finally {
    submitting.value = false;
  }
};
</script>

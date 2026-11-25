<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <label class="block text-xs font-semibold text-[var(--ink)]">{{ label }}</label>
      <button
        v-if="modelValue && !uploading"
        type="button"
        class="-my-2 px-1 py-2 text-xs font-semibold text-[var(--danger)]"
        @click="emit('update:modelValue', '')"
      >
        Remove
      </button>
    </div>
    <p v-if="hint" class="mt-0.5 text-micro text-[var(--ink-3)]">{{ hint }}</p>

    <label
      class="mt-2 flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] text-center transition-colors active:bg-[var(--surface-2)]"
      :class="modelValue ? 'border-solid' : 'min-h-[96px] px-4 py-5'"
    >
      <input type="file" accept="image/*" class="sr-only" :disabled="uploading" @change="onPick" />
      <img v-if="modelValue" :src="cdnUrl(modelValue, 800)" alt="" class="block max-h-64 w-full object-contain" />
      <span v-else class="text-sm font-semibold text-[var(--ink-2)]">
        {{ uploading ? "Uploading…" : "Upload image" }}
      </span>
    </label>
    <p v-if="modelValue" class="mt-1.5 text-micro text-[var(--ink-3)]">
      {{ uploading ? "Uploading…" : "Tap the image to replace it." }}
    </p>
    <p v-if="error" class="mt-1.5 text-xs text-[var(--danger)]">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";

defineProps<{ modelValue: string; label: string; hint?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { uploadImage } = useStorage();
const uploading = ref(false);
const error = ref("");

const onPick = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    error.value = "Pick an image file.";
    return;
  }
  uploading.value = true;
  error.value = "";
  try {
    emit("update:modelValue", await uploadImage(file));
  } catch {
    error.value = "Couldn't upload the image. Try again.";
  } finally {
    uploading.value = false;
  }
};
</script>

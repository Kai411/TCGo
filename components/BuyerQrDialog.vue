<template>
  <!-- The customer code as a popup, for the Account page shortcut. -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-out"
      leave-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
        @click.self="close"
      >
        <div
          class="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-[#17171c]"
          role="dialog"
          aria-modal="true"
          aria-label="Your customer code"
        >
          <BuyerQrCard />
          <button
            type="button"
            @click="close"
            class="mt-4 w-full min-h-[44px] rounded-xl border border-black/[0.10] text-sm font-semibold text-ink transition-colors active:bg-black/[0.03] dark:border-white/[0.12] dark:text-white dark:active:bg-white/[0.05]"
          >
            Done
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const close = () => emit("update:modelValue", false);

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.modelValue) close();
};
onMounted(() => document.addEventListener("keydown", onKey));
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
</script>

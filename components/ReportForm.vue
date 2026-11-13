<template>
  <!-- A sheet from the bottom on phones, a centred card from 640px. Teleported
       and above the tab bar (z-[60]) so the bottom nav never covers Submit;
       the panel uses .surface so it is solid in dark mode, not see-through. -->
  <Teleport to="body">
    <Transition name="report-sheet" appear @after-leave="emit('close')">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center sm:p-4 bg-black/40"
        @click.self="close"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-sheet-title"
          class="report-sheet-panel surface dark:[color-scheme:dark] w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] px-5 pt-2 sm:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div class="sm:hidden mx-auto mb-4 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />

          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p id="report-sheet-title" class="text-lg font-bold text-ink dark:text-white">
                {{ isListing ? "Report this listing" : "Report this member" }}
              </p>
              <p class="text-sm text-ink-muted dark:text-zinc-400 mt-0.5 truncate">
                <template v-if="isListing">{{ itemName || "Listing" }} · @{{ reportedName }}</template>
                <template v-else>@{{ reportedName }}</template>
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="press -mr-2 -mt-1 w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-ink-muted dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              @click="close"
            >
              <svg class="w-5 h-5" v-bind="stroke"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Reason -->
          <fieldset class="mt-4">
            <legend class="text-sm font-semibold text-ink dark:text-white">What's wrong?</legend>
            <div class="mt-2 space-y-2">
              <label
                v-for="t in reasons"
                :key="t.value"
                class="press flex items-start gap-3 rounded-2xl border px-3.5 py-3 cursor-pointer transition-colors"
                :class="
                  reportType === t.value
                    ? 'border-pokemon-red bg-pokemon-red/[0.04] dark:bg-pokemon-red/[0.10]'
                    : 'border-black/[0.08] dark:border-white/[0.10] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                "
              >
                <input
                  v-model="reportType"
                  type="radio"
                  name="report-reason"
                  :value="t.value"
                  class="mt-0.5 h-4 w-4 shrink-0 accent-pokemon-red"
                />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-ink dark:text-white">{{ t.label }}</span>
                  <span v-if="t.hint" class="block text-[13px] leading-snug text-ink-muted dark:text-zinc-400">{{ t.hint }}</span>
                </span>
              </label>
            </div>
          </fieldset>

          <!-- Description -->
          <label class="block mt-4">
            <span class="text-sm font-semibold text-ink dark:text-white">Tell us more</span>
            <textarea
              v-model="description"
              rows="3"
              maxlength="1000"
              :placeholder="isListing ? 'What makes you think so? A link or a detail helps.' : 'Describe what happened.'"
              class="mt-1.5 w-full rounded-2xl border border-black/[0.10] dark:border-white/[0.12] bg-transparent px-3.5 py-3 text-base sm:text-sm text-ink dark:text-white placeholder:text-ink-faint dark:placeholder:text-zinc-500 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red resize-none"
            ></textarea>
          </label>

          <!-- Evidence -->
          <div class="mt-4">
            <p class="text-sm font-semibold text-ink dark:text-white">
              Screenshots <span class="font-normal text-ink-muted dark:text-zinc-400">(optional, up to 5)</span>
            </p>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleFileSelect"
            />
            <div class="mt-2 grid grid-cols-5 gap-2">
              <div v-for="(file, i) in evidenceFiles" :key="file.preview" class="relative">
                <img :src="file.preview" alt="" class="w-full aspect-square object-cover rounded-xl" />
                <button
                  type="button"
                  :aria-label="`Remove screenshot ${i + 1}`"
                  class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-white dark:bg-white dark:text-ink flex items-center justify-center"
                  @click="removeEvidence(i)"
                >
                  <svg class="w-3 h-3" v-bind="stroke" stroke-width="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <button
                v-if="evidenceFiles.length < 5"
                type="button"
                aria-label="Add screenshots"
                class="press aspect-square rounded-xl border border-dashed border-black/[0.15] dark:border-white/[0.18] flex items-center justify-center text-ink-muted dark:text-zinc-400 hover:border-pokemon-red"
                @click="triggerFileInput"
              >
                <svg class="w-5 h-5" v-bind="stroke"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          </div>

          <p class="mt-4 text-[13px] leading-snug text-ink-muted dark:text-zinc-400">
            TCGo staff review every report. The seller isn't told who reported them.
          </p>

          <p v-if="error" class="mt-3 text-sm text-pokemon-red" role="alert">{{ error }}</p>

          <button
            type="button"
            :disabled="submitting"
            class="press mt-4 w-full min-h-[48px] rounded-full text-sm font-semibold bg-pokemon-red text-white disabled:opacity-50"
            @click="handleSubmit"
          >
            {{ submitting ? "Sending…" : "Send report" }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { REPORT_TYPES } from "~/composables/useReports";
import { LISTING_REPORT_REASONS } from "~/shared/moderation";

const props = defineProps<{
  reportedUid: string;
  reportedName: string;
  relatedItemId?: string;
  relatedItemType?: "card" | "auction" | "";
  /** "listing" for card and auction pages; members' profiles use "user". */
  kind?: "user" | "listing";
  /** The listing's name, shown under the title. */
  itemName?: string;
}>();

const emit = defineEmits<{
  close: [];
  submitted: [];
}>();

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};

const isListing = computed(() => props.kind === "listing");
const reasons = computed<{ value: string; label: string; hint?: string }[]>(() =>
  isListing.value
    ? LISTING_REPORT_REASONS.map((r) => ({ value: r.value, label: r.label, hint: r.hint }))
    : REPORT_TYPES.map((r) => ({ value: r.value, label: r.label })),
);

const open = ref(true);
const reportType = ref("");
const description = ref("");
const evidenceFiles = ref<{ file: File; preview: string }[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const submitting = ref(false);
const error = ref("");

const { submitReport } = useReports();
const { uploadImage } = useStorage();

// The parent unmounts us on "close", which fires after the leave transition
// so the sheet slides away instead of vanishing.
const close = () => {
  if (submitting.value) return;
  open.value = false;
};

const triggerFileInput = () => fileInput.value?.click();

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    if (evidenceFiles.value.length >= 5) break;
    if (file.size > 5 * 1024 * 1024) {
      error.value = "Screenshots can be up to 5 MB each.";
      continue;
    }
    evidenceFiles.value.push({ file, preview: URL.createObjectURL(file) });
  }
  input.value = "";
};

const removeEvidence = (index: number) => {
  URL.revokeObjectURL(evidenceFiles.value[index]!.preview);
  evidenceFiles.value.splice(index, 1);
};

const handleSubmit = async () => {
  error.value = "";
  if (!reportType.value) {
    error.value = "Pick what's wrong.";
    return;
  }
  // A listing report with a clear reason stands on its own; "something else"
  // and member reports need words to act on.
  const needsWords = !isListing.value || reportType.value === "listing_other";
  if (needsWords && !description.value.trim()) {
    error.value = "Tell us a little more so staff can check it.";
    return;
  }

  submitting.value = true;
  try {
    const evidenceUrls: string[] = [];
    for (const { file } of evidenceFiles.value) {
      evidenceUrls.push(await uploadImage(file));
    }
    await submitReport({
      reportedUid: props.reportedUid,
      reportedName: props.reportedName,
      type: reportType.value,
      description: description.value.trim(),
      evidenceUrls,
      relatedItemId: props.relatedItemId,
      relatedItemType: props.relatedItemType,
      relatedItemName: props.itemName,
    });
    evidenceFiles.value.forEach((f) => URL.revokeObjectURL(f.preview));
    evidenceFiles.value = [];
    emit("submitted");
    submitting.value = false;
    close();
  } catch (e: any) {
    error.value = e?.message || "Couldn't send the report. Try again.";
  } finally {
    submitting.value = false;
  }
};

// Close on Escape; the backdrop handles taps.
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") close();
};
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  evidenceFiles.value.forEach((f) => URL.revokeObjectURL(f.preview));
});
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active:not(:disabled) {
  transform: scale(0.97);
}
.report-sheet-enter-active,
.report-sheet-leave-active {
  transition: background-color 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.report-sheet-enter-active .report-sheet-panel,
.report-sheet-leave-active .report-sheet-panel {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease;
}
.report-sheet-enter-from,
.report-sheet-leave-to {
  background-color: transparent;
}
.report-sheet-enter-from .report-sheet-panel,
.report-sheet-leave-to .report-sheet-panel {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .report-sheet-enter-from .report-sheet-panel,
  .report-sheet-leave-to .report-sheet-panel {
    transform: scale(0.96);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .report-sheet-enter-active .report-sheet-panel,
  .report-sheet-leave-active .report-sheet-panel {
    transition: none;
  }
}
</style>

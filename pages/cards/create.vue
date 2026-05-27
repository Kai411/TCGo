<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">
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
      <h1 class="text-2xl font-bold mb-4">List Card for Sale</h1>

      <!-- Mode toggle: Scan vs Manual -->
      <div
        class="inline-flex p-1 mb-6 bg-gray-100 dark:bg-white/[0.06] rounded-xl"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'scan'"
          @click="mode = 'scan'"
          class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
          :class="
            mode === 'scan'
              ? 'bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white'
          "
        >
          Scan cards
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'manual'"
          @click="mode = 'manual'"
          class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
          :class="
            mode === 'manual'
              ? 'bg-white dark:bg-white/[0.12] text-ink dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white'
          "
        >
          Enter manually
        </button>
      </div>

      <!-- Scan flow -->
      <div
        v-if="mode === 'scan'"
        class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 mb-6 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            Scan cards
          </p>
          <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Use your camera (or upload photos). Each scan goes into a queue —
            fill the price + condition for each one and publish all at once.
          </p>
          <p class="text-xs mt-1.5">
            <span v-if="isPremium" class="text-emerald-600 dark:text-emerald-400 font-semibold">Unlimited scans</span>
            <span v-else class="font-semibold" :class="scanRemaining === 0 ? 'text-pokemon-red' : 'text-ink dark:text-zinc-200'">
              {{ scanRemaining }} / {{ FREE_SCAN_LIMIT }} scans left this month
            </span>
          </p>
        </div>
        <button
          type="button"
          @click="scannerOpen = true"
          :disabled="!isPremium && scanRemaining === 0"
          class="inline-flex items-center gap-1.5 bg-pokemon-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Scan cards
        </button>
      </div>

      <!-- Scanned drafts queue -->
      <div
        v-if="mode === 'scan' && queue.length > 0"
        class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 mb-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-zinc-100">
            Scanned drafts
            <span class="text-gray-400 dark:text-zinc-500 font-normal"
              >({{ queue.length }})</span
            >
          </h2>
          <button
            type="button"
            @click="clearDrafts"
            class="text-xs text-gray-500 dark:text-zinc-400 hover:text-pokemon-red transition-colors"
          >
            Clear all
          </button>
        </div>

        <div class="space-y-4">
          <div
            v-for="item in queue"
            :key="item.id"
            class="p-3 border border-gray-200 dark:border-white/[0.08] rounded-lg"
          >
            <div class="flex flex-col sm:flex-row gap-3 items-start">
              <!-- Thumbnail with status overlay. w-fit pins the container
                   to the image's natural width so the absolute overlay
                   can never paint past it (was causing the "big black box"
                   when flex stretched the container to row height/width). -->
              <div class="relative shrink-0 w-fit">
                <img
                  :src="item.scannedImageUrl"
                  :alt="item.cardName || 'Scanned card'"
                  class="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded"
                />
                <div
                  v-if="item.status === 'processing'"
                  class="absolute inset-0 bg-black/50 rounded flex items-center justify-center"
                >
                  <div
                    class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"
                  />
                </div>
                <div
                  v-else-if="item.status === 'failed'"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-pokemon-red text-white text-[10px] flex items-center justify-center"
                  title="Identification failed"
                >
                  !
                </div>
              </div>

              <div class="flex-1 min-w-0 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p
                      class="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate"
                      :class="
                        !item.cardName &&
                        'italic text-gray-400 dark:text-zinc-500'
                      "
                    >
                      {{
                        item.cardName ||
                        (item.status === "processing"
                          ? "Identifying…"
                          : item.status === "needs-pick"
                            ? "Pick the right card below"
                            : "Couldn't identify")
                      }}
                    </p>
                    <p
                      v-if="item.cardSet || item.cardNumber"
                      class="text-xs text-gray-500 dark:text-zinc-400 truncate flex items-center gap-1.5"
                    >
                      <span
                        v-if="item.language && item.language !== 'EN'"
                        class="inline-block bg-black/85 text-white text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded"
                      >
                        {{ item.language }}
                      </span>
                      <span class="truncate">
                        <template v-if="item.cardSet && item.cardNumber"
                          >{{ item.cardSet }} · {{ item.cardNumber }}</template
                        >
                        <template v-else-if="item.cardNumber">{{
                          item.cardNumber
                        }}</template>
                        <template v-else>{{ item.cardSet }}</template>
                      </span>
                    </p>
                    <p
                      v-else-if="item.status === 'failed' && item.error"
                      class="text-xs text-pokemon-red truncate"
                    >
                      {{ item.error }}
                    </p>
                    <!-- Market price is independent of the meta/failed
                         chain above — sits outside the v-if/else-if. -->
                    <p
                      v-if="item.marketPrice"
                      class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/[0.12] px-1.5 py-0.5 rounded"
                      :title="`Source: ${item.marketPrice.source === 'tcgplayer' ? 'TCGPlayer (USD)' : 'Cardmarket (EUR)'} · approximate MYR conversion`"
                    >
                      <svg
                        class="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                      >
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                      Market RM {{ item.marketPrice.low }}–{{ item.marketPrice.high }}
                    </p>
                  </div>
                  <button
                    type="button"
                    @click="removeDraft(item.id)"
                    class="text-gray-400 dark:text-zinc-500 hover:text-pokemon-red shrink-0 text-xl leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>

                <!-- processing: friendly status while Gemini + TCG API run -->
                <div
                  v-if="item.status === 'processing'"
                  class="flex items-center gap-3 py-2 text-xs text-gray-500 dark:text-zinc-400"
                >
                  <span
                    class="inline-block w-3 h-3 rounded-full border-2 border-gray-300 dark:border-white/[0.15] border-t-pokemon-red animate-spin"
                  ></span>
                  <span>Reading the card and looking up matches…</span>
                </div>

                <!-- needs-pick: match grid -->
                <div v-if="item.status === 'needs-pick' && item.matches">
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <button
                      v-for="m in item.matches"
                      :key="m.id"
                      type="button"
                      @click="pickMatch(item.id, m)"
                      class="text-left bg-white border border-gray-200 dark:border-white/[0.08] rounded overflow-hidden hover:border-pokemon-blue transition-colors"
                    >
                      <img
                        :src="m.images.small"
                        :alt="m.name"
                        class="w-full aspect-[2.5/3.5] object-cover"
                      />
                      <p class="px-1 py-0.5 text-[10px] font-semibold truncate">
                        {{ m.name }}
                      </p>
                      <p
                        class="px-1 pb-1 text-[9px] text-gray-500 dark:text-zinc-400 truncate"
                      >
                        {{ m.set.name }} · {{ m.number }}
                      </p>
                    </button>
                  </div>
                </div>

                <!-- failed: manual search retry -->
                <div v-else-if="item.status === 'failed'" class="flex gap-2">
                  <input
                    v-model="manualSearch[item.id]"
                    placeholder="Search card name…"
                    class="flex-1 border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm"
                    @keydown.enter.prevent="retryManualSearch(item.id)"
                  />
                  <button
                    type="button"
                    @click="retryManualSearch(item.id)"
                    :disabled="manualSearching[item.id]"
                    class="bg-pokemon-blue text-white text-xs px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    {{ manualSearching[item.id] ? "…" : "Search" }}
                  </button>
                </div>

                <!-- ready: full per-card form -->
                <template v-else-if="item.status === 'ready'">
                  <!-- Product type + condition / grading + price -->
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <select
                      v-model="draftFields[item.id].productType"
                      class="border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm"
                    >
                      <option value="Ungraded">Ungraded</option>
                      <option value="Graded">Graded</option>
                      <option value="Sealed">Sealed</option>
                    </select>
                    <select
                      v-if="draftFields[item.id].productType === 'Ungraded'"
                      v-model="draftFields[item.id].condition"
                      class="border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm"
                    >
                      <option value="">Condition…</option>
                      <option
                        v-for="c in UNGRADED_CONDITIONS"
                        :key="c"
                        :value="c"
                      >
                        {{ c }}
                      </option>
                    </select>
                    <select
                      v-if="draftFields[item.id].productType === 'Graded'"
                      v-model="draftFields[item.id].gradingProvider"
                      class="border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm"
                    >
                      <option value="">Provider…</option>
                      <option
                        v-for="p in GRADING_PROVIDERS"
                        :key="p"
                        :value="p"
                      >
                        {{ p }}
                      </option>
                    </select>
                    <select
                      v-if="
                        draftFields[item.id].productType === 'Graded' &&
                        draftFields[item.id].gradingProvider &&
                        draftFields[item.id].gradingProvider !== 'Others'
                      "
                      v-model="draftFields[item.id].grade"
                      class="border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm"
                    >
                      <option value="">Grade…</option>
                      <option
                        v-for="g in getGradesForProvider(
                          draftFields[item.id].gradingProvider,
                        )"
                        :key="g"
                        :value="g"
                      >
                        {{ g }}
                      </option>
                    </select>
                    <input
                      v-else-if="
                        draftFields[item.id].productType === 'Graded' &&
                        draftFields[item.id].gradingProvider === 'Others'
                      "
                      v-model="draftFields[item.id].grade"
                      placeholder="Grade"
                      class="border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm"
                    />
                    <!-- Price: full width on mobile, fits in 3rd col on desktop -->
                    <div class="relative col-span-2 sm:col-span-1">
                      <span
                        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-zinc-400 pointer-events-none"
                        >RM</span
                      >
                      <input
                        v-model.number="draftFields[item.id].price"
                        type="number"
                        step="0.01"
                        min="0.01"
                        :placeholder="
                          item.marketPrice
                            ? `~${item.marketPrice.low}–${item.marketPrice.high}`
                            : '0.00'
                        "
                        class="w-full border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <!-- Description -->
                  <textarea
                    v-model="draftFields[item.id].description"
                    rows="2"
                    placeholder="Notes about the card (optional)…"
                    class="w-full border border-gray-300 dark:border-white/[0.10] rounded-lg px-2.5 py-2 text-sm resize-none"
                  />

                  <!-- Extra photos -->
                  <div>
                    <p
                      class="text-[11px] font-medium text-gray-600 dark:text-zinc-300 mb-1.5"
                    >
                      Extra photos (optional) — your scan is already attached
                    </p>
                    <div class="flex items-center gap-2 flex-wrap">
                      <label
                        class="cursor-pointer inline-flex items-center justify-center w-14 h-14 border border-dashed border-gray-300 dark:border-white/[0.10] rounded text-gray-400 dark:text-zinc-500 hover:border-pokemon-blue hover:text-pokemon-blue transition-colors text-xs"
                      >
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          class="hidden"
                          @change="addDraftFiles(item.id, $event)"
                        />
                      </label>
                      <div
                        v-for="(f, i) in draftFields[item.id].extraFiles"
                        :key="i"
                        class="relative w-14 h-14 group"
                      >
                        <img
                          :src="f.preview"
                          class="w-14 h-14 object-cover rounded border border-gray-200 dark:border-white/[0.08]"
                        />
                        <button
                          type="button"
                          @click="removeDraftFile(item.id, i)"
                          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pokemon-red text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="draftError"
          class="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm"
        >
          {{ draftError }}
        </div>

        <button
          type="button"
          @click="publishDrafts"
          :disabled="publishing || !canPublishDrafts"
          class="mt-4 w-full bg-pokemon-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {{ publishButtonLabel }}
        </button>
      </div>

      <form
        v-if="mode === 'manual'"
        @submit.prevent="handleSubmit"
        class="space-y-4"
      >
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardFormFields
            v-model="cardForm"
            @import-image="handleImportImage"
          />

          <!-- Card: Photos (full width) -->
          <div
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-3 lg:col-span-2"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                Photos <span class="text-pokemon-red">*</span>
              </h3>
              <span class="text-xs text-gray-400 dark:text-zinc-500">{{ selectedFiles.length }}/3</span>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleFileSelect"
            />
            <div class="grid grid-cols-4 gap-2">
              <!-- Add button — leftmost, hidden when at max -->
              <label
                v-if="selectedFiles.length < 3"
                class="cursor-pointer aspect-[5/7] rounded-lg border-2 border-dashed border-gray-300 dark:border-white/[0.10] flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-zinc-500 hover:border-pokemon-blue hover:text-pokemon-blue transition-colors"
                @click="triggerFileInput"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span class="text-[10px] font-medium">Add</span>
              </label>
              <!-- Photo previews -->
              <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="relative group aspect-[5/7]"
              >
                <img
                  :src="file.preview"
                  class="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-white/[0.08]"
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
            <p class="text-xs text-gray-400 dark:text-zinc-500">PNG, JPG, WEBP · up to 5 MB each</p>
          </div>

          <!-- Card: Price -->
          <div
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5"
          >
            <label
              class="block text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-2"
            >
              Price <span class="text-pokemon-red">*</span>
            </label>
            <div class="relative">
              <span
                class="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-zinc-400 pointer-events-none"
                >RM</span
              >
              <input
                v-model.number="price"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                class="w-full border border-gray-300 dark:border-white/[0.10] rounded-lg pl-10 pr-4 py-2.5 text-gray-900 dark:text-zinc-100 placeholder-gray-400 focus:border-pokemon-blue focus:outline-none focus:ring-1 focus:ring-pokemon-blue"
              />
            </div>
          </div>

          <!-- Card: Shipping -->
          <div
            class="bg-white dark:bg-white/[0.04] rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 space-y-3"
          >
            <div class="flex items-center justify-between">
              <h3
                class="text-sm font-semibold text-gray-900 dark:text-zinc-100"
              >
                Shipping
              </h3>
              <span class="text-xs text-gray-400 dark:text-zinc-500"
                >Profile defaults</span
              >
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="block text-xs text-gray-600 dark:text-zinc-300 mb-1"
                  >West Malaysia (RM)</label
                >
                <input
                  v-model.number="cardForm.shippingWM"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full bg-white border border-gray-300 dark:border-white/[0.10] rounded-lg px-4 py-2.5 text-gray-900 dark:text-zinc-100 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
                />
              </div>
              <div>
                <label
                  class="block text-xs text-gray-600 dark:text-zinc-300 mb-1"
                  >East Malaysia (RM)</label
                >
                <input
                  v-model.number="cardForm.shippingEM"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full bg-white border border-gray-300 dark:border-white/[0.10] rounded-lg px-4 py-2.5 text-gray-900 dark:text-zinc-100 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
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
            <span class="text-sm text-gray-600 dark:text-zinc-300">
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

      <CardScanner
        v-if="scannerOpen"
        @close="scannerOpen = false"
        @finished="scannerOpen = false"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CardFormData } from "~/components/CardFormFields.vue";
import {
  UNGRADED_CONDITIONS,
  GRADING_PROVIDERS,
  RARITIES,
  VARIANTS,
  EDITIONS,
  getGradesForProvider,
} from "~/composables/useCardConstants";
import { FREE_SCAN_LIMIT } from "~/composables/useScanQuota";

const router = useRouter();
const { createCard } = useCards();
const { uploadAuctionImages } = useStorage();
const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { isPremium, remaining: scanRemaining } = useScanQuota();
const {
  queue,
  remove: removeFromQueue,
  clear: clearQueue,
  pickMatch: pickMatchInQueue,
  updateItem: updateQueueItem,
  processingCount,
} = useScanQueue();
const { searchByName } = usePokemonTcg();

const scannerOpen = ref(false);
const mode = ref<"scan" | "manual">("scan");

// Per-draft form state, keyed by queue item id. Initialized lazily as
// items get added to the queue.
interface DraftFileEntry {
  file: File;
  preview: string;
}
interface DraftFields {
  productType: "Ungraded" | "Graded" | "Sealed";
  condition: string;
  gradingProvider: string;
  grade: string;
  description: string;
  price: number | null;
  extraFiles: DraftFileEntry[];
}
const draftFields = ref<Record<string, DraftFields>>({});

watch(
  queue,
  (items) => {
    for (const item of items) {
      if (!draftFields.value[item.id]) {
        draftFields.value[item.id] = {
          productType: "Ungraded",
          condition: "",
          gradingProvider: "",
          grade: "",
          description: "",
          price: null,
          extraFiles: [],
        };
      }
    }
    // Drop fields for any removed items + revoke any object URLs
    const liveIds = new Set(items.map((i) => i.id));
    for (const id of Object.keys(draftFields.value)) {
      if (!liveIds.has(id)) {
        for (const f of draftFields.value[id].extraFiles) {
          URL.revokeObjectURL(f.preview);
        }
        delete draftFields.value[id];
      }
    }
  },
  { immediate: true, deep: true },
);

const addDraftFiles = (id: string, event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 5 * 1024 * 1024) continue;
    draftFields.value[id].extraFiles.push({
      file,
      preview: URL.createObjectURL(file),
    });
  }
  input.value = "";
};

const removeDraftFile = (id: string, index: number) => {
  const f = draftFields.value[id].extraFiles[index];
  if (f) URL.revokeObjectURL(f.preview);
  draftFields.value[id].extraFiles.splice(index, 1);
};

const draftError = ref("");
const publishing = ref(false);
const publishProgress = ref(0);

const removeDraft = (id: string) => removeFromQueue(id);
const clearDrafts = () => {
  if (window.confirm("Discard all scanned drafts?")) clearQueue();
};

const pickMatch = (id: string, match: any) => pickMatchInQueue(id, match);

// Manual fallback for failed identifications — search by name and either
// auto-resolve a single match or flip to needs-pick for the user.
const manualSearch = ref<Record<string, string>>({});
const manualSearching = ref<Record<string, boolean>>({});

const retryManualSearch = async (id: string) => {
  const term = (manualSearch.value[id] || "").trim();
  if (!term) return;
  manualSearching.value[id] = true;
  try {
    const results = await searchByName(term);
    if (results.length === 0) {
      updateQueueItem(id, {
        status: "failed",
        error: `No matches for "${term}".`,
      });
    } else if (results.length === 1) {
      pickMatchInQueue(id, results[0]);
    } else {
      updateQueueItem(id, {
        status: "needs-pick",
        matches: results,
        error: undefined,
      });
    }
  } catch {
    updateQueueItem(id, {
      status: "failed",
      error: "Search couldn't reach the card database. Try again in a moment.",
    });
  } finally {
    manualSearching.value[id] = false;
  }
};

const readyDrafts = computed(() =>
  queue.value.filter((i) => i.status === "ready"),
);

const canPublishDrafts = computed(() => {
  if (queue.value.length === 0) return false;
  if (processingCount() > 0) return false;
  return readyDrafts.value.length > 0;
});

const publishButtonLabel = computed(() => {
  if (publishing.value)
    return `Publishing ${publishProgress.value}/${readyDrafts.value.length}…`;
  if (processingCount() > 0)
    return `Identifying ${processingCount()} card${processingCount() === 1 ? "" : "s"}…`;
  const blocked = queue.value.length - readyDrafts.value.length;
  if (readyDrafts.value.length === 0)
    return "Pick or remove unresolved drafts to publish";
  if (blocked > 0)
    return `Publish ${readyDrafts.value.length} ready · ${blocked} unresolved`;
  return `Publish all ${readyDrafts.value.length} draft${readyDrafts.value.length === 1 ? "" : "s"}`;
});

const publishDrafts = async () => {
  draftError.value = "";

  if (!profile.value?.phone && !profile.value?.whatsappNumber) {
    draftError.value =
      "Please add your contact number in your Profile before listing cards.";
    return;
  }

  // Per-draft validation — only ready items are eligible to publish.
  for (const item of readyDrafts.value) {
    const f = draftFields.value[item.id];
    if (!f) continue;
    if (!f.price || f.price <= 0) {
      draftError.value = `Set a price for "${item.cardName}".`;
      return;
    }
    if (f.productType === "Ungraded" && !f.condition) {
      draftError.value = `Pick a condition for "${item.cardName}".`;
      return;
    }
    if (f.productType === "Graded" && (!f.gradingProvider || !f.grade)) {
      draftError.value = `Fill grading info for "${item.cardName}".`;
      return;
    }
  }

  publishing.value = true;
  publishProgress.value = 0;
  try {
    const sellerName =
      profile.value?.customName || user.value!.displayName || "Anonymous";
    const sellerUid = user.value!.uid;
    const shippingWM = profile.value?.shippingWM ?? 8;
    const shippingEM = profile.value?.shippingEM ?? 12;

    for (const item of [...readyDrafts.value]) {
      const f = draftFields.value[item.id];
      if (!f) continue;

      // Upload any extra photos the user attached to this draft.
      const extraUrls = f.extraFiles.length
        ? await uploadAuctionImages(f.extraFiles.map((x) => x.file))
        : [];

      const baseUrls: string[] = [];
      if (item.scannedImageUrl) baseUrls.push(item.scannedImageUrl);
      const imageUrls = [...baseUrls, ...extraUrls];

      await createCard({
        cardName: item.cardName!,
        cardSet: item.cardSet || "",
        cardNumber: item.cardNumber || "",
        productType: f.productType,
        condition: f.productType === "Ungraded" ? f.condition : "",
        gradingProvider: f.productType === "Graded" ? f.gradingProvider : "",
        grade: f.productType === "Graded" ? f.grade : "",
        customGradingProvider: "",
        description: f.description,
        price: f.price!,
        shippingWM,
        shippingEM,
        imageUrl: imageUrls[0],
        imageUrls,
        seller: sellerName,
        sellerUid,
        language: item.language || "EN",
        tcgType: "Pokemon",
        rarity: item.rarity || "",
        variant: item.variant || "",
        edition: item.edition || "",
        artist: item.artist || "",
        quantity: 1,
        status: "active",
      });
      // Remove the published item from the queue so unresolved ones remain
      // for the user to handle separately.
      removeFromQueue(item.id);
      publishProgress.value++;
    }

    // Only redirect if everything was published. If unresolved drafts remain,
    // stay on the page so the user can deal with them.
    if (queue.value.length === 0) {
      clearQueue();
      submitted.value = true;
      await router.push("/");
    }
  } catch (e: any) {
    draftError.value = e.message || "Failed to publish drafts";
  } finally {
    publishing.value = false;
  }
};

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

const MAX_PHOTOS = 3;

const addFiles = (files: File[]) => {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 5 * 1024 * 1024) {
      error.value = `${file.name} is too large (max 5MB)`;
      continue;
    }
    if (selectedFiles.value.length >= MAX_PHOTOS) {
      error.value = `Maximum ${MAX_PHOTOS} photos`;
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
      language: cardForm.value.language || "EN",
      tcgType: cardForm.value.tcgType || "Pokemon",
      rarity: cardForm.value.rarity || "",
      variant: cardForm.value.variant || "",
      edition: cardForm.value.edition || "",
      artist: cardForm.value.artist || "",
      certNumber: cardForm.value.certNumber || "",
      quantity: cardForm.value.quantity || 1,
      negotiable: cardForm.value.negotiable === true,
      pickupAvailable: cardForm.value.pickupAvailable === true,
      status: "active",
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

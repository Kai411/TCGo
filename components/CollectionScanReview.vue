<template>
  <!-- Review step after scanning for the collection. Every scanned card is
       listed with what the TCGo catalogue matched it to and its market price;
       nothing is written until the member taps Add. A scan the matcher isn't
       sure about asks "Which one is it?" with the closest candidates instead
       of picking one quietly. -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-out"
      leave-to-class="opacity-0"
      appear
    >
      <div class="fixed inset-0 z-[70] bg-black/40" @click="$emit('close')" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      enter-from-class="translate-y-full"
      leave-active-class="transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
      leave-to-class="translate-y-full"
      appear
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-review-title"
        class="fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-md max-h-[88dvh] flex flex-col surface rounded-t-3xl border-t border-black/[0.06] dark:border-white/[0.08]"
      >
        <div class="shrink-0 px-4 pt-3">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15" aria-hidden="true" />
          <div class="flex items-center justify-between gap-3 px-1 pb-3">
            <div class="min-w-0">
              <h2 id="scan-review-title" class="text-base font-bold text-ink dark:text-white">
                Scanned cards
              </h2>
              <p class="text-xs text-ink-soft dark:text-zinc-500" aria-live="polite">
                <template v-if="processing > 0">Identifying {{ processing }} of {{ queue.length }}…</template>
                <template v-else-if="queue.length">{{ queue.length }} scanned · check each one, then add</template>
                <template v-else>Nothing scanned yet</template>
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 -mr-1 w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-muted dark:text-zinc-400 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
              aria-label="Close"
              @click="$emit('close')"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </div>

        <ul class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 divide-y divide-black/[0.06] dark:divide-white/[0.08] border-t border-black/[0.06] dark:border-white/[0.08]">
          <li v-for="item in queue" :key="item.id" class="py-3">
            <div class="flex gap-3">
              <!-- Catalogue art once matched; the member's own photo before. -->
              <div class="shrink-0 w-14 aspect-[5/7] rounded-md overflow-hidden bg-black/[0.04] dark:bg-white/[0.06]">
                <img
                  :src="item.imageUrl || item.scannedImageUrl"
                  alt=""
                  class="w-full h-full object-cover"
                  :class="{ 'animate-pulse': item.status === 'processing' }"
                />
              </div>

              <div class="min-w-0 flex-1">
                <!-- Processing -->
                <template v-if="item.status === 'processing'">
                  <p class="text-sm font-semibold text-ink dark:text-white">Identifying…</p>
                  <div class="mt-1.5 h-2.5 w-2/3 rounded bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                  <div class="mt-1.5 h-2.5 w-1/3 rounded bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
                </template>

                <!-- Matched to a catalogue card -->
                <template v-else-if="item.status === 'ready' && item.productId">
                  <p class="truncate text-sm font-semibold text-ink dark:text-white">{{ item.cardName }}</p>
                  <p class="truncate text-xs text-ink-soft dark:text-zinc-500">
                    {{ item.cardSet }}<template v-if="item.cardNumber"> · {{ item.cardNumber }}</template>
                  </p>
                  <p class="mt-1 text-sm font-bold tabular-price text-ink dark:text-white">
                    <template v-if="item.tcgoPrice">RM {{ formatMyr(item.tcgoPrice.market) }}</template>
                    <span v-else class="text-xs font-medium text-ink-soft dark:text-zinc-500">No price yet</span>
                    <span v-if="ownedOf(item.productId)" class="ml-1.5 text-[11px] font-medium text-ink-soft dark:text-zinc-500">
                      · you have {{ ownedOf(item.productId) }}
                    </span>
                  </p>
                </template>

                <!-- Unsure: ask -->
                <template v-else-if="item.status === 'needs-pick'">
                  <p class="text-sm font-semibold text-ink dark:text-white">Which one is it?</p>
                  <p class="truncate text-xs text-ink-soft dark:text-zinc-500">
                    Read as {{ readAs(item) }}
                  </p>
                </template>

                <!-- Not found, or no catalogue entry to add -->
                <template v-else>
                  <p class="text-sm font-semibold text-ink dark:text-white">
                    {{ item.status === "failed" ? "Couldn't match this card" : "Not in the TCGo catalogue" }}
                  </p>
                  <p class="text-xs text-ink-soft dark:text-zinc-500">
                    {{ item.status === "failed" ? item.error : `Read as ${readAs(item)}` }}
                  </p>
                </template>

                <div v-if="item.status !== 'processing'" class="mt-1.5 flex items-center gap-3">
                  <button
                    v-if="item.detectedName || item.cardName"
                    type="button"
                    class="text-xs font-semibold text-pokemon-blue dark:text-sky-400"
                    @click="searchFor(item)"
                  >
                    {{ item.status === "ready" && item.productId ? "Not this card?" : "Search instead" }}
                  </button>
                </div>
              </div>

              <!-- Copies, then remove -->
              <div class="shrink-0 flex flex-col items-end justify-between gap-2">
                <button
                  type="button"
                  class="-mr-2 -mt-2 w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-soft dark:text-zinc-500 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                  :aria-label="`Remove ${item.cardName || 'scan'}`"
                  @click="removeItem(item.id)"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
                <div
                  v-if="item.status === 'ready' && item.productId"
                  class="inline-flex items-center rounded-full border border-black/[0.08] dark:border-white/[0.12]"
                >
                  <button
                    type="button"
                    class="w-9 h-9 inline-flex items-center justify-center text-ink dark:text-white disabled:opacity-30"
                    :disabled="copiesOf(item.id) <= 1"
                    aria-label="One fewer copy"
                    @click="setCopies(item.id, copiesOf(item.id) - 1)"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14" /></svg>
                  </button>
                  <span class="min-w-[2ch] text-center text-sm font-semibold tabular-price text-ink dark:text-white" aria-live="polite">
                    {{ copiesOf(item.id) }}
                  </span>
                  <button
                    type="button"
                    class="w-9 h-9 inline-flex items-center justify-center text-ink dark:text-white disabled:opacity-30"
                    :disabled="copiesOf(item.id) >= 99"
                    aria-label="One more copy"
                    @click="setCopies(item.id, copiesOf(item.id) + 1)"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Candidates: a row to swipe through, best first. -->
            <div
              v-if="item.status === 'needs-pick' && item.matches?.length"
              class="-mx-4 mt-2.5 px-4 flex gap-2 overflow-x-auto overscroll-x-contain snap-x no-scrollbar"
            >
              <button
                v-for="m in item.matches"
                :key="m.productId"
                type="button"
                class="tab-press snap-start shrink-0 w-[92px] text-left"
                :aria-label="`${m.name}, ${m.setName}${m.number ? ' ' + m.number : ''}`"
                @click="pickMatch(item.id, m)"
              >
                <div class="aspect-[5/7] rounded-md overflow-hidden bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                  <img v-if="m.imageUrl" :src="m.imageUrl" alt="" loading="lazy" class="w-full h-full object-cover" />
                </div>
                <p class="mt-1 truncate text-[11px] font-semibold text-ink dark:text-white">{{ m.name }}</p>
                <p class="truncate text-[10px] text-ink-soft dark:text-zinc-500">
                  <template v-if="m.number">{{ m.number }} · </template>{{ m.setName }}
                </p>
                <p v-if="m.price" class="text-[11px] font-bold tabular-price text-ink dark:text-white">
                  RM {{ formatMyr(m.price.market) }}
                </p>
              </button>
            </div>
          </li>
        </ul>

        <div class="shrink-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-black/[0.06] dark:border-white/[0.08]">
          <p v-if="readyTotal > 0" class="mb-2 flex items-baseline justify-between text-xs text-ink-soft dark:text-zinc-500">
            <span>Market value of these</span>
            <span class="text-sm font-bold tabular-price text-ink dark:text-white">RM {{ formatMyr(readyValue) }}</span>
          </p>
          <p v-if="saveError" class="mb-2 text-xs text-pokemon-red" role="alert">{{ saveError }}</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 h-11 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-sm font-semibold text-ink dark:text-white"
              @click="$emit('scan-more')"
            >
              Scan more
            </button>
            <button
              type="button"
              class="flex-[1.4] h-11 rounded-xl bg-ink dark:bg-white text-sm font-semibold text-white dark:text-ink disabled:opacity-40"
              :disabled="readyTotal === 0 || saving"
              @click="addAll"
            >
              <template v-if="saving">Adding…</template>
              <template v-else-if="readyTotal > 0">Add {{ readyTotal }} to collection</template>
              <template v-else>Add to collection</template>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { ScanQueueItem } from "~/composables/useScanQueue";

const emit = defineEmits<{
  close: [];
  "scan-more": [];
  /** Run this query in the collection search instead. */
  search: [query: string];
  /** Cards were written; the count is copies added. */
  added: [copies: number];
}>();

const { queue, pickMatch, remove, clear, processingCount } = useScanQueue("collection");
const { quantityOf, setQuantity } = useUserCollection();

const processing = computed(() => processingCount());

// Copies to add per scan. Scanning the same card twice is two rows of one
// copy each; the stepper is for a stack scanned once.
const copies = ref<Record<string, number>>({});
const copiesOf = (id: string) => copies.value[id] ?? 1;
const setCopies = (id: string, n: number) => {
  copies.value = { ...copies.value, [id]: Math.min(99, Math.max(1, n)) };
};

const ownedOf = (productId: number) => quantityOf(productId);

const readyItems = computed(() =>
  queue.value.filter((i) => i.status === "ready" && i.productId),
);
const readyTotal = computed(() =>
  readyItems.value.reduce((t, i) => t + copiesOf(i.id), 0),
);
const readyValue = computed(() =>
  readyItems.value.reduce((t, i) => t + (i.tcgoPrice?.market ?? 0) * copiesOf(i.id), 0),
);

const formatMyr = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const readAs = (item: ScanQueueItem) =>
  [item.detectedName || item.cardName, item.detectedNumber || item.cardNumber]
    .filter(Boolean)
    .join(" ") || "nothing readable";

// The printed number before the slash is what the collection search reads
// as a number ("pikachu 65").
const searchFor = (item: ScanQueueItem) => {
  const name = item.detectedName || item.cardName || "";
  const number = (item.detectedNumber || "").split("/")[0]?.trim() ?? "";
  emit("search", [name, number].filter(Boolean).join(" "));
};

const removeItem = (id: string) => {
  remove(id);
  const { [id]: _, ...rest } = copies.value;
  copies.value = rest;
};

const saving = ref(false);
const saveError = ref("");

// Several scans of one card fold into a single write per product.
const addAll = async () => {
  if (saving.value) return;
  saving.value = true;
  saveError.value = "";
  const perProduct = new Map<number, ScanQueueItem[]>();
  for (const i of readyItems.value) {
    perProduct.set(i.productId!, [...(perProduct.get(i.productId!) ?? []), i]);
  }
  let added = 0;
  try {
    for (const [productId, items] of perProduct) {
      const n = items.reduce((t, i) => t + copiesOf(i.id), 0);
      await setQuantity(productId, quantityOf(productId) + n);
      // Off the list as soon as it is saved, so a retry after a failure
      // part-way through never adds the same card twice.
      for (const i of items) removeItem(i.id);
      added += n;
    }
    if (!queue.value.length) clear();
    emit("added", added);
  } catch (e) {
    console.error("[CollectionScanReview] add failed:", e);
    saveError.value = "Couldn't add these cards. Check your connection and try again.";
  } finally {
    saving.value = false;
  }
};
</script>

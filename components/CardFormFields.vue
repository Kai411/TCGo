<template>
  <!-- Catalogue search (full width).
       Replaces the old "paste a Collectr link" import — that sent sellers to a
       third-party site to copy a URL back, and could only ever fill a name and
       a picture. Searching our own catalogue fills the same fields, confirms a
       real product id, and shows the market price and trend. -->
  <CardSearchPicker
    :manual-query="manualQuery"
    :language="modelValue.language"
    @select="applyCatalogCard"
    class="lg:col-span-2"
  />

  <!-- Product type -->
  <section class="surface rounded-2xl p-5 lg:col-span-2">
    <FormField label="Product type" required>
      <ChoiceGroup
        :model-value="modelValue.productType"
        @update:model-value="updateField('productType', $event)"
        :options="PRODUCT_TYPES"
        cols="grid-cols-3"
        aria-label="Product type"
      />
    </FormField>
  </section>

  <!-- Card details -->
  <section class="surface rounded-2xl p-5 space-y-4">
    <h3 class="text-sm font-bold text-ink dark:text-zinc-100">Card details</h3>

    <FormField label="Card name" required>
      <input
        :value="modelValue.cardName"
        @input="onInput('cardName', $event)"
        type="text"
        required
        placeholder="e.g. Charizard VMAX"
        class="tcgo-input"
      />
    </FormField>

    <div class="grid grid-cols-3 gap-3">
      <FormField label="Set" class="col-span-2">
        <input
          :value="modelValue.cardSet"
          @input="onInput('cardSet', $event)"
          type="text"
          placeholder="e.g. Darkness Ablaze"
          class="tcgo-input"
        />
      </FormField>
      <FormField label="Number">
        <input
          :value="modelValue.cardNumber"
          @input="onInput('cardNumber', $event)"
          type="text"
          placeholder="020/189"
          class="tcgo-input tabular-price"
        />
      </FormField>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <FormField label="TCG">
        <select
          :value="modelValue.tcgType || 'Pokemon'"
          @change="onInput('tcgType', $event)"
          class="tcgo-input"
        >
          <option v-for="t in TCG_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </FormField>
      <FormField label="Language">
        <select
          :value="modelValue.language || 'EN'"
          @change="onInput('language', $event)"
          class="tcgo-input"
        >
          <option v-for="l in CARD_LANGUAGES" :key="l.code" :value="l.code">
            {{ l.code }}
          </option>
        </select>
      </FormField>
      <FormField label="Qty">
        <input
          :value="modelValue.quantity ?? 1"
          @input="onNumberInput('quantity', $event)"
          type="number"
          min="1"
          step="1"
          class="tcgo-input tabular-price"
        />
      </FormField>
    </div>

    <!-- Rarity / variant / edition / artist are filled by the scanner and the
         catalogue match, so they're collapsed by default rather than forcing
         four more fields on someone adding a card by hand. Auto-opens when
         something is already set so nothing is hidden. -->
    <div class="pt-1">
      <button
        type="button"
        @click="moreOpen = !moreOpen"
        class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
        :aria-expanded="showMore"
      >
        <svg
          class="w-3.5 h-3.5 transition-transform"
          :class="showMore ? 'rotate-180' : ''"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        Print details
        <span v-if="filledExtras" class="chip">{{ filledExtras }} set</span>
      </button>

      <div v-show="showMore" class="mt-3 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Rarity">
            <select :value="modelValue.rarity || ''" @change="onInput('rarity', $event)" class="tcgo-input">
              <option value="">—</option>
              <option v-for="r in RARITIES" :key="r" :value="r">{{ r }}</option>
            </select>
          </FormField>
          <FormField label="Variant">
            <select :value="modelValue.variant || ''" @change="onInput('variant', $event)" class="tcgo-input">
              <option value="">—</option>
              <option v-for="v in VARIANTS" :key="v" :value="v">{{ v }}</option>
            </select>
          </FormField>
          <FormField label="Edition">
            <select :value="modelValue.edition || ''" @change="onInput('edition', $event)" class="tcgo-input">
              <option value="">—</option>
              <option v-for="e in EDITIONS" :key="e" :value="e">{{ e }}</option>
            </select>
          </FormField>
        </div>
        <FormField label="Artist">
          <input
            :value="modelValue.artist || ''"
            @input="onInput('artist', $event)"
            type="text"
            placeholder="e.g. Mitsuhiro Arita"
            class="tcgo-input"
          />
        </FormField>
      </div>
    </div>

    <!-- Buyer-facing flags -->
    <div class="flex flex-wrap gap-4 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
      <label class="inline-flex items-center gap-2 cursor-pointer text-[13px] text-ink-subtle dark:text-zinc-200">
        <input
          type="checkbox"
          :checked="modelValue.negotiable === true"
          @change="onCheckboxInput('negotiable', $event)"
          class="w-4 h-4 rounded text-pokemon-red focus:ring-pokemon-red"
        />
        Negotiable
      </label>
      <label class="inline-flex items-center gap-2 cursor-pointer text-[13px] text-ink-subtle dark:text-zinc-200">
        <input
          type="checkbox"
          :checked="modelValue.pickupAvailable === true"
          @change="onCheckboxInput('pickupAvailable', $event)"
          class="w-4 h-4 rounded text-pokemon-red focus:ring-pokemon-red"
        />
        Pickup available
      </label>
    </div>
  </section>

  <!-- Description -->
  <section class="surface rounded-2xl p-5">
    <FormField label="Description" optional hint="Anything a buyer should know — flaws, centring, provenance.">
      <textarea
        :value="modelValue.description"
        @input="onInput('description', $event)"
        rows="9"
        placeholder="Additional notes about the card…"
        class="tcgo-input resize-none"
      />
    </FormField>
  </section>

  <!-- Condition (ungraded) -->
  <section
    v-if="modelValue.productType === 'Ungraded'"
    class="surface rounded-2xl p-5 lg:col-span-2"
  >
    <FormField label="Condition" required hint="Grade honestly — condition disputes are the main reason orders get refunded.">
      <ChoiceGroup
        :model-value="modelValue.condition"
        @update:model-value="updateField('condition', $event)"
        :options="conditionChoices"
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
        size="sm"
        aria-label="Condition"
      />
    </FormField>
  </section>

  <!-- Grading (graded) -->
  <section
    v-else-if="modelValue.productType === 'Graded'"
    class="surface rounded-2xl p-5 space-y-4 lg:col-span-2"
  >
    <h3 class="text-sm font-bold text-ink dark:text-zinc-100">Grading</h3>

    <FormField label="Grading provider" required>
      <ChoiceGroup
        :model-value="modelValue.gradingProvider"
        @update:model-value="onProviderSelect($event)"
        :options="GRADING_PROVIDERS"
        cols="grid-cols-3 sm:grid-cols-6"
        size="sm"
        aria-label="Grading provider"
      />
    </FormField>

    <FormField v-if="modelValue.gradingProvider === 'Others'" label="Provider name" required>
      <input
        :value="modelValue.customGradingProvider"
        @input="onInput('customGradingProvider', $event)"
        type="text"
        required
        placeholder="e.g. SGC"
        class="tcgo-input"
      />
    </FormField>

    <FormField v-if="modelValue.gradingProvider" label="Grade" required>
      <ChoiceGroup
        v-if="modelValue.gradingProvider !== 'Others'"
        :model-value="modelValue.grade"
        @update:model-value="updateField('grade', $event)"
        :options="getGradesForProvider(modelValue.gradingProvider)"
        cols="grid-cols-4 sm:grid-cols-6 lg:grid-cols-8"
        size="sm"
        aria-label="Grade"
      />
      <input
        v-else
        :value="modelValue.grade"
        @input="onInput('grade', $event)"
        type="text"
        required
        placeholder="Grade"
        class="tcgo-input"
      />
    </FormField>
  </section>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";
import {
  PRODUCT_TYPES,
  UNGRADED_CONDITIONS,
  GRADING_PROVIDERS,
  CARD_LANGUAGES,
  TCG_TYPES,
  RARITIES,
  VARIANTS,
  EDITIONS,
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
  // Legacy — no longer edited; shipping is quoted live at checkout.
  shippingWM?: number;
  shippingEM?: number;
  language: string;
  tcgType: string;
  // Visual metadata — scanner auto-fills these; users can correct.
  rarity: string;
  variant: string;
  edition: string;
  artist: string;
  // Authenticity / cert for graded cards
  certNumber: string;
  // Commerce flags
  quantity: number;
  negotiable: boolean;
  pickupAvailable: boolean;
}

const props = defineProps<{
  modelValue: CardFormData;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CardFormData];
  "import-image": [url: string];
  /** The full catalogue match, for callers that need the product id. */
  "catalog-select": [card: CatalogMatch];
}>();

// ── Catalogue match ───────────────────────────────────────────────────
// Applying a picked card fills every field the catalogue actually knows and
// leaves the rest (condition, grading) to the seller.
const applyCatalogCard = (card: CatalogMatch) => {
  const updates: CardFormData = {
    ...props.modelValue,
    cardName: card.name || props.modelValue.cardName,
    cardSet: card.setName || props.modelValue.cardSet,
    cardNumber: card.number || props.modelValue.cardNumber,
    rarity: card.rarity || props.modelValue.rarity,
    language: card.language || props.modelValue.language,
  };
  emit("update:modelValue", updates);
  if (card.imageUrl) emit("import-image", card.imageUrl);
  emit("catalog-select", card);
};

// ── Print details disclosure ──────────────────────────────────────────
const moreOpen = ref(false);

/** How many of the optional print fields already carry a value. */
const filledExtras = computed(
  () =>
    [
      props.modelValue.rarity,
      props.modelValue.variant,
      props.modelValue.edition,
      props.modelValue.artist,
    ].filter((v) => (v ?? "").trim()).length,
);

// Open if the seller opened it, or if the scanner/catalogue already filled
// something — a value the user can't see is worse than an extra open section.
const showMore = computed(() => moreOpen.value || filledExtras.value > 0);

// Condition codes are what sellers actually say ("NM", "LP"); the full name
// stays as a hint so the abbreviations aren't a guessing game.
const conditionChoices = computed(() =>
  UNGRADED_CONDITIONS.map((c) => {
    const m = c.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return m ? { value: c, label: m[2]!, hint: m[1]! } : { value: c, label: c };
  }),
);

// What the seller has typed by hand, fed to the picker so it can offer
// catalogue suggestions for the manual-entry path. Number is included because
// "charizard 199/165" is far more selective than the name alone.
const manualQuery = computed(() =>
  [props.modelValue.cardName, props.modelValue.cardNumber]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" "),
);

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

const onCheckboxInput = (key: keyof CardFormData, event: Event) => {
  const target = event.target as HTMLInputElement;
  updateField(key, target.checked);
};

const onProviderSelect = (provider: string) => {
  emit("update:modelValue", {
    ...props.modelValue,
    gradingProvider: provider,
    grade: "",
  });
};
</script>

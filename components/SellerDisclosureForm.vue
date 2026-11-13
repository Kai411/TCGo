<template>
  <div>
    <div class="space-y-2.5" role="radiogroup" aria-label="How you sell">
      <button
        v-for="opt in OPTIONS"
        :key="opt.value"
        type="button"
        role="radio"
        :aria-checked="form.type === opt.value"
        @click="choose(opt.value)"
        class="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors"
        :class="
          form.type === opt.value
            ? 'border-pokemon-red bg-pokemon-red/[0.04]'
            : 'border-black/[0.10] hover:border-black/25 dark:border-white/[0.12] dark:hover:border-white/30'
        "
      >
        <span
          class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
          :class="form.type === opt.value ? 'border-pokemon-red' : 'border-black/25 dark:border-white/30'"
        >
          <span v-if="form.type === opt.value" class="h-2 w-2 rounded-full bg-pokemon-red" />
        </span>
        <span class="min-w-0">
          <span class="block text-[14px] font-semibold text-ink dark:text-white">{{ opt.title }}</span>
          <span class="mt-0.5 block text-[12px] leading-relaxed text-ink-muted dark:text-zinc-400">{{ opt.blurb }}</span>
        </span>
      </button>
    </div>

    <div v-if="form.type === 'business'" class="mt-4 space-y-3">
      <label class="block">
        <span class="lbl">Business name</span>
        <input
          v-model="form.businessName"
          autocomplete="organization"
          :maxlength="BUSINESS_NAME_MAX"
          placeholder="Exactly as registered with SSM"
          class="field"
        />
      </label>
      <label class="block">
        <span class="lbl">SSM registration number</span>
        <input
          v-model="form.ssmNumber"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="e.g. 202403123456"
          class="field tabular-nums"
        />
        <span class="hint">12 digits on newer certificates. Older numbers like JM0123456-X work too.</span>
      </label>
    </div>

    <!-- What buyers will see, so the consent below is about something concrete. -->
    <div
      v-if="previewName"
      class="mt-4 rounded-xl border border-black/[0.08] px-3.5 py-3 dark:border-white/[0.10]"
    >
      <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">Buyers will see</p>
      <p class="mt-1 text-[14px] font-semibold text-ink dark:text-white">{{ previewName }}</p>
      <p class="text-[13px] text-ink-muted dark:text-zinc-400 tabular-nums">{{ previewDetail }}</p>
    </div>

    <p
      v-else-if="form.type === 'individual' && !verifiedName"
      class="mt-4 text-[13px] text-amber-700 dark:text-amber-300"
    >
      Verify your identity first. Your listings show the name on your MyKad.
    </p>

    <label v-if="form.type && (form.type === 'business' || verifiedName)" class="mt-4 flex items-start gap-2.5">
      <input
        v-model="form.consent"
        type="checkbox"
        class="mt-0.5 h-4 w-4 shrink-0 accent-pokemon-red"
      />
      <span class="text-[12px] leading-relaxed text-ink-muted dark:text-zinc-400">
        <template v-if="form.type === 'business'">
          These match my SSM registration, and TCGo may show them to buyers on my listings and auctions.
        </template>
        <template v-else>
          TCGo may show my verified name to buyers on my listings and auctions.
        </template>
        Malaysian e-commerce rules ask marketplaces to say who the seller is.
        <NuxtLink to="/seller-policy" target="_blank" class="font-semibold hover:underline">Seller Policy</NuxtLink>
      </span>
    </label>

    <p v-if="error" class="err">{{ error }}</p>
    <div class="mt-5 flex gap-2">
      <button v-if="cancellable" type="button" class="btn-secondary" @click="emit('cancel')">Cancel</button>
      <button :disabled="busy || !canSave" class="btn-primary" @click="save">
        <span v-if="busy" class="spinner" />{{ submitLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Individual or registered business: what buyers see as the seller. Shared
// by seller setup and Seller settings. Saved through the server because an
// individual's listings show their verified MyKad name, which the browser
// can't be trusted to copy (shared/seller-disclosure.ts).
import { computed, reactive, ref, watch } from "vue";
import {
  BUSINESS_NAME_MAX,
  normaliseBusinessName,
  normaliseSsm,
  type SellerDisclosure,
  type SellerType,
} from "~/shared/seller-disclosure";

const props = withDefaults(
  defineProps<{
    submitLabel?: string;
    cancellable?: boolean;
    /** What's saved now, when editing from Seller settings. */
    current?: SellerDisclosure | null;
  }>(),
  { submitLabel: "Save and continue", cancellable: false, current: null },
);
const emit = defineEmits<{ saved: [d: SellerDisclosure]; cancel: [] }>();

const OPTIONS = [
  {
    value: "individual" as const,
    title: "I sell as an individual",
    blurb: "Buyers see the name on your verified MyKad.",
  },
  {
    value: "business" as const,
    title: "I sell as a registered business",
    blurb: "Buyers see your business name and SSM number.",
  },
];

const { profile } = useMyProfile();
const { authedFetch } = useAuthedFetch();

const form = reactive({
  type: "" as "" | SellerType,
  businessName: "",
  ssmNumber: "",
  consent: false,
});

watch(
  () => props.current,
  (d) => {
    if (!d || form.type) return;
    form.type = d.type;
    if (d.type === "business") {
      form.businessName = d.name;
      form.ssmNumber = d.ssmNumber || "";
    }
  },
  { immediate: true },
);

// Agreeing is to one set of details, so changing them asks again.
const choose = (t: SellerType) => {
  if (form.type !== t) form.consent = false;
  form.type = t;
};
watch(() => [form.businessName, form.ssmNumber], () => (form.consent = false));

const verifiedName = computed(() => String((profile.value as any)?.kycVerifiedName || "").trim());
const ssm = computed(() => normaliseSsm(form.ssmNumber));
const business = computed(() => normaliseBusinessName(form.businessName));

const previewName = computed(() => {
  if (form.type === "individual") return verifiedName.value;
  if (form.type === "business") return business.value && ssm.value ? business.value : "";
  return "";
});
const previewDetail = computed(() =>
  form.type === "business"
    ? `Registered business · SSM ${ssm.value}`
    : "Individual seller · identity verified",
);

const canSave = computed(() => !!previewName.value && form.consent);

const busy = ref(false);
const error = ref("");

const save = async () => {
  if (busy.value) return;
  error.value = "";
  if (form.type === "business" && form.ssmNumber.trim() && !ssm.value) {
    error.value = "That doesn't look like an SSM number. New numbers are 12 digits, e.g. 202403123456.";
    return;
  }
  if (!canSave.value) return;
  busy.value = true;
  try {
    const saved = await authedFetch<SellerDisclosure>("/api/account/seller-disclosure", {
      method: "POST",
      body: {
        type: form.type,
        businessName: form.businessName,
        ssmNumber: form.ssmNumber,
        consent: form.consent,
      },
    });
    emit("saved", saved);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't save that. Try again.";
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.lbl {
  @apply mb-1.5 block text-xs font-semibold text-ink-muted dark:text-zinc-400;
}
.hint {
  @apply mt-1.5 block text-[11px] text-ink-soft dark:text-zinc-500;
}
.err {
  @apply mt-3 text-[13px] text-rose-600 dark:text-rose-400;
}
.field {
  @apply w-full rounded-xl border border-black/[0.10] bg-white px-3.5 py-2.5 text-[15px]
         text-ink outline-none transition-colors placeholder:text-ink-soft
         focus:border-pokemon-red focus:ring-2 focus:ring-pokemon-red/20
         dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-white;
}
.btn-primary {
  @apply inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-pokemon-red
         px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90
         disabled:cursor-not-allowed disabled:opacity-50;
}
.btn-secondary {
  @apply inline-flex items-center justify-center rounded-xl border border-black/[0.10]
         px-4 py-2.5 text-sm font-semibold text-ink dark:border-white/[0.12] dark:text-white;
}
.spinner {
  @apply h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white;
}
</style>

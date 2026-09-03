<template>
  <div class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 px-4 py-10">
    <div class="mx-auto w-full max-w-md">
      <div class="mb-6 text-center">
        <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-pokemon-red">
          Set up selling
        </p>
        <h1 class="mt-1.5 text-2xl font-bold tracking-tightest text-ink dark:text-white">
          Four things and you're trading
        </h1>
        <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
          Buyers pay us, we pay you — so we need to know who you are and where
          the money goes.
        </p>
      </div>

      <!-- All four shown, not "step 2 of 4". Someone can see what's coming and
           decide to finish in one sitting instead of being surprised twice. -->
      <ol class="mb-6 space-y-1">
        <li
          v-for="(s, i) in SELLER_STEPS"
          :key="s.id"
          class="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors"
          :class="s.id === state.current ? 'bg-white shadow-sm dark:bg-white/[0.05]' : ''"
        >
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            :class="
              isDone(s.id)
                ? 'bg-emerald-500 text-white'
                : s.id === state.current
                  ? 'bg-pokemon-red text-white'
                  : 'bg-black/[0.07] text-ink-soft dark:bg-white/[0.10]'
            "
          >
            <svg v-if="isDone(s.id)" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <div class="min-w-0">
            <p
              class="text-[13px] font-semibold leading-tight"
              :class="isDone(s.id) ? 'text-ink-soft line-through dark:text-zinc-500' : 'text-ink dark:text-white'"
            >
              {{ s.title }}
            </p>
            <p v-if="s.id === state.current" class="mt-0.5 text-[12px] text-ink-muted dark:text-zinc-400">
              {{ s.blurb }}
            </p>
          </div>
        </li>
      </ol>

      <div class="surface rounded-2xl p-6">
        <!-- ── Identity ─────────────────────────────────────────────── -->
        <template v-if="state.current === 'identity'">
          <h2 class="text-lg font-bold text-ink dark:text-white">Verify your identity</h2>
          <p class="mt-1.5 text-[13px] leading-relaxed text-ink-muted dark:text-zinc-400">
            MyKad or passport, plus a selfie — about a minute. Buyers see a
            Verified badge on your listings, and it's what lets money move to
            your account.
          </p>
          <div class="mt-5"><KycVerifyCard /></div>
        </template>

        <!-- ── Contact + pickup ─────────────────────────────────────── -->
        <template v-else-if="state.current === 'contact'">
          <h2 class="text-lg font-bold text-ink dark:text-white">Contact and pickup</h2>
          <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
            Where couriers collect your parcels. Buyers never see this address.
          </p>

          <div class="mt-5 space-y-3">
            <label class="block">
              <span class="lbl">Mobile number</span>
              <input v-model="form.phone" inputmode="tel" autocomplete="tel" placeholder="e.g. 0123456789" class="field" />
              <span class="hint">For delivery updates. Not shown publicly.</span>
            </label>
            <label class="block">
              <span class="lbl">Pickup address</span>
              <input v-model="form.pickupAddress1" autocomplete="address-line1" class="field" />
            </label>
            <label class="block">
              <span class="lbl">Unit, floor <span class="font-normal text-ink-soft">— optional</span></span>
              <input v-model="form.pickupAddress2" autocomplete="address-line2" class="field" />
            </label>
            <div class="grid grid-cols-3 gap-3">
              <label class="block">
                <span class="lbl">Postcode</span>
                <input v-model="form.pickupPostcode" inputmode="numeric" maxlength="5" class="field" />
              </label>
              <label class="col-span-2 block">
                <span class="lbl">City</span>
                <input v-model="form.pickupCity" class="field" />
              </label>
            </div>
            <label class="block">
              <span class="lbl">State</span>
              <select v-model="form.pickupState" class="field">
                <option value="" disabled>Choose a state</option>
                <option v-for="s in MY_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
              </select>
            </label>
          </div>

          <p v-if="error" class="err">{{ error }}</p>
          <button :disabled="busy" @click="saveContact" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />Save and continue
          </button>
        </template>

        <!-- ── Bank ─────────────────────────────────────────────────── -->
        <template v-else-if="state.current === 'bank'">
          <h2 class="text-lg font-bold text-ink dark:text-white">Where you get paid</h2>
          <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
            Sales are paid out to this account. The name must match the bank's
            records, or the transfer bounces.
          </p>

          <div class="mt-5 space-y-3">
            <label class="block">
              <span class="lbl">Bank</span>
              <select v-model="form.bankCode" class="field">
                <option value="" disabled>Choose your bank</option>
                <option v-for="b in bankOptions" :key="b.code" :value="b.code">{{ b.name }}</option>
              </select>
            </label>
            <label class="block">
              <span class="lbl">Account number</span>
              <input v-model="form.bankAccountNumber" inputmode="numeric" class="field tabular-nums" />
              <span v-if="accountHint" :class="accountOk ? 'hint' : 'err mt-1.5 block text-[11px]'">
                {{ accountHint }}
              </span>
            </label>
            <label class="block">
              <span class="lbl">Account holder</span>
              <input v-model="form.bankAccountHolder" placeholder="As per bank records" class="field" />
            </label>
            <label class="block">
              <span class="lbl">IC number</span>
              <input v-model="form.identityNumber" inputmode="numeric" placeholder="e.g. 900101101234" class="field tabular-nums" />
              <span class="hint">Required by the bank to release a transfer.</span>
            </label>
          </div>

          <p v-if="error" class="err">{{ error }}</p>
          <button :disabled="busy" @click="saveBank" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />Save and continue
          </button>
        </template>

        <!-- ── Handover ─────────────────────────────────────────────── -->
        <template v-else-if="state.current === 'handover'">
          <h2 class="text-lg font-bold text-ink dark:text-white">How you send parcels</h2>
          <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
            This decides which rates buyers are quoted, so pick the one you'll
            actually do. You can change it later.
          </p>

          <div class="mt-5 space-y-2.5">
            <button
              v-for="opt in HANDOVER_OPTIONS"
              :key="opt.value"
              type="button"
              @click="form.handoverPreference = opt.value"
              class="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors"
              :class="
                form.handoverPreference === opt.value
                  ? 'border-pokemon-red bg-pokemon-red/[0.04]'
                  : 'border-black/[0.10] hover:border-black/25 dark:border-white/[0.12] dark:hover:border-white/30'
              "
            >
              <span
                class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                :class="form.handoverPreference === opt.value ? 'border-pokemon-red' : 'border-black/25 dark:border-white/30'"
              >
                <span v-if="form.handoverPreference === opt.value" class="h-2 w-2 rounded-full bg-pokemon-red" />
              </span>
              <span class="min-w-0">
                <span class="block text-[14px] font-semibold text-ink dark:text-white">{{ opt.title }}</span>
                <span class="mt-0.5 block text-[12px] leading-relaxed text-ink-muted dark:text-zinc-400">{{ opt.blurb }}</span>
              </span>
            </button>
          </div>

          <p v-if="error" class="err">{{ error }}</p>
          <button :disabled="busy || !form.handoverPreference" @click="saveHandover" class="btn-primary mt-5">
            <span v-if="busy" class="spinner" />Finish setup
          </button>
        </template>

        <!-- ── Done ─────────────────────────────────────────────────── -->
        <template v-else>
          <div class="py-4 text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 class="text-lg font-bold text-ink dark:text-white">Your shop is open</h2>
            <p class="mt-1.5 text-[13px] text-ink-muted dark:text-zinc-400">
              List your first card whenever you're ready.
            </p>
            <button @click="finish" class="btn-primary mt-5">Go to the dashboard</button>
          </div>
        </template>
      </div>

      <p class="mt-5 text-center text-[12px] text-ink-soft dark:text-zinc-500">
        Just browsing?
        <NuxtLink to="/" class="font-semibold hover:underline">Back to the marketplace</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { MY_STATES } from "~/shared/my-states";
import {
  SELLER_STEPS,
  sellerOnboardingState,
  type SellerStepId,
} from "~/shared/onboarding";
import {
  MY_BANKS,
  banksFor,
  checkBankAccount,
  normaliseAccountNumber,
  bankByCode,
} from "~/shared/banks";

definePageMeta({ layout: false });
useHead({ title: "Set up selling | TCGo" });

const HANDOVER_OPTIONS = [
  {
    value: "dropoff" as const,
    title: "I drop off at a branch",
    blurb: "Usually the cheapest rates, and you control when it goes.",
  },
  {
    value: "pickup" as const,
    title: "Courier collects from me",
    blurb: "Costs a little more, but you never leave the shop.",
  },
];

const { profile, updateProfile, loading: loadingProfile } = useMyProfile();
const route = useRoute();
const config = useRuntimeConfig();

const busy = ref(false);
const error = ref("");

const state = computed(() => sellerOnboardingState(profile.value));
const isDone = (id: SellerStepId) => !state.value.remaining.includes(id);

const bankOptions = computed(() =>
  banksFor(!!config.public.billplzSandbox || MY_BANKS.length === 0),
);

// Seeded from the profile so a half-finished setup comes back filled in —
// which, with the step derived from what's missing, is the whole of "resume".
const form = reactive({
  phone: "",
  pickupAddress1: "",
  pickupAddress2: "",
  pickupPostcode: "",
  pickupCity: "",
  pickupState: "",
  bankCode: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  identityNumber: "",
  handoverPreference: "" as "" | "dropoff" | "pickup",
});

watch(
  profile,
  (p) => {
    if (!p) return;
    for (const k of Object.keys(form) as (keyof typeof form)[]) {
      if (!form[k] && p[k as keyof typeof p]) {
        (form as Record<string, unknown>)[k] = String(p[k as keyof typeof p]);
      }
    }
    if (!form.phone && p.whatsappNumber) form.phone = p.whatsappNumber;
    if (!form.bankAccountHolder && p.kycVerifiedName) {
      // The name Didit read off their document is the one the bank will have.
      form.bankAccountHolder = p.kycVerifiedName;
    }
  },
  { immediate: true },
);

const accountCheck = computed(() =>
  form.bankCode && form.bankAccountNumber
    ? checkBankAccount(form.bankAccountNumber, form.bankCode)
    : null,
);
const accountOk = computed(() => accountCheck.value?.ok !== false);
const accountHint = computed(() => {
  if (!accountCheck.value) return "";
  if (accountCheck.value.ok) {
    const b = bankByCode(form.bankCode);
    return b ? `Looks like a ${b.name} account.` : "";
  }
  return accountCheck.value.message ?? "That account number doesn't look right.";
});

const run = async (fn: () => Promise<void>) => {
  if (busy.value) return;
  error.value = "";
  busy.value = true;
  try {
    await fn();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't save that. Try again.";
  } finally {
    busy.value = false;
  }
};

const saveContact = () =>
  run(async () => {
    if (
      !form.phone.trim() ||
      !form.pickupAddress1.trim() ||
      !form.pickupPostcode.trim() ||
      !form.pickupCity.trim() ||
      !form.pickupState
    ) {
      error.value = "Fill in everything except the unit line.";
      return;
    }
    await updateProfile({
      phone: form.phone.trim(),
      // Kept in step so the contact number is one value, not two that drift.
      whatsappNumber: form.phone.trim(),
      pickupAddress1: form.pickupAddress1.trim(),
      pickupAddress2: form.pickupAddress2.trim(),
      pickupPostcode: form.pickupPostcode.trim(),
      pickupCity: form.pickupCity.trim(),
      pickupState: form.pickupState,
    });
  });

const saveBank = () =>
  run(async () => {
    if (
      !form.bankCode ||
      !form.bankAccountNumber.trim() ||
      !form.bankAccountHolder.trim() ||
      !form.identityNumber.trim()
    ) {
      error.value = "All four are needed before a payout can be sent.";
      return;
    }
    if (!accountOk.value) {
      error.value = accountHint.value;
      return;
    }
    await updateProfile({
      bankCode: form.bankCode,
      bankName: bankByCode(form.bankCode)?.name ?? "",
      bankAccountNumber: normaliseAccountNumber(form.bankAccountNumber),
      bankAccountHolder: form.bankAccountHolder.trim(),
      identityNumber: form.identityNumber.replace(/[\s-]/g, ""),
    });
  });

const saveHandover = () =>
  run(async () => {
    if (!form.handoverPreference) return;
    await updateProfile({ handoverPreference: form.handoverPreference });
  });

const finish = () => navigateTo((route.query.next as string) || "/seller");

// Same rule as buyer onboarding: celebrate finishing, never having finished.
const sawIncomplete = ref(false);
watch(
  () => [loadingProfile.value, state.value.complete] as const,
  ([stillLoading, done]) => {
    if (stillLoading) return;
    if (!done) {
      sawIncomplete.value = true;
      return;
    }
    if (sawIncomplete.value) setTimeout(finish, 1100);
    else finish();
  },
  { immediate: true },
);
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
  @apply inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pokemon-red
         px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90
         disabled:cursor-not-allowed disabled:opacity-50;
}
.spinner {
  @apply h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white;
}
</style>

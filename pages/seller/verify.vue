<template>
  <div class="max-w-2xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to verify your seller account.</p>
      <button @click="goToLogin" class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors">Sign in</button>
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold text-ink dark:text-white mb-1">Seller verification</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Required before you can sell. We verify who you are, then use these details to pay you and to create shipping labels from your address.
      </p>

      <div
        v-if="sellerReady"
        class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 mb-6"
      >
        <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <p class="text-sm font-semibold text-emerald-800 dark:text-emerald-200">You're verified to sell. You can update these details anytime.</p>
      </div>
      <div
        v-else-if="!kycLoading"
        class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 mb-6"
      >
        <p class="text-sm font-semibold text-amber-800 dark:text-amber-200">Missing: {{ missing.join(", ") }}</p>
      </div>

      <KycVerifyCard class="mb-5" />

      <form @submit.prevent="save" class="space-y-5">
        <!-- Contact -->
        <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3">
          <p class="text-sm font-bold text-ink dark:text-white">Contact</p>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Mobile number <span class="text-pokemon-red">*</span></label>
            <input v-model="form.whatsappNumber" type="tel" placeholder="e.g. 0123456789" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">Buyers contact you here; also used as the shipment contact number.</p>
          </div>
        </div>

        <!-- Bank account -->
        <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3">
          <p class="text-sm font-bold text-ink dark:text-white">Bank account <span class="font-normal text-xs text-gray-400">— for payouts</span></p>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Bank <span class="text-pokemon-red">*</span></label>
            <select v-model="form.bankCode" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white">
              <option value="">Select bank…</option>
              <option v-for="b in bankOptions" :key="b.code" :value="b.code">{{ b.name }}</option>
            </select>
            <p v-if="selectedBank && !selectedBank.payoutSupported" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Automatic payouts to {{ selectedBank.name }} aren't enabled yet — we'll transfer manually and it may take an extra working day.
            </p>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Account number <span class="text-pokemon-red">*</span></label>
              <input
                v-model="form.bankAccountNumber"
                type="text"
                inputmode="numeric"
                required
                class="w-full px-3 py-2 rounded-lg border bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white tabular-nums"
                :class="accountError
                  ? 'border-pokemon-red focus:border-pokemon-red'
                  : 'border-gray-200 dark:border-white/[0.10]'"
              />
              <p v-if="accountError" class="text-[11px] font-medium text-pokemon-red mt-1">
                {{ accountError }}
              </p>
              <p v-else-if="form.bankCode === SANDBOX_BANK_CODE" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                Sandbox test bank — any account number is accepted and the payout always succeeds.
              </p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Account holder name <span class="text-pokemon-red">*</span></label>
              <input v-model="form.bankAccountHolder" type="text" required placeholder="As per bank records" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">IC number <span class="text-pokemon-red">*</span></label>
            <input v-model="form.identityNumber" type="text" required placeholder="e.g. 900101101234" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white tabular-nums"/>
            <p class="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
              Required by the bank to verify the transfer recipient. We never display this to buyers.
            </p>
          </div>
          <p class="text-[11px] text-gray-400 dark:text-zinc-500">
            Payouts are transferred to this account after your orders are delivered. The holder name must match your bank records.
          </p>
        </div>

        <!-- Pickup address -->
        <div class="surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-5 space-y-3">
          <p class="text-sm font-bold text-ink dark:text-white">Pickup address <span class="font-normal text-xs text-gray-400">— for shipping labels</span></p>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Address line 1 <span class="text-pokemon-red">*</span></label>
            <input v-model="form.pickupAddress1" type="text" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Address line 2</label>
            <input v-model="form.pickupAddress2" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Postcode <span class="text-pokemon-red">*</span></label>
              <input v-model="form.pickupPostcode" type="text" inputmode="numeric" pattern="[0-9]{5}" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white tabular-nums"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">City <span class="text-pokemon-red">*</span></label>
              <input v-model="form.pickupCity" type="text" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white"/>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">State <span class="text-pokemon-red">*</span></label>
              <select v-model="form.pickupState" required class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm text-ink dark:text-white">
                <option value="">Select…</option>
                <option v-for="s in MY_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full py-3 rounded-xl text-sm font-bold bg-pokemon-red text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <span v-if="saving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>
          {{ saving ? "Saving…" : "Save & verify" }}
        </button>
        <p v-if="saved" class="text-center text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</p>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { MY_STATES } from "~/composables/useSellerKyc";
import {
  MY_BANKS,
  bankByCode,
  bankName,
  resolveBankCode,
  banksFor,
  checkBankAccount,
  normaliseAccountNumber,
  SANDBOX_BANK_CODE,
} from "~/shared/banks";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Verification | TCGo" });

const {user} = useAuth();
const { goToLogin } = useSignInGate();
const { profile, updateProfile } = useMyProfile();
const { sellerReady, missing, kycLoading } = useSellerKyc();

const form = ref({
  whatsappNumber: "",
  bankCode: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  identityNumber: "",
  pickupAddress1: "",
  pickupAddress2: "",
  pickupPostcode: "",
  pickupCity: "",
  pickupState: "",
});

// Prefill from the profile once it loads (and on revisit).
watch(
  profile,
  (p) => {
    if (!p) return;
    form.value = {
      whatsappNumber: p.whatsappNumber || p.phone || "",
      // Sellers verified before bank codes existed only have a display name
      // stored — map it back to a code so they aren't asked to re-pick.
      bankCode: resolveBankCode(p.bankCode, p.bankName) || "",
      bankAccountNumber: p.bankAccountNumber || "",
      bankAccountHolder: p.bankAccountHolder || "",
      identityNumber: p.identityNumber || "",
      pickupAddress1: p.pickupAddress1 || "",
      pickupAddress2: p.pickupAddress2 || "",
      pickupPostcode: p.pickupPostcode || "",
      pickupCity: p.pickupCity || "",
      pickupState: p.pickupState || "",
    };
  },
  { immediate: true },
);

const selectedBank = computed(() => bankByCode(form.value.bankCode));

// The sandbox test bank is only meaningful against Billplz sandbox; in
// production it must not be selectable at all.
const billplzSandbox = computed(() => {
  const v = String(useRuntimeConfig().public.billplzSandbox ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
});
const bankOptions = computed(() => banksFor(billplzSandbox.value));

// Format-only check — see shared/banks.ts for why there is no ownership check.
// Blank is left to the browser's `required`, so the field isn't red before the
// seller has typed anything.
const accountError = computed(() => {
  if (!form.value.bankAccountNumber) return "";
  const r = checkBankAccount(form.value.bankAccountNumber, form.value.bankCode);
  return r.ok ? "" : (r.error ?? "");
});

const saving = ref(false);
const saved = ref(false);

const save = async () => {
  // The browser's `required` catches empty; this catches malformed. Blocking
  // here rather than at payout time means the seller finds out now, not when
  // a transfer bounces days later.
  const check = checkBankAccount(form.value.bankAccountNumber, form.value.bankCode);
  if (!check.ok) {
    alert(check.error ?? "Please check the bank account number.");
    return;
  }
  saving.value = true;
  saved.value = false;
  try {
    await updateProfile({
      whatsappNumber: form.value.whatsappNumber.trim(),
      bankCode: form.value.bankCode,
      // Denormalised for display (order pages, admin console) so they don't
      // all have to resolve the code.
      bankName: bankName(form.value.bankCode),
      bankAccountNumber: normaliseAccountNumber(form.value.bankAccountNumber),
      bankAccountHolder: form.value.bankAccountHolder.trim(),
      identityNumber: form.value.identityNumber.replace(/[\s-]/g, ""),
      pickupAddress1: form.value.pickupAddress1.trim(),
      pickupAddress2: form.value.pickupAddress2.trim(),
      pickupPostcode: form.value.pickupPostcode.trim(),
      pickupCity: form.value.pickupCity.trim(),
      pickupState: form.value.pickupState,
      sellerKycCompletedAt: Date.now(),
    });
    saved.value = true;
  } catch (e: any) {
    alert(e?.message || "Couldn't save. Please try again.");
  } finally {
    saving.value = false;
  }
};
</script>

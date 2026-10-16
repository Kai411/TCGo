<template>
  <div>
    <div class="space-y-3">
      <label class="block">
        <span class="lbl">Bank</span>
        <select v-model="form.bankCode" class="field">
          <option value="" disabled>Choose your bank</option>
          <option v-for="b in bankOptions" :key="b.code" :value="b.code">{{ b.name }}</option>
        </select>
        <span v-if="selectedBank && !selectedBank.payoutSupported" class="hint !text-amber-600 dark:!text-amber-400">
          Automatic payouts to {{ selectedBank.name }} aren't enabled yet, so transfers are sent by hand and can take an extra working day.
        </span>
      </label>
      <label class="block">
        <span class="lbl">Account number</span>
        <input v-model="form.bankAccountNumber" inputmode="numeric" class="field tabular-nums" />
        <span v-if="accountHint" :class="accountOk ? 'hint' : 'err mt-1.5 block text-[11px]'">
          {{ accountHint }}
        </span>
      </label>

      <!-- The MyKad scan already gave us these. Ask only when it didn't, or
           when the seller wants to change them. -->
      <div
        v-if="fromScan"
        class="rounded-xl border border-black/[0.08] dark:border-white/[0.10] px-3.5 py-3"
      >
        <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">From your MyKad</p>
        <p class="mt-1 text-[14px] text-ink dark:text-white">{{ form.bankAccountHolder }}</p>
        <p class="text-[13px] text-ink-muted dark:text-zinc-400 tabular-nums">IC ending {{ form.identityNumber.slice(-4) }}</p>
        <p class="mt-1.5 text-[11px] text-ink-soft dark:text-zinc-500">
          The account must be in this name, or the bank returns the transfer.
        </p>
        <button type="button" class="mt-2 text-[13px] font-semibold text-pokemon-red hover:underline" @click="fromScan = false">
          Change
        </button>
      </div>
      <template v-else>
        <label class="block">
          <span class="lbl">Account holder</span>
          <input v-model="form.bankAccountHolder" placeholder="As per bank records" class="field" />
        </label>
        <label class="block">
          <span class="lbl">IC number</span>
          <input v-model="form.identityNumber" inputmode="numeric" placeholder="e.g. 900101101234" class="field tabular-nums" />
          <span class="hint">Required by the bank to release a transfer. Never shown to buyers.</span>
        </label>
      </template>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <div class="mt-5 flex gap-2">
      <button v-if="cancellable" type="button" class="btn-secondary" @click="emit('cancel')">Cancel</button>
      <button :disabled="busy" class="btn-primary" @click="save">
        <span v-if="busy" class="spinner" />{{ submitLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Payout account, shared by seller setup and Seller settings.
import { computed, reactive, ref, watch } from "vue";
import {
  bankByCode,
  banksFor,
  checkBankAccount,
  normaliseAccountNumber,
  resolveBankCode,
} from "~/shared/banks";

withDefaults(
  defineProps<{ submitLabel?: string; cancellable?: boolean }>(),
  { submitLabel: "Save and continue", cancellable: false },
);
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { profile, updateProfile } = useMyProfile();

// The sandbox test bank only means anything against Billplz sandbox. The
// value arrives as a string, so "false" must not count as on.
const billplzSandbox = computed(() => {
  const v = String(useRuntimeConfig().public.billplzSandbox ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
});
const bankOptions = computed(() => banksFor(billplzSandbox.value));

const form = reactive({
  bankCode: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
  identityNumber: "",
});
const fromScan = ref(false);
const seeded = ref(false);

watch(
  profile,
  (p) => {
    if (!p || seeded.value) return;
    seeded.value = true;
    // Sellers saved before bank codes existed only have a display name.
    form.bankCode = resolveBankCode(p.bankCode, p.bankName) || "";
    form.bankAccountNumber = p.bankAccountNumber || "";
    // The name Didit read off their MyKad is the one the bank will have.
    form.bankAccountHolder = p.bankAccountHolder || p.kycVerifiedName || "";
    form.identityNumber = p.identityNumber || "";
    fromScan.value = !!(form.bankAccountHolder && /^\d{12}$/.test(form.identityNumber));
  },
  { immediate: true },
);

const selectedBank = computed(() => bankByCode(form.bankCode));

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
  return accountCheck.value.error ?? "That account number doesn't look right.";
});

const busy = ref(false);
const error = ref("");

const save = async () => {
  if (busy.value) return;
  error.value = "";
  if (
    !form.bankCode ||
    !form.bankAccountNumber.trim() ||
    !form.bankAccountHolder.trim() ||
    !form.identityNumber.trim()
  ) {
    error.value = fromScan.value
      ? "Choose your bank and enter the account number."
      : "All four are needed before a payout can be sent.";
    return;
  }
  if (!accountOk.value) {
    error.value = accountHint.value;
    return;
  }
  busy.value = true;
  try {
    await updateProfile({
      bankCode: form.bankCode,
      // Denormalised for display (order pages, admin console).
      bankName: bankByCode(form.bankCode)?.name ?? "",
      bankAccountNumber: normaliseAccountNumber(form.bankAccountNumber),
      bankAccountHolder: form.bankAccountHolder.trim(),
      identityNumber: form.identityNumber.replace(/[\s-]/g, ""),
    });
    emit("saved");
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

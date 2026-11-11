<template>
  <div>
    <!-- Most sellers ship from where they live, and they gave that address
         when they joined. Show it as the answer rather than as a form. -->
    <div
      v-if="useDelivery"
      class="rounded-xl border border-black/[0.08] dark:border-white/[0.10] px-3.5 py-3"
    >
      <p class="text-xs font-semibold text-ink-muted dark:text-zinc-400">Couriers collect from</p>
      <p class="mt-1 text-[14px] text-ink dark:text-white">{{ deliveryLine }}</p>
      <button
        type="button"
        class="mt-2 text-[13px] font-semibold text-pokemon-red hover:underline"
        @click="useDifferentAddress"
      >
        Use a different address
      </button>
    </div>

    <div class="space-y-3" :class="useDelivery ? 'mt-4' : ''">
      <label class="block">
        <span class="lbl">Contact number</span>
        <input v-model="form.phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="e.g. 0123456789" class="field" />
        <span class="hint">For couriers and buyers with a question about an order. Not shown publicly.</span>
      </label>
      <template v-if="!useDelivery">
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
            <input v-model="form.pickupPostcode" inputmode="numeric" maxlength="5" autocomplete="postal-code" class="field" />
          </label>
          <label class="col-span-2 block">
            <span class="lbl">City</span>
            <input v-model="form.pickupCity" autocomplete="address-level2" class="field" />
          </label>
        </div>
        <label class="block">
          <span class="lbl">State</span>
          <select v-model="form.pickupState" autocomplete="address-level1" class="field">
            <option value="" disabled>Choose a state</option>
            <option v-for="s in MY_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
          </select>
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
// Contact number and pickup address, shared by seller setup and Seller
// settings so there is one form for these details, not two that drift.
import { computed, reactive, ref, watch } from "vue";
import { MY_STATES, stateForPostcode, stateName } from "~/shared/my-states";

const props = withDefaults(
  defineProps<{ submitLabel?: string; cancellable?: boolean }>(),
  { submitLabel: "Save and continue", cancellable: false },
);
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { profile, updateProfile } = useMyProfile();

const form = reactive({
  phone: "",
  pickupAddress1: "",
  pickupAddress2: "",
  pickupPostcode: "",
  pickupCity: "",
  pickupState: "",
});
const useDelivery = ref(false);
const seeded = ref(false);

const hasDelivery = (p: any) =>
  !!(p?.deliveryAddress1 && p?.deliveryPostcode && p?.deliveryCity && p?.deliveryState);

watch(
  profile,
  (p) => {
    if (!p || seeded.value) return;
    seeded.value = true;
    form.phone = p.phone || p.whatsappNumber || p.deliveryPhone || "";
    if (p.pickupAddress1) {
      form.pickupAddress1 = p.pickupAddress1;
      form.pickupAddress2 = p.pickupAddress2 || "";
      form.pickupPostcode = p.pickupPostcode || "";
      form.pickupCity = p.pickupCity || "";
      form.pickupState = p.pickupState || "";
    } else if (hasDelivery(p)) {
      useDelivery.value = true;
    }
  },
  { immediate: true },
);

const deliveryLine = computed(() => {
  const p = profile.value as any;
  if (!p) return "";
  return [
    p.deliveryAddress1,
    p.deliveryAddress2,
    `${p.deliveryPostcode || ""} ${p.deliveryCity || ""}`.trim(),
    stateName(p.deliveryState),
  ]
    .filter(Boolean)
    .join(", ");
});

const useDifferentAddress = () => {
  useDelivery.value = false;
};

// A full postcode fills an empty State; a chosen one is never overwritten.
watch(
  () => form.pickupPostcode,
  (pc) => {
    const code = stateForPostcode(pc);
    if (code && !form.pickupState) form.pickupState = code;
  },
);

const busy = ref(false);
const error = ref("");

const save = async () => {
  if (busy.value) return;
  error.value = "";
  const p = profile.value as any;
  const pickup = useDelivery.value
    ? {
        pickupAddress1: p?.deliveryAddress1 || "",
        pickupAddress2: p?.deliveryAddress2 || "",
        pickupPostcode: p?.deliveryPostcode || "",
        pickupCity: p?.deliveryCity || "",
        pickupState: p?.deliveryState || "",
      }
    : {
        pickupAddress1: form.pickupAddress1.trim(),
        pickupAddress2: form.pickupAddress2.trim(),
        pickupPostcode: form.pickupPostcode.trim(),
        pickupCity: form.pickupCity.trim(),
        pickupState: form.pickupState,
      };
  if (
    !form.phone.trim() ||
    !pickup.pickupAddress1 ||
    !pickup.pickupPostcode ||
    !pickup.pickupCity ||
    !pickup.pickupState
  ) {
    error.value = useDelivery.value
      ? "Add a contact number."
      : "Fill in everything except the unit line.";
    return;
  }
  busy.value = true;
  try {
    await updateProfile({
      phone: form.phone.trim(),
      // Kept in step so the contact number is one value, not two that drift.
      whatsappNumber: form.phone.trim(),
      ...pickup,
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

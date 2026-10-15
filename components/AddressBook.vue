<template>
  <div>
    <div class="mb-3 flex items-baseline justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-base font-bold text-ink dark:text-white">Delivery addresses</h2>
        <p class="mt-0.5 text-[13px] text-ink-muted dark:text-zinc-400">
          Shipping is quoted from your default. You can pick a different one at checkout.
        </p>
      </div>
      <button
        v-if="addresses.length && addresses.length < MAX_ADDRESSES && !editing"
        type="button"
        @click="startAdd"
        class="shrink-0 text-[13px] font-semibold text-pokemon-red hover:underline"
      >
        Add address
      </button>
    </div>

    <!-- ── Cards ──────────────────────────────────────────────────── -->
    <div v-if="addresses.length && !editing" class="space-y-2.5">
      <div
        v-for="a in sorted"
        :key="a.id"
        class="rounded-xl border p-4 transition-colors"
        :class="
          a.isDefault
            ? 'border-pokemon-red/40 bg-pokemon-red/[0.03]'
            : 'border-black/[0.08] dark:border-white/[0.10]'
        "
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[14px] font-bold text-ink dark:text-white">{{ a.name }}</span>
              <span
                v-if="a.isDefault"
                class="rounded-md bg-pokemon-red/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pokemon-red"
              >
                Default
              </span>
              <span
                v-if="a.label"
                class="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted dark:bg-white/[0.08] dark:text-zinc-400"
              >
                {{ a.label }}
              </span>
            </div>
            <p class="mt-1 text-[13px] tabular-nums text-ink-muted dark:text-zinc-400">{{ a.phone }}</p>
            <p class="mt-1 text-[13px] leading-relaxed text-ink-muted dark:text-zinc-400">
              {{ formatAddress(a) }}<br />{{ stateName(a.state) }}
            </p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-black/[0.05] pt-3 dark:border-white/[0.06]">
          <button type="button" @click="startEdit(a)" class="text-[12.5px] font-semibold text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-white">
            Edit
          </button>
          <button
            v-if="!a.isDefault"
            type="button"
            @click="makeDefault(a.id)"
            class="text-[12.5px] font-semibold text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-white"
          >
            Set as default
          </button>
          <!-- Deleting the last address would leave checkout with nowhere to
               ship, and the onboarding gate would immediately ask for one
               again. Hidden rather than shown-and-refused. -->
          <button
            v-if="addresses.length > 1"
            type="button"
            @click="confirmRemove(a)"
            class="ml-auto text-[12.5px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- ── Empty ──────────────────────────────────────────────────── -->
    <div
      v-else-if="!editing"
      class="rounded-xl border border-dashed border-black/[0.14] p-6 text-center dark:border-white/[0.16]"
    >
      <p class="text-[13px] text-ink-muted dark:text-zinc-400">
        No delivery address yet.
      </p>
      <button type="button" @click="startAdd" class="mt-3 text-[13px] font-semibold text-pokemon-red hover:underline">
        Add one
      </button>
    </div>

    <!-- ── Form ───────────────────────────────────────────────────── -->
    <div v-if="editing" class="rounded-xl border border-black/[0.08] p-4 dark:border-white/[0.10]">
      <p class="mb-3 text-[14px] font-bold text-ink dark:text-white">
        {{ form.id ? "Edit address" : "New address" }}
      </p>

      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="lbl">Recipient name</span>
            <input v-model="form.name" autocomplete="name" class="field" />
          </label>
          <label class="block">
            <span class="lbl">Mobile number</span>
            <input v-model="form.phone" inputmode="tel" autocomplete="tel" class="field" />
          </label>
        </div>
        <label class="block">
          <span class="lbl">Address line 1</span>
          <input v-model="form.line1" autocomplete="address-line1" class="field" />
        </label>
        <label class="block">
          <span class="lbl">Address line 2 <span class="font-normal text-ink-soft">— optional</span></span>
          <input v-model="form.line2" autocomplete="address-line2" class="field" />
        </label>
        <div class="grid grid-cols-3 gap-3">
          <label class="block">
            <span class="lbl">Postcode</span>
            <input v-model="form.postcode" inputmode="numeric" maxlength="5" class="field tabular-nums" />
          </label>
          <label class="col-span-2 block">
            <span class="lbl">City</span>
            <input v-model="form.city" autocomplete="address-level2" class="field" />
          </label>
        </div>
        <label class="block">
          <span class="lbl">State</span>
          <select v-model="form.state" class="field">
            <option value="" disabled>Choose a state</option>
            <option v-for="s in MY_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Label <span class="font-normal text-ink-soft">— optional</span></span>
          <input v-model="form.label" placeholder="Home, Office…" class="field" />
        </label>

        <label v-if="addresses.length" class="flex items-center gap-2.5 pt-0.5">
          <input v-model="form.isDefault" type="checkbox" class="h-4 w-4 accent-pokemon-red" />
          <span class="text-[13px] text-ink dark:text-zinc-200">Use as my default</span>
        </label>
      </div>

      <p v-if="error" class="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{{ error }}</p>

      <div class="mt-4 flex gap-2">
        <button type="button" :disabled="busy" @click="save" class="btn-primary">
          <span v-if="busy" class="spinner" />Save address
        </button>
        <button type="button" :disabled="busy" @click="cancel" class="btn-ghost">Cancel</button>
      </div>
    </div>

    <p v-if="addresses.length >= MAX_ADDRESSES && !editing" class="mt-3 text-[12px] text-ink-soft dark:text-zinc-500">
      That's the maximum of {{ MAX_ADDRESSES }}. Delete one to add another.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { MY_STATES, stateName } from "~/shared/my-states";
import {
  MAX_ADDRESSES,
  formatAddress,
  isCompleteAddress,
  newAddressId,
  removeAddress,
  upsertAddress,
  withDefault,
  type Address,
} from "~/shared/addresses";

const { profile, saveAddresses } = useMyProfile();

const busy = ref(false);
const error = ref("");
const editing = ref(false);

const addresses = computed<Address[]>(() => profile.value?.addresses ?? []);
/** Default first — it's the one being used, so it reads first. */
const sorted = computed(() =>
  [...addresses.value].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)),
);

const blank = (): Address & { id: string } => ({
  id: "",
  label: "",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  postcode: "",
  city: "",
  state: "",
  isDefault: addresses.value.length === 0,
});

const form = reactive<Address>(blank());

const reset = (from?: Address) => {
  Object.assign(form, from ? { ...from } : blank());
  error.value = "";
};

const startAdd = () => {
  reset();
  editing.value = true;
};
const startEdit = (a: Address) => {
  reset(a);
  editing.value = true;
};
const cancel = () => {
  editing.value = false;
  reset();
};

const commit = async (next: Address[]) => {
  busy.value = true;
  error.value = "";
  try {
    await saveAddresses(next);
    editing.value = false;
    reset();
  } catch (e: any) {
    error.value = e?.message || "Couldn't save that. Try again.";
  } finally {
    busy.value = false;
  }
};

const save = async () => {
  if (!isCompleteAddress(form)) {
    error.value = "Fill in everything except line 2 and the label.";
    return;
  }
  const addr: Address = {
    ...form,
    id: form.id || newAddressId(),
    name: form.name.trim(),
    phone: form.phone.trim(),
    line1: form.line1.trim(),
    line2: form.line2?.trim() || "",
    postcode: form.postcode.trim(),
    city: form.city.trim(),
    label: form.label?.trim() || "",
  };
  await commit(upsertAddress(addresses.value, addr));
};

const makeDefault = (id: string) => commit(withDefault(addresses.value, id));

const confirmRemove = (a: Address) => {
  const line = `${a.name} — ${formatAddress(a)}`;
  if (!confirm(`Delete this address?\n\n${line}`)) return;
  return commit(removeAddress(addresses.value, a.id));
};
</script>

<style scoped>
.lbl {
  @apply mb-1.5 block text-xs font-semibold text-ink-muted dark:text-zinc-400;
}
.field {
  @apply w-full rounded-lg border border-black/[0.10] bg-white px-3.5 py-2.5 text-[15px]
         text-ink outline-none transition-colors placeholder:text-ink-soft
         focus:border-pokemon-red focus:ring-2 focus:ring-pokemon-red/20
         dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-white;
}
.btn-primary {
  @apply inline-flex items-center justify-center gap-2 rounded-lg bg-pokemon-red px-4 py-2
         text-[13px] font-bold text-white transition-opacity hover:opacity-90
         disabled:cursor-not-allowed disabled:opacity-50;
}
.btn-ghost {
  @apply inline-flex items-center justify-center rounded-lg border border-black/[0.10]
         px-4 py-2 text-[13px] font-semibold text-ink transition-colors
         hover:bg-black/[0.03] disabled:opacity-50
         dark:border-white/[0.12] dark:text-white dark:hover:bg-white/[0.05];
}
.spinner {
  @apply h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white;
}
</style>

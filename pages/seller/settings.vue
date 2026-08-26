<template>
  <div class="max-w-3xl mx-auto">
    <div v-if="!user" class="text-center py-16">
      <p class="text-ink-muted dark:text-zinc-400 text-lg mb-4">
        Sign in to manage your seller settings.
      </p>
      <button
        @click="signInWithGoogle"
        class="bg-ink text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div class="mb-5">
        <h1 class="text-2xl font-bold text-ink dark:text-white">Seller settings</h1>
        <p class="mt-1 text-sm text-ink-muted dark:text-zinc-400">
          How your shop ships and gets paid. Your buyer profile lives under
          <NuxtLink :to="`/profile/${user.uid}`" class="font-semibold text-pokemon-red hover:underline">
            your profile
          </NuxtLink>.
        </p>
      </div>

      <div class="surface rounded-2xl p-5 sm:p-6 space-y-7">
        <!-- Verification -->
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-ink dark:text-zinc-100">Verification</p>
            <p class="text-xs text-ink-muted dark:text-zinc-400 mt-0.5">
              Required before you can receive payouts.
            </p>
          </div>
          <span
            class="chip shrink-0"
            :class="sellerReady
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'"
          >
            {{ sellerReady ? "Verified" : "Not verified" }}
          </span>
        </div>

        <!-- Pickup address -->
        <div class="pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
          <p class="text-sm font-semibold text-ink dark:text-zinc-100 mb-1">Pickup address</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mb-2">
            Where couriers collect your parcels. Also used to quote shipping.
          </p>
          <p v-if="pickupLine" class="text-sm text-ink-subtle dark:text-zinc-200">{{ pickupLine }}</p>
          <NuxtLink
            to="/seller/verify"
            class="inline-block mt-2 text-sm font-semibold text-pokemon-red hover:underline"
          >
            {{ pickupLine ? "Edit in seller verification →" : "Add pickup address →" }}
          </NuxtLink>
        </div>

        <!-- Handover preference -->
        <div class="pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
          <p class="text-sm font-semibold text-ink dark:text-zinc-100 mb-1">Parcel handover</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mb-2">
            The cheapest couriers are drop-off only. Pick collection and we'll
            quote buyers the cheaper pickup services instead.
          </p>
          <div class="flex gap-2">
            <button
              v-for="opt in HANDOVER_OPTIONS"
              :key="opt.value"
              @click="setHandover(opt.value)"
              :disabled="savingHandover"
              class="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50"
              :class="handover === opt.value
                ? 'border-pokemon-red bg-pokemon-red/[0.06] text-pokemon-red'
                : 'border-gray-300 dark:border-white/[0.10] text-ink-subtle dark:text-zinc-200'"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Preferred couriers -->
        <div class="pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
          <p class="text-sm font-semibold text-ink dark:text-zinc-100 mb-1">Preferred couriers</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mb-2">
            We'll use the cheapest of these when one serves the buyer's address.
            Coverage varies by destination, so if none reach a buyer we fall back
            to the cheapest available rather than blocking the sale. Pick none to
            always take the cheapest.
          </p>

          <p v-if="couriersLoading" class="text-sm text-ink-soft dark:text-zinc-500">Loading couriers…</p>
          <p v-else-if="courierNotice" class="text-sm text-amber-600 dark:text-amber-400">
            {{ courierNotice }}
          </p>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="c in availableCouriers"
              :key="c"
              @click="toggleCourier(c)"
              :disabled="savingCouriers"
              class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50"
              :class="preferredCouriers.includes(c)
                ? 'border-pokemon-red bg-pokemon-red/[0.08] text-pokemon-red'
                : 'border-gray-300 dark:border-white/[0.10] text-ink-subtle dark:text-zinc-200 hover:border-gray-400'"
            >
              {{ c }}
            </button>
          </div>
          <p
            v-if="!couriersLoading && !courierNotice && !preferredCouriers.length"
            class="text-[11px] text-ink-soft dark:text-zinc-500 mt-2"
          >
            None selected — always using the cheapest available.
          </p>
        </div>

        <!-- Staff — placeholder -->
        <div class="pt-6 border-t border-black/[0.06] dark:border-white/[0.08] opacity-60">
          <div class="flex items-center gap-2 mb-1">
            <p class="text-sm font-semibold text-ink dark:text-zinc-100">Manage staff</p>
            <span class="chip">Coming soon</span>
          </div>
          <p class="text-sm text-ink-muted dark:text-zinc-400">
            Invite staff to help manage listings, orders and shipments on your behalf.
          </p>
          <button
            disabled
            class="mt-2 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-white/[0.10] text-ink-soft dark:text-zinc-400 cursor-not-allowed"
          >
            Invite staff
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { stateName } from "~/shared/my-states";

definePageMeta({ layout: "seller" });
useHead({ title: "Seller · Settings | TCGo" });

const { user, signInWithGoogle } = useAuth();
const { profile, updateProfile } = useMyProfile();
const { sellerReady } = useSellerKyc();
const { authedFetch } = useAuthedFetch();

// ── Handover preference ───────────────────────────────────────────────
const HANDOVER_OPTIONS = [
  { value: "dropoff" as const, label: "I drop off" },
  { value: "pickup" as const, label: "Courier collects" },
];
const handover = ref<"dropoff" | "pickup">("dropoff");
const savingHandover = ref(false);

watch(
  profile,
  (p) => {
    if (p) handover.value = p.handoverPreference === "pickup" ? "pickup" : "dropoff";
  },
  { immediate: true },
);

const setHandover = async (value: "dropoff" | "pickup") => {
  if (handover.value === value || savingHandover.value) return;
  const previous = handover.value;
  handover.value = value; // optimistic
  savingHandover.value = true;
  try {
    await updateProfile({ handoverPreference: value });
  } catch {
    handover.value = previous;
  } finally {
    savingHandover.value = false;
  }
};

// ── Preferred couriers ────────────────────────────────────────────────
// The list comes from Delyva, quoted against this seller's own pickup
// address, so it only offers couriers that actually serve them.
const availableCouriers = ref<string[]>([]);
const preferredCouriers = ref<string[]>([]);
const couriersLoading = ref(false);
const courierNotice = ref("");
const savingCouriers = ref(false);

const loadCouriers = async () => {
  if (!user.value || couriersLoading.value) return;
  couriersLoading.value = true;
  courierNotice.value = "";
  try {
    const res = await authedFetch<{
      available: string[];
      selected?: string[];
      reason?: string;
    }>("/api/shipping/couriers");
    availableCouriers.value = res.available || [];
    preferredCouriers.value = res.selected || [];
    if (!availableCouriers.value.length) {
      courierNotice.value =
        res.reason || "No couriers available from your pickup address yet.";
    }
  } catch (e: any) {
    courierNotice.value = e?.data?.message || "Couldn't load couriers.";
  } finally {
    couriersLoading.value = false;
  }
};

watch(user, (u) => { if (u) void loadCouriers(); }, { immediate: true });

const toggleCourier = async (courier: string) => {
  if (savingCouriers.value) return;
  const before = [...preferredCouriers.value];
  preferredCouriers.value = before.includes(courier)
    ? before.filter((c) => c !== courier)
    : [...before, courier];
  savingCouriers.value = true;
  try {
    await updateProfile({ preferredCouriers: preferredCouriers.value });
  } catch {
    preferredCouriers.value = before;
  } finally {
    savingCouriers.value = false;
  }
};

const pickupLine = computed(() => {
  const p = profile.value;
  if (!p?.pickupAddress1 || !p?.pickupPostcode) return "";
  return [
    p.pickupAddress1,
    p.pickupAddress2,
    `${p.pickupPostcode} ${p.pickupCity || ""}`.trim(),
    stateName(p.pickupState),
  ]
    .filter(Boolean)
    .join(", ");
});
</script>

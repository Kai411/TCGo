<template>
  <div class="max-w-xl mx-auto">
    <div v-if="!user" class="text-center py-12">
      <p class="text-gray-500 dark:text-zinc-400 text-lg mb-4">Sign in to manage your profile.</p>
      <button
        @click="signInWithGoogle"
        class="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
      >
        Sign in with Google
      </button>
    </div>

    <template v-else>
      <div
        v-if="saveSuccess"
        class="fixed bottom-10 right-10 text-green-600 text-sm bg-green-200 p-4 rounded"
      >
        Profile updated!
      </div>
      <h1 class="text-2xl font-bold mb-6">Settings</h1>

      <div v-if="loading" class="flex justify-center py-12">
        <div
          class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"
        ></div>
      </div>

      <div
        v-if="!loading"
        class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08] space-y-6"
      >
        <p class="text-xl font-bold">Profile</p>
        <!-- Avatar -->
        <div class="flex items-center gap-4">
          <div class="relative group">
            <img
              :src="profile?.photoURL || user.photoURL || ''"
              :alt="profile?.customName || user.displayName || 'User'"
              class="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-white/[0.10] object-cover"
            />
            <label
              class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg
                class="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handlePhotoUpload"
              />
            </label>
            <div
              v-if="uploadingPhoto"
              class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center"
            >
              <div
                class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"
              ></div>
            </div>
          </div>
          <div>
            <p class="font-bold text-lg">
              {{ profile?.customName || user.displayName }}
            </p>
            <p class="text-sm text-gray-500 dark:text-zinc-400">{{ user.email }}</p>
          </div>
        </div>

        <!-- Display Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1">
            Display Name
          </label>
          <div class="flex gap-3">
            <input
              v-model="editName"
              type="text"
              maxlength="30"
              placeholder="Your display name"
              class="flex-1 border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
            />
            <button
              @click="saveName"
              :disabled="
                saving || !editName.trim() || editName === profile?.customName
              "
              class="bg-pokemon-red text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? "Saving..." : "Save" }}
            </button>
          </div>
          <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            This name will be shown on your bids and listings.
          </p>
        </div>

        <!-- Contact Number -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1">
            Contact Number (WhatsApp)
          </label>
          <div class="flex gap-2">
            <select
              v-model="phonePrefix"
              class="border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
            >
              <option value="60">🇲🇾 +60</option>
              <option value="65">🇸🇬 +65</option>
            </select>
            <input
              v-model="phoneNumber"
              type="tel"
              placeholder="123456789"
              class="flex-1 border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
            />
          </div>
          <div class="w-full flex">
            <button
              v-if="fullPhone !== profile?.whatsappNumber"
              @click="savePhone"
              :disabled="savingPhone || !phoneNumber"
              class="bg-pokemon-red w-full mt-2 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ savingPhone ? "..." : "Save" }}
            </button>
          </div>

          <p v-if="phoneError" class="text-red-500 text-xs mt-1">
            {{ phoneError }}
          </p>
          <p v-else class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Enter without leading 0. E.g. 123456789
          </p>
        </div>

        <div class="pt-4 border-t border-gray-200 dark:border-white/[0.08]">
          <p class="text-sm text-gray-500 dark:text-zinc-400">
            Your public profile:
            <NuxtLink
              :to="`/profile/${user.uid}`"
              class="text-pokemon-red hover:underline"
            >
              View profile →
            </NuxtLink>
          </p>
        </div>
      </div>

      <div
        v-if="!loading"
        class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08] space-y-6 mt-4"
      >
        <p class="text-xl font-bold">Shipping</p>

        <!-- Shipping Defaults -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-2">
            Default Shipping (RM)
          </label>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-500 dark:text-zinc-400 mb-1"
                >West Malaysia</label
              >
              <input
                v-model.number="editShippingWM"
                type="number"
                min="0"
                step="0.01"
                class="w-full border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-zinc-400 mb-1"
                >East Malaysia</label
              >
              <input
                v-model.number="editShippingEM"
                type="number"
                min="0"
                step="0.01"
                class="w-full border border-gray-300 dark:border-white/[0.10] dark:bg-white/[0.06] rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:border-pokemon-red focus:outline-none focus:ring-1 focus:ring-pokemon-red"
              />
            </div>
          </div>
          <button
            v-if="
              editShippingWM !== profile?.shippingWM ||
              editShippingEM !== profile?.shippingEM
            "
            @click="saveShipping"
            :disabled="savingShipping"
            class="mt-2 bg-pokemon-red text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {{ savingShipping ? "Saving..." : "Save Shipping" }}
          </button>
          <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Used as default when creating new listings.
          </p>
        </div>
      </div>

      <div
        v-if="!loading && premiumEnabled"
        class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08] space-y-4 mt-4"
      >
        <div class="flex items-center justify-between">
          <p class="text-xl font-bold">Membership</p>
          <span
            v-if="isPremium"
            class="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300"
          >
            Premium
          </span>
          <span
            v-else
            class="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-ink/[0.06] text-ink-muted dark:bg-white/[0.06] dark:text-zinc-300"
          >
            Free
          </span>
        </div>

        <!-- Premium: active subscription info -->
        <template v-if="isPremium">
          <p class="text-sm text-gray-500 dark:text-zinc-400">
            Unlimited card scans. Thanks for supporting TCGo.
          </p>
          <div v-if="profile?.currentPeriodEnd" class="text-xs text-gray-400 dark:text-zinc-500">
            <span v-if="profile.cancelAtPeriodEnd">
              Cancels on {{ periodEndLabel }}. You keep Premium until then.
            </span>
            <span v-else>Renews {{ periodEndLabel }}</span>
          </div>
          <button
            v-if="profile?.stripeCustomerId"
            @click="openPortal"
            :disabled="portalLoading"
            class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {{ portalLoading ? 'Opening...' : 'Manage subscription →' }}
          </button>
        </template>

        <!-- Free: scan usage bar -->
        <template v-else>
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-gray-700 dark:text-zinc-200">Card scans</p>
              <p class="text-sm font-medium tabular-nums">
                {{ scansUsed }}/{{ FREE_SCAN_LIMIT }}
                <span v-if="bonusRemaining > 0" class="ml-1 text-xs text-blue-500">(+{{ bonusRemaining }} bonus)</span>
              </p>
            </div>
            <div class="w-full h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
              <div
                class="h-full bg-pokemon-red transition-all"
                :style="{ width: `${Math.min(100, (scansUsed / FREE_SCAN_LIMIT) * 100)}%` }"
              ></div>
            </div>
            <p class="text-xs text-gray-400 dark:text-zinc-500 mt-2">
              Resets {{ scansResetLabel }}.
            </p>
          </div>

          <!-- Bonus scans trial (one-time) -->
          <div
            v-if="!hasClaimedBonus"
            class="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3"
          >
            <div>
              <p class="text-sm font-semibold text-blue-900 dark:text-blue-200">Try before you upgrade</p>
              <p class="text-xs text-blue-700 dark:text-blue-300 mt-0.5">Claim +5 free bonus scans — no payment needed.</p>
            </div>
            <button
              @click="handleClaimBonus"
              :disabled="claimingBonus"
              class="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {{ claimingBonus ? '...' : 'Claim' }}
            </button>
          </div>

          <!-- Upgrade CTA -->
          <div class="flex items-center gap-3 flex-wrap">
            <button
              @click="handleUpgrade"
              :disabled="upgradeLoading"
              class="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-ink px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {{ upgradeLoading ? 'Redirecting...' : 'Upgrade to Premium · RM 5.99/mo' }}
            </button>
            <NuxtLink to="/pricing" class="text-xs text-gray-400 dark:text-zinc-500 hover:text-ink dark:hover:text-white transition-colors">
              Compare plans →
            </NuxtLink>
          </div>
        </template>
      </div>

      <div
        v-if="!loading"
        class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08] space-y-6 mt-4"
      >
        <p class="text-xl font-bold">Appearance</p>

        <!-- Dark mode -->
        <div>
          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-zinc-200">Dark mode</p>
              <p class="text-xs text-gray-400 dark:text-zinc-500">
                Switch between light and dark themes
              </p>
            </div>
            <ThemeToggle />
          </label>
        </div>
      </div>

      <div
        v-if="!loading"
        class="bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08] space-y-6 mt-4"
      >
        <p class="text-xl font-bold">Privacy</p>

        <!-- Privacy Settings -->
        <div>
          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-zinc-200">Favourites</p>
              <p class="text-xs text-gray-400 dark:text-zinc-500">
                Others can see your favourited cards
              </p>
            </div>
            <input
              type="checkbox"
              :checked="editFavouritesPublic"
              @change="toggleFavouritesPublic"
              class="w-5 h-5 rounded border-gray-300 dark:border-white/[0.20] dark:bg-white/[0.06] text-pokemon-red focus:ring-pokemon-red cursor-pointer"
            />
          </label>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { UserProfile } from "~/composables/useProfile";

const { user, signInWithGoogle } = useAuth();
const { profile, loading, updateProfile, updateCustomName } = useMyProfile();
const { uploadImage } = useStorage();
const { premiumEnabled } = useFeatureFlags();
const { isPremium, used: scansUsed, hasClaimedBonus, bonusRemaining, claimBonusScans } = useScanQuota();
const FREE_SCAN_LIMIT = 20;

const scansResetLabel = computed(() => {
  if (!profile.value?.scansResetAt) return "next month";
  return new Date(profile.value.scansResetAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
});

const periodEndLabel = computed(() => {
  if (!profile.value?.currentPeriodEnd) return "";
  return new Date(profile.value.currentPeriodEnd).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
});

const upgradeLoading = ref(false);
const portalLoading = ref(false);
const claimingBonus = ref(false);

const handleUpgrade = async () => {
  if (!user.value) return;
  upgradeLoading.value = true;
  try {
    const res = await $fetch<{ url: string }>('/api/stripe/checkout', {
      method: 'POST',
      body: { type: 'subscription', uid: user.value.uid, email: user.value.email },
    });
    if (res.url) window.location.href = res.url;
  } catch (e: any) {
    alert(e?.data?.message || 'Failed to start checkout.');
  } finally {
    upgradeLoading.value = false;
  }
};

const openPortal = async () => {
  if (!profile.value?.stripeCustomerId) return;
  portalLoading.value = true;
  try {
    const res = await $fetch<{ url: string }>('/api/stripe/portal', {
      method: 'POST',
      body: { customerId: profile.value.stripeCustomerId },
    });
    if (res.url) window.location.href = res.url;
  } catch (e: any) {
    alert(e?.data?.message || 'Failed to open portal.');
  } finally {
    portalLoading.value = false;
  }
};

const handleClaimBonus = async () => {
  claimingBonus.value = true;
  try {
    await claimBonusScans();
  } finally {
    claimingBonus.value = false;
  }
};

const editName = ref("");
const phonePrefix = ref("60");
const phoneNumber = ref("");
const phoneError = ref("");
const editShippingWM = ref(8);
const editShippingEM = ref(12);
const editFavouritesPublic = ref(true);
const saving = ref(false);
const savingPhone = ref(false);
const savingShipping = ref(false);
const saveSuccess = ref(false);
const uploadingPhoto = ref(false);

const fullPhone = computed(() => {
  const num = phoneNumber.value.replace(/^0+/, ""); // strip leading zeros
  return num ? `${phonePrefix.value}${num}` : "";
});

watch(
  profile,
  (p: UserProfile | null) => {
    if (p) {
      editName.value = p.customName || p.displayName;
      editShippingWM.value = p.shippingWM ?? 8;
      editShippingEM.value = p.shippingEM ?? 12;
      editFavouritesPublic.value = p.favouritesPublic ?? true;

      // Parse existing phone into prefix + number
      const existing = p.whatsappNumber || p.phone || "";
      if (existing.startsWith("65")) {
        phonePrefix.value = "65";
        phoneNumber.value = existing.slice(2);
      } else if (existing.startsWith("60")) {
        phonePrefix.value = "60";
        phoneNumber.value = existing.slice(2);
      } else {
        phoneNumber.value = existing.replace(/^\+/, "");
      }
    }
  },
  { immediate: true },
);

const saveName = async () => {
  if (!editName.value.trim()) return;
  saving.value = true;
  saveSuccess.value = false;
  try {
    await updateCustomName(editName.value.trim());
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } finally {
    saving.value = false;
  }
};

const savePhone = async () => {
  phoneError.value = "";

  // Validate
  const num = phoneNumber.value.replace(/^0+/, "").replace(/\D/g, "");
  if (!num || num.length < 7 || num.length > 12) {
    phoneError.value =
      "Please enter a valid phone number (7-12 digits, no leading 0)";
    return;
  }

  const formattedPhone = `${phonePrefix.value}${num}`;

  savingPhone.value = true;
  saveSuccess.value = false;
  try {
    await updateProfile({
      phone: formattedPhone,
      whatsappNumber: formattedPhone,
      usePhoneAsWhatsapp: true,
    });
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } finally {
    savingPhone.value = false;
  }
};

const saveShipping = async () => {
  savingShipping.value = true;
  saveSuccess.value = false;
  try {
    await updateProfile({
      shippingWM: editShippingWM.value,
      shippingEM: editShippingEM.value,
    });
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } finally {
    savingShipping.value = false;
  }
};

const toggleFavouritesPublic = async () => {
  editFavouritesPublic.value = !editFavouritesPublic.value;
  await updateProfile({ favouritesPublic: editFavouritesPublic.value });
};

const handlePhotoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Image must be under 5MB.");
    return;
  }

  uploadingPhoto.value = true;
  try {
    const photoURL = await uploadImage(file);
    await updateProfile({ photoURL });
  } catch (e: any) {
    alert(e.message || "Failed to upload photo.");
  } finally {
    uploadingPhoto.value = false;
  }
};
</script>

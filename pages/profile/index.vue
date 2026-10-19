<template>
  <div class="max-w-xl mx-auto space-y-4">
    <div v-if="!user" class="text-center py-12">
      <p class="text-sm text-ink-muted dark:text-zinc-400 mb-4">Sign in to manage your account.</p>
      <button
        type="button"
        @click="goToLogin"
        class="min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
      >
        Sign in
      </button>
    </div>

    <template v-else>
      <!-- Profile, sign-in, notifications and membership. Addresses, dark
           mode and the customer code each have their own place on the
           Account page. Each section is a card on phones too (kai 10-19):
           settings pages have room for cards; only listings go flat. -->
      <SubpageHeader title="Account settings" desktop-title />

      <Transition name="toast">
        <p
          v-if="saveSuccess"
          role="status"
          class="fixed z-50 left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-8 px-4 py-2.5 rounded-full text-sm font-medium bg-ink text-white dark:bg-white dark:text-ink shadow-lg"
        >
          Saved
        </p>
      </Transition>

      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-pokemon-red"></div>
      </div>

      <template v-else>
        <!-- Who you are: photo, name, email, and the public page others see. -->
        <section class="surface rounded-2xl p-4 lg:p-5 flex items-center gap-4">
          <label class="relative shrink-0 cursor-pointer press" aria-label="Change photo">
            <img
              v-if="profile?.photoURL || user.photoURL"
              :src="profile?.photoURL || user.photoURL || ''"
              alt=""
              class="w-16 h-16 rounded-full object-cover border border-black/[0.08] dark:border-white/[0.10]"
            />
            <span
              v-else
              class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-white"
            >
              {{ initial }}
            </span>
            <!-- Always visible: phones have no hover to reveal it. -->
            <span
              class="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center bg-ink text-white dark:bg-white dark:text-ink ring-2 ring-[#F7F7F8] dark:ring-[#0E0E11]"
            >
              <svg class="w-3.5 h-3.5" v-bind="stroke" stroke-width="2.2">
                <path d="M3 9a2 2 0 0 1 2-2h.9a2 2 0 0 0 1.7-.9l.8-1.2A2 2 0 0 1 10.1 4h3.8a2 2 0 0 1 1.7.9l.8 1.2a2 2 0 0 0 1.7.9H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </span>
            <span
              v-if="uploadingPhoto"
              class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center"
            >
              <span class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            </span>
            <input type="file" accept="image/*" class="sr-only" @change="handlePhotoUpload" />
          </label>
          <div class="min-w-0 flex-1">
            <p class="text-base font-bold text-ink dark:text-white truncate">
              {{ profile?.customName || user.displayName }}
            </p>
            <p class="text-sm text-ink-muted dark:text-zinc-400 truncate">{{ user.email }}</p>
            <NuxtLink
              :to="`/profile/${user.uid}`"
              class="inline-flex items-center gap-0.5 mt-1 min-h-[32px] text-sm font-semibold text-pokemon-red"
            >
              View public profile
              <svg class="w-4 h-4" v-bind="stroke" stroke-width="2.5"><path d="m9 18 6-6-6-6" /></svg>
            </NuxtLink>
          </div>
        </section>

        <!-- Profile details -->
        <section class="surface rounded-2xl p-4 lg:p-5 space-y-5">
          <h2 class="text-base font-bold text-ink dark:text-white">Profile</h2>

          <div>
            <label for="display-name" class="block text-xs font-medium text-ink-muted dark:text-zinc-400 mb-1.5">
              Display name
            </label>
            <div class="flex gap-2">
              <input
                id="display-name"
                v-model="editName"
                type="text"
                maxlength="30"
                placeholder="Your display name"
                :class="field"
              />
              <button
                v-if="editName.trim() && editName !== profile?.customName"
                type="button"
                :disabled="saving"
                :class="saveBtn"
                @click="saveName"
              >
                {{ saving ? "Saving…" : "Save" }}
              </button>
            </div>
            <p class="text-xs text-ink-soft dark:text-zinc-500 mt-1.5">Shown on your bids and listings.</p>
          </div>

          <div>
            <label for="mobile" class="block text-xs font-medium text-ink-muted dark:text-zinc-400 mb-1.5">
              Mobile number
            </label>
            <div class="flex gap-2">
              <select v-model="phonePrefix" aria-label="Country code" :class="field" class="!flex-none w-[7.25rem] !pr-8">
                <option value="60">🇲🇾 +60</option>
                <option value="65">🇸🇬 +65</option>
              </select>
              <input
                id="mobile"
                v-model="phoneNumber"
                type="tel"
                inputmode="numeric"
                placeholder="123456789"
                :class="field"
              />
              <button
                v-if="phoneNumber && fullPhone !== profile?.whatsappNumber"
                type="button"
                :disabled="savingPhone"
                :class="saveBtn"
                @click="savePhone"
              >
                {{ savingPhone ? "Saving…" : "Save" }}
              </button>
            </div>
            <p v-if="phoneError" class="text-xs text-pokemon-red mt-1.5">{{ phoneError }}</p>
            <p v-else class="text-xs text-ink-soft dark:text-zinc-500 mt-1.5">Without the leading 0, e.g. 123456789.</p>
          </div>
        </section>

        <!-- How this account signs in. Change password only exists for
             email and password accounts; Google ones manage it at Google. -->
        <section class="surface rounded-2xl pt-4 lg:pt-5 overflow-hidden">
          <h2 class="text-base font-bold text-ink dark:text-white px-4 mb-1">Sign-in and security</h2>
          <div class="divide-y divide-black/[0.05] dark:divide-white/[0.06] border-t border-black/[0.05] dark:border-white/[0.06] mt-2">
            <div
              v-for="p in providers"
              :key="p.id"
              class="flex items-center gap-4 px-4 min-h-[56px]"
            >
              <span
                class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
              >
                <svg v-if="p.id === 'google.com'" class="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
                  <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
                  <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
                </svg>
                <svg v-else-if="p.id === 'password'" class="w-[18px] h-[18px]" v-bind="stroke">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <svg v-else class="w-[18px] h-[18px]" v-bind="stroke">
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                  <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                </svg>
              </span>
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-medium text-ink dark:text-white">{{ p.label }}</span>
                <span v-if="p.email" class="block text-xs text-ink-soft dark:text-zinc-500 truncate">{{ p.email }}</span>
              </span>
              <span
                class="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                Connected
              </span>
            </div>
            <ChangePasswordRow v-if="hasPassword" />
          </div>
        </section>

        <!-- Seller settings live on their own page: shipping, couriers and
             staff are shop operations, not buyer profile preferences. -->
        <section
          v-if="sellerReady"
          class="surface rounded-2xl pt-4 lg:pt-5 overflow-hidden"
        >
          <h2 class="text-base font-bold text-ink dark:text-white px-4 mb-1">Selling</h2>
          <NuxtLink to="/seller/settings" class="press flex items-center gap-4 px-4 min-h-[56px]">
            <span
              class="w-9 h-9 shrink-0 rounded-xl border border-black/[0.08] dark:border-white/[0.10] text-ink dark:text-zinc-200 flex items-center justify-center"
            >
              <svg class="w-[18px] h-[18px]" v-bind="stroke">
                <path d="M3 9h18M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
              </svg>
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-sm font-medium text-ink dark:text-white">Seller settings</span>
              <span class="block text-xs text-ink-soft dark:text-zinc-500 truncate">Pickup, parcel handover, couriers and staff</span>
            </span>
            <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" v-bind="stroke" stroke-width="2.5"><path d="m9 18 6-6-6-6" /></svg>
          </NuxtLink>
        </section>

        <!-- Notifications live here too, so Account has one settings row. -->
        <PushSettings id="notifications" class="scroll-mt-20" />

      </template>

      <div
        v-if="!loading && premiumEnabled"
        class="surface rounded-2xl p-4 lg:p-5 space-y-4"
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
            <NuxtLink to="/membership" class="text-xs text-gray-400 dark:text-zinc-500 hover:text-ink dark:hover:text-white transition-colors">
              Compare plans →
            </NuxtLink>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { UserProfile } from "~/composables/useProfile";
import { MY_STATES } from "~/shared/my-states";

const {user} = useAuth();
const { goToLogin } = useSignInGate();
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

const { authedFetch } = useAuthedFetch();

const handleUpgrade = async () => {
  if (!user.value) return;
  upgradeLoading.value = true;
  try {
    const res = await authedFetch<{ url: string }>('/api/stripe/checkout', { method: 'POST' });
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
    const res = await authedFetch<{ url: string }>('/api/stripe/portal', { method: 'POST' });
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


const saving = ref(false);
const savingPhone = ref(false);
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

const { sellerReady } = useSellerKyc();

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};
const field =
  "flex-1 min-w-0 h-11 rounded-xl border border-black/[0.10] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] px-3.5 text-base text-ink dark:text-white placeholder:text-ink-soft dark:placeholder:text-zinc-500 focus:border-ink dark:focus:border-white focus:outline-none focus:ring-0";
const saveBtn =
  "press shrink-0 h-11 px-4 rounded-xl text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-50";

const initial = computed(() =>
  (profile.value?.customName || user.value?.displayName || user.value?.email || "?").charAt(0).toUpperCase(),
);

// Each way this account can sign in, from Firebase's linked providers.
const PROVIDER_LABELS: Record<string, string> = {
  password: "Email and password",
  "google.com": "Google",
  "apple.com": "Apple",
  "facebook.com": "Facebook",
};
const providers = computed(() =>
  (user.value?.providerData ?? []).map((p) => ({
    id: p.providerId,
    label: PROVIDER_LABELS[p.providerId] ?? p.providerId,
    email: p.email ?? "",
  })),
);
const hasPassword = computed(() => providers.value.some((p) => p.id === "password"));

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

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active:not(:disabled) {
  transform: scale(0.97);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>

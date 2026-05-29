<template>
  <div class="max-w-2xl mx-auto">
    <div class="text-center mb-10">
      <h1 class="text-3xl font-extrabold text-ink dark:text-white mb-2">Simple, fair pricing</h1>
      <p class="text-gray-500 dark:text-zinc-400">Start free. Upgrade when you need more.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
      <!-- Free tier -->
      <div class="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/[0.08] p-6 flex flex-col">
        <div class="mb-4">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Free</span>
          <p class="text-3xl font-extrabold mt-1 text-ink dark:text-white">RM 0</p>
          <p class="text-sm text-gray-400 dark:text-zinc-500">/ month</p>
        </div>
        <ul class="space-y-2.5 flex-1 mb-6">
          <li v-for="feat in freeFeatures" :key="feat" class="flex items-center gap-2.5 text-sm text-gray-700 dark:text-zinc-200">
            <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {{ feat }}
          </li>
          <li class="flex items-center gap-2.5 text-sm text-gray-400 dark:text-zinc-500">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Unlimited card scans
          </li>
        </ul>
        <div v-if="!user" class="w-full text-center text-sm text-gray-400 dark:text-zinc-500 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08]">
          Current plan
        </div>
        <div v-else-if="isPremium" class="w-full text-center text-sm text-gray-400 dark:text-zinc-500 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08]">
          Downgrade via Manage Subscription
        </div>
        <div v-else class="w-full text-center text-sm font-semibold text-ink dark:text-white py-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.06]">
          Your current plan
        </div>
      </div>

      <!-- Premium tier -->
      <div class="bg-white dark:bg-white/[0.04] rounded-2xl border-2 border-amber-400 dark:border-amber-500 p-6 flex flex-col relative overflow-hidden">
        <div class="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">Popular</div>
        <div class="mb-4">
          <span class="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Premium</span>
          <p class="text-3xl font-extrabold mt-1 text-ink dark:text-white">RM 5.99</p>
          <p class="text-sm text-gray-400 dark:text-zinc-500">/ month</p>
        </div>
        <ul class="space-y-2.5 flex-1 mb-6">
          <li v-for="feat in premiumFeatures" :key="feat" class="flex items-center gap-2.5 text-sm text-gray-700 dark:text-zinc-200">
            <svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {{ feat }}
          </li>
        </ul>

        <div v-if="isPremium" class="space-y-2">
          <div class="w-full text-center text-sm font-semibold text-amber-700 dark:text-amber-300 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            Your current plan
          </div>
          <button
            v-if="profile?.stripeCustomerId"
            @click="openPortal"
            :disabled="portalLoading"
            class="w-full text-sm text-gray-500 dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
          >
            {{ portalLoading ? 'Opening...' : 'Manage subscription →' }}
          </button>
        </div>

        <div v-else-if="!user" class="space-y-2">
          <button
            @click="signInWithGoogle"
            class="w-full bg-amber-500 hover:bg-amber-400 text-ink font-bold py-3 rounded-xl transition-colors"
          >
            Sign in to upgrade
          </button>
        </div>

        <div v-else class="space-y-2">
          <button
            @click="handleUpgrade"
            :disabled="checkoutLoading"
            class="w-full bg-amber-500 hover:bg-amber-400 text-ink font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {{ checkoutLoading ? 'Redirecting...' : 'Upgrade to Premium' }}
          </button>
          <p class="text-center text-xs text-gray-400 dark:text-zinc-500">
            Cancel anytime. Card payment only.
          </p>
        </div>
      </div>
    </div>

    <!-- Trial CTA -->
    <div
      v-if="user && !isPremium && !hasClaimedBonus"
      class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5 flex items-center gap-4 mb-8"
    >
      <div class="flex-1">
        <p class="font-semibold text-blue-900 dark:text-blue-200 text-sm">Not sure yet?</p>
        <p class="text-blue-700 dark:text-blue-300 text-xs mt-0.5">Claim +5 free bonus scans to try the scanner without a subscription.</p>
      </div>
      <button
        @click="handleClaimBonus"
        :disabled="claimingBonus"
        class="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
      >
        {{ claimingBonus ? '...' : 'Claim +5' }}
      </button>
    </div>

    <p class="text-center text-xs text-gray-400 dark:text-zinc-500 mb-8">
      Secure payment via Stripe. Cancel anytime through your subscription portal.
    </p>
  </div>
</template>

<script setup lang="ts">
import { PREMIUM_ENABLED } from "~/composables/useFeatureFlags";

// Premium is hidden for now — keep the page unreachable while the flag is off.
definePageMeta({
  middleware: () => {
    if (!PREMIUM_ENABLED) return navigateTo("/", { replace: true });
  },
});

useHead({ title: 'Pricing | TCGo Marketplace' });

const { user, signInWithGoogle } = useAuth();
const { profile } = useMyProfile();
const { isPremium, hasClaimedBonus, claimBonusScans } = useScanQuota();

const checkoutLoading = ref(false);
const portalLoading = ref(false);
const claimingBonus = ref(false);

const freeFeatures = [
  'List cards & auctions',
  '20 AI card scans / month',
  'WhatsApp seller contact',
  'Stripe-protected purchases',
];

const premiumFeatures = [
  'Everything in Free',
  'Unlimited AI card scans',
  'Priority support',
  'Early access to new features',
];

const handleUpgrade = async () => {
  if (!user.value) return;
  checkoutLoading.value = true;
  try {
    const res = await $fetch<{ url: string }>('/api/stripe/checkout', {
      method: 'POST',
      body: {
        type: 'subscription',
        uid: user.value.uid,
        email: user.value.email,
      },
    });
    if (res.url) window.location.href = res.url;
  } catch (e: any) {
    alert(e?.data?.message || 'Failed to start checkout. Please try again.');
  } finally {
    checkoutLoading.value = false;
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
    alert(e?.data?.message || 'Failed to open portal. Please try again.');
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
</script>

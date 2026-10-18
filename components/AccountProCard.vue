<template>
  <!-- TCGo Pro on the Account tab: what the member is on and the one action
       that fits it. Free members see what Pro adds and upgrade through the
       existing Stripe checkout; Pro members manage it in the Stripe portal. -->
  <section
    class="panel surface rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
    aria-labelledby="account-pro-title"
  >
    <div class="flex items-center gap-4">
      <span
        class="w-10 h-10 shrink-0 rounded-xl bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 flex items-center justify-center"
      >
        <svg
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2">
          <span id="account-pro-title" class="text-sm font-bold text-ink dark:text-white">TCGo Pro</span>
          <span
            class="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full"
            :class="isPremium
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'bg-black/[0.06] text-ink-muted dark:bg-white/[0.08] dark:text-zinc-300'"
          >
            {{ isPremium ? "Active" : "Free plan" }}
          </span>
        </p>
        <p class="text-xs text-ink-soft dark:text-zinc-500 mt-0.5">{{ subline }}</p>
      </div>
    </div>

    <!-- Free: how much of the monthly scan cap is gone, since that cap is
         the whole reason to upgrade. -->
    <div v-if="!isPremium" class="mt-4">
      <div class="flex items-center justify-between text-xs text-ink-muted dark:text-zinc-400">
        <span>Card scans this month</span>
        <span class="tabular-nums">{{ usedClamped }} of {{ FREE_SCANS_MONTHLY }}</span>
      </div>
      <div class="mt-1.5 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
        <div
          class="h-full rounded-full bg-amber-500 origin-left transition-transform duration-300"
          :style="{ transform: `scaleX(${usedClamped / FREE_SCANS_MONTHLY})` }"
        />
      </div>
    </div>

    <p
      v-if="isPremium && profile?.subscriptionStatus === 'past_due'"
      class="mt-3 text-xs font-medium text-pokemon-red"
    >
      Your last payment didn't go through. Update your card to keep Pro.
    </p>

    <button
      v-if="!isPremium"
      type="button"
      :disabled="busy"
      @click="upgrade"
      class="press mt-4 w-full min-h-[44px] rounded-full text-sm font-semibold bg-amber-500 text-amber-950 disabled:opacity-60"
    >
      {{ busy ? "Opening checkout…" : `Upgrade to Pro · RM${MARKETPLACE_MONTHLY}/month` }}
    </button>
    <button
      v-else-if="profile?.stripeCustomerId"
      type="button"
      :disabled="busy"
      @click="manage"
      class="press mt-4 w-full min-h-[44px] rounded-full text-sm font-semibold border border-black/[0.12] dark:border-white/[0.16] text-ink dark:text-white disabled:opacity-60"
    >
      {{ busy ? "Opening billing…" : "Manage billing" }}
    </button>

    <p v-if="error" class="mt-2 text-xs text-pokemon-red" role="alert">{{ error }}</p>
    <p v-else-if="!isPremium" class="mt-2 text-center text-[11px] text-ink-soft dark:text-zinc-500">
      Card payment through Stripe. Cancel anytime.
      <NuxtLink to="/pricing" class="font-semibold text-ink-muted dark:text-zinc-300 underline underline-offset-2">Compare plans</NuxtLink>
    </p>
  </section>
</template>

<script setup lang="ts">
import { FREE_SCANS_MONTHLY, MARKETPLACE_MONTHLY } from "~/shared/pricing";

const { profile } = useMyProfile();
const { isPremium, used } = useScanQuota();
const { authedFetch } = useAuthedFetch();

const usedClamped = computed(() => Math.min(used.value, FREE_SCANS_MONTHLY));

const periodEnd = computed(() =>
  profile.value?.currentPeriodEnd
    ? new Date(profile.value.currentPeriodEnd).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "",
);

const subline = computed(() => {
  if (!isPremium.value) return "Unlimited card scans and early access";
  if (!periodEnd.value) return "Unlimited card scans";
  return profile.value?.cancelAtPeriodEnd
    ? `Ends ${periodEnd.value}. You keep Pro until then.`
    : `Unlimited card scans · Renews ${periodEnd.value}`;
});

const busy = ref(false);
const error = ref("");

// Both endpoints hand back a Stripe-hosted URL; the page leaves for it, so
// `busy` only resets when something went wrong.
const go = async (endpoint: string, body?: Record<string, string>) => {
  busy.value = true;
  error.value = "";
  try {
    const res = await authedFetch<{ url: string }>(endpoint, { method: "POST", body });
    if (res.url) {
      window.location.href = res.url;
      return;
    }
    error.value = "Couldn't open Stripe. Please try again.";
  } catch (e: any) {
    error.value = e?.data?.message || "Couldn't open Stripe. Please try again.";
  }
  busy.value = false;
};

const upgrade = () => go("/api/stripe/checkout");
const manage = () => go("/api/stripe/portal", { returnTo: "/account" });
</script>

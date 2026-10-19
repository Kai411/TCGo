<template>
  <!-- TCGo Pro as one row of the Account settings list, on a light brand
       wash so it stands out from the plain rows below. The wash bleeds 8px
       into the page gutter (-mx-2 px-2) so the icon, label and chevron line
       up exactly with the rows under it. The row says which
       plan the member is on; tapping it opens a sheet with the one action
       that fits: Upgrade (Stripe checkout) or Manage billing (Stripe portal). -->
  <button
    type="button"
    class="press -mx-2 px-2 w-[calc(100%+1rem)] lg:mx-0 lg:px-4 lg:w-full text-left flex items-center gap-4 min-h-[56px] rounded-xl lg:rounded-none bg-pokemon-red/[0.06] dark:bg-pokemon-red/[0.14]"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <span
      class="w-9 h-9 shrink-0 rounded-xl bg-pokemon-red/[0.10] dark:bg-pokemon-red/[0.20] text-pokemon-red dark:text-red-400 flex items-center justify-center"
    >
      <svg class="w-[18px] h-[18px]" v-bind="stroke"><path :d="STAR" /></svg>
    </span>
    <span class="flex-1 text-sm font-semibold text-ink dark:text-white">TCGo Pro</span>
    <span
      class="text-xs font-medium"
      :class="paymentFailed ? 'text-pokemon-red' : 'text-ink-soft dark:text-zinc-500'"
    >
      {{ rowStatus }}
    </span>
    <svg class="w-4 h-4 shrink-0 text-ink-soft dark:text-zinc-500" v-bind="stroke" stroke-width="2.5">
      <path d="m9 18 6-6-6-6" />
    </svg>
  </button>

  <Teleport to="body">
    <Transition name="pro-sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center sm:p-4 bg-black/40"
        @click.self="open = false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-sheet-title"
          class="pro-sheet-panel surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] px-5 pt-2 sm:pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div class="sm:hidden mx-auto mb-4 h-1 w-9 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />

          <p id="pro-sheet-title" class="text-lg font-bold text-ink dark:text-white">TCGo Pro</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mt-1">{{ summary }}</p>

          <!-- Free: how much of the monthly scan cap is gone, since that cap
               is what Pro lifts. -->
          <div v-if="!isPremium" class="mt-5">
            <div class="flex items-center justify-between text-xs text-ink-muted dark:text-zinc-400">
              <span>Card scans this month</span>
              <span class="tabular-nums">{{ usedClamped }} of {{ FREE_SCANS_MONTHLY }}</span>
            </div>
            <div class="mt-1.5 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
              <div
                class="h-full rounded-full bg-ink dark:bg-white origin-left"
                :style="{ transform: `scaleX(${usedClamped / FREE_SCANS_MONTHLY})` }"
              />
            </div>
          </div>

          <p v-if="paymentFailed" class="mt-4 text-sm font-medium text-pokemon-red">
            Your last payment didn't go through. Update your card to keep Pro.
          </p>

          <button
            v-if="!isPremium"
            type="button"
            :disabled="busy"
            class="press mt-5 w-full min-h-[48px] rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-60"
            @click="go('/api/stripe/checkout')"
          >
            {{ busy ? "Opening checkout…" : `Upgrade to Pro · RM${MARKETPLACE_MONTHLY}/month` }}
          </button>
          <button
            v-else-if="profile?.stripeCustomerId"
            type="button"
            :disabled="busy"
            class="press mt-5 w-full min-h-[48px] rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-60"
            @click="go('/api/stripe/portal', { returnTo: '/account' })"
          >
            {{ busy ? "Opening billing…" : "Manage billing" }}
          </button>

          <p v-if="error" class="mt-2 text-xs text-pokemon-red" role="alert">{{ error }}</p>

          <NuxtLink
            v-if="!isPremium"
            to="/pricing"
            class="press mt-2 flex items-center justify-center min-h-[44px] text-sm font-semibold text-ink dark:text-white"
          >
            Compare plans
          </NuxtLink>
          <p v-if="!isPremium" class="text-center text-[11px] text-ink-soft dark:text-zinc-500">
            Card payment through Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { FREE_SCANS_MONTHLY, MARKETPLACE_MONTHLY } from "~/shared/pricing";

const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};

const { profile } = useMyProfile();
const { isPremium, used } = useScanQuota();
const { authedFetch } = useAuthedFetch();

const open = ref(false);
const usedClamped = computed(() => Math.min(used.value, FREE_SCANS_MONTHLY));
const paymentFailed = computed(
  () => isPremium.value && profile.value?.subscriptionStatus === "past_due",
);

const periodEnd = computed(() =>
  profile.value?.currentPeriodEnd
    ? new Date(profile.value.currentPeriodEnd).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "",
);

const rowStatus = computed(() => {
  if (paymentFailed.value) return "Payment failed";
  return isPremium.value ? "Active" : "Free";
});

const summary = computed(() => {
  if (!isPremium.value) return "Unlimited card scans and early access to new features.";
  if (!periodEnd.value) return "Active. Unlimited card scans.";
  return profile.value?.cancelAtPeriodEnd
    ? `Ends ${periodEnd.value}. You keep Pro until then.`
    : `Active. Unlimited card scans. Renews ${periodEnd.value}.`;
});

// Close on Escape for keyboard users; the backdrop handles taps.
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};
watch(open, (v) => {
  if (v) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

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
</script>

<style scoped>
.press {
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.press:active {
  transform: scale(0.97);
}
.pro-sheet-enter-active,
.pro-sheet-leave-active {
  transition: background-color 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.pro-sheet-enter-active .pro-sheet-panel,
.pro-sheet-leave-active .pro-sheet-panel {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease;
}
.pro-sheet-enter-from,
.pro-sheet-leave-to {
  background-color: transparent;
}
.pro-sheet-enter-from .pro-sheet-panel,
.pro-sheet-leave-to .pro-sheet-panel {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .pro-sheet-enter-from .pro-sheet-panel,
  .pro-sheet-leave-to .pro-sheet-panel {
    transform: scale(0.96);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pro-sheet-enter-active .pro-sheet-panel,
  .pro-sheet-leave-active .pro-sheet-panel {
    transition: none;
  }
}
</style>

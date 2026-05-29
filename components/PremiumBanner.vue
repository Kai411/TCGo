<template>
  <Transition
    enter-active-class="transition-all duration-300"
    enter-from-class="opacity-0 -translate-y-2"
    leave-active-class="transition-all duration-200"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="visible"
      class="relative flex items-center gap-3 px-4 py-3 mb-5 rounded-2xl bg-gradient-to-r from-amber-400/20 via-amber-300/15 to-amber-400/10 dark:from-amber-400/15 dark:via-amber-300/10 dark:to-amber-400/5 border border-amber-400/30 dark:border-amber-400/20"
    >
      <!-- Star icon -->
      <div class="shrink-0 w-8 h-8 rounded-full bg-amber-400/20 dark:bg-amber-400/15 flex items-center justify-center">
        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>

      <!-- Text -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">
          Unlimited scans with Premium
        </p>
        <p class="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          List faster with AI — RM 5.99/month, cancel anytime.
        </p>
      </div>

      <!-- Upgrade button -->
      <NuxtLink
        to="/pricing"
        @click="dismiss"
        class="shrink-0 bg-amber-500 hover:bg-amber-400 text-ink text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
      >
        See plans
      </NuxtLink>

      <!-- Dismiss -->
      <button
        @click="dismiss"
        class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 transition-colors"
        aria-label="Dismiss"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'tcgo-premium-banner-dismissed';
const DISMISS_DAYS = 7;

const { profile } = useMyProfile();
const { premiumEnabled } = useFeatureFlags();
const isPremium = computed(() => profile.value?.tier === 'premium');

const dismissed = ref(false);

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const until = parseInt(stored, 10);
    dismissed.value = Date.now() < until;
  }
});

const visible = computed(() => premiumEnabled && !isPremium.value && !dismissed.value);

const dismiss = () => {
  dismissed.value = true;
  const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(STORAGE_KEY, String(until));
};
</script>

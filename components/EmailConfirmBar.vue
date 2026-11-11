<template>
  <div
    v-if="show"
    class="border-b border-amber-200/70 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
  >
    <div class="container mx-auto flex items-center gap-3 px-4 py-2 text-[13px] text-amber-900 dark:text-amber-100">
      <p class="min-w-0 flex-1">
        Confirm your email to buy, bid, sell or send messages.
      </p>
      <NuxtLink
        :to="{ path: '/onboarding', query: { next: route.fullPath } }"
        class="shrink-0 font-semibold underline underline-offset-2"
      >
        Enter code
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// Browsing no longer waits for the email code (shared/onboarding.ts), so a
// member who hasn't typed it yet needs a quiet reminder of what's waiting on it.
import { computed } from "vue";
import { hasCurrentConsent, isOnboardingExempt } from "~/shared/onboarding";

const route = useRoute();
const { user, authLoading } = useAuth();
const { profile, loading } = useMyProfile();

const show = computed(
  () =>
    !authLoading.value &&
    !loading.value &&
    !!user.value &&
    !user.value.emailVerified &&
    // The consent screen comes first and has the whole page to itself.
    hasCurrentConsent(profile.value) &&
    !isOnboardingExempt(route.path),
);
</script>

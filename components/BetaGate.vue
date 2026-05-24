<script setup lang="ts">
const route = useRoute();
const { user } = useAuth();
const { profile, loading } = useMyProfile();

const dismissed = ref(false);

const allowedPaths = ["/profile", "/beta"];

const showBanner = computed(() => {
  if (!user.value || loading.value) return false;
  if (allowedPaths.some((p) => route.path === p || route.path.startsWith(p + "/"))) return false;
  if (dismissed.value) return false;
  return !profile.value?.whatsappVerified;
});
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="-translate-y-full"
    enter-to-class="translate-y-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-y-0"
    leave-to-class="-translate-y-full"
  >
    <div
      v-if="showBanner"
      class="fixed top-0 inset-x-0 z-40 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/50"
    >
      <div class="container mx-auto px-4 py-2 flex items-center gap-3">
        <span class="text-amber-600 dark:text-amber-400 shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </span>
        <p class="flex-1 text-xs text-amber-800 dark:text-amber-300 font-medium">
          Your account isn't verified yet — verify your phone to unlock full marketplace access.
        </p>
        <NuxtLink
          to="/beta"
          class="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
        >
          Verify now
        </NuxtLink>
        <button
          @click="dismissed = true"
          class="shrink-0 text-amber-500 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
          aria-label="Dismiss"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

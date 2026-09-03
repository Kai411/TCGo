<script setup lang="ts">
// "Finish setting up your account", shown above the nav rather than over it.
//
// This used to be `fixed top-0`, which put it on top of the navbar: the logo
// and search were behind it, and dismissing was the only way to reach them.
// It is now an ordinary block at the top of the layout, so the page simply
// starts lower while it is there and nothing is ever covered.
//
// WHAT COUNTS AS VERIFIED
// Email and identity — not phone. There is no SMS provider on this project,
// so a banner asking someone to "verify your phone" pointed at a thing they
// could not do. Email is proven by the signup code; identity by Didit.

const route = useRoute();
const { user } = useAuth();
const { profile, loading } = useMyProfile();

const dismissed = ref(false);

/** Pages that exist to fix this — nagging on them is just noise. */
const allowedPaths = ["/profile", "/beta", "/login", "/seller/verify"];

const emailDone = computed(() => !!user.value?.emailVerified);
const idDone = computed(() => profile.value?.kycStatus === "approved");

/** What's actually outstanding, so the banner can name it. */
const missing = computed(() => {
  const out: string[] = [];
  if (!emailDone.value) out.push("confirm your email");
  if (!idDone.value) out.push("verify your identity");
  return out;
});

const message = computed(() =>
  missing.value.length === 2
    ? "Confirm your email and verify your identity to buy and sell."
    : `Almost there — ${missing.value[0]} to buy and sell.`,
);

const showBanner = computed(() => {
  if (!user.value || loading.value) return false;
  if (allowedPaths.some((p) => route.path === p || route.path.startsWith(p + "/"))) return false;
  if (dismissed.value) return false;
  return missing.value.length > 0;
});
</script>

<template>
  <!-- No slide transition: this sits in the document flow, so animating it
       would shove the whole page down on every navigation. -->
  <div
    v-if="showBanner"
    class="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200/80 dark:border-amber-900/60"
  >
    <div class="container mx-auto px-4 h-11 flex items-center gap-3">
      <span class="text-amber-600 dark:text-amber-500 shrink-0" aria-hidden="true">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>

      <p class="flex-1 min-w-0 truncate text-[13px] text-amber-900 dark:text-amber-200">
        {{ message }}
      </p>

      <NuxtLink
        to="/beta"
        class="shrink-0 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-amber-700 transition-colors"
      >
        Finish setup
      </NuxtLink>

      <button
        @click="dismissed = true"
        class="shrink-0 -mr-1 p-1.5 rounded-lg text-amber-600/70 dark:text-amber-500/70 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        aria-label="Dismiss"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>
</template>

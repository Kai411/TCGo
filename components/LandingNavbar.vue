<template>
  <nav class="bg-white border-b border-gray-200 shadow-sm">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <NuxtLink to="/landing">
          <img
            src="~/assets/images/tcgo_sprites.png"
            alt="TCGo"
            class="h-full w-[110px] object-cover"
          />
        </NuxtLink>

        <!-- Desktop nav -->
        <div class="hidden lg:flex items-center gap-5">
          <NuxtLink
            to="/pricing"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Pricing
          </NuxtLink>
          <NuxtLink
            to="/update-notice"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Updates
          </NuxtLink>
          <NuxtLink
            to="/privacy-policy"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Privacy Policy
          </NuxtLink>
          <!-- <NuxtLink
            to="/privacy-policy"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Terms of use
          </NuxtLink> -->
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-semibold bg-pokemon-red text-white shadow-glow"
          >
            TCGo Marketplace →
          </NuxtLink>
        </div>

        <!-- Mobile menu button -->
        <button
          class="lg:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
          @click="mobileMenuOpen = true"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile fullscreen menu -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="mobileMenuOpen"
          class="fixed inset-0 z-50 bg-white flex flex-col"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-5 h-16 border-b border-gray-100"
          >
            <NuxtLink
              to="/landing"
              class="flex items-center h-full"
              @click="mobileMenuOpen = false"
            >
              <img
                src="~/assets/images/tcgo_sprites.png"
                alt="TCGo"
                class="h-full w-[110px] object-cover"
              />
            </NuxtLink>
            <button
              class="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              @click="mobileMenuOpen = false"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Nav links.
               One rhythm: px-5 everywhere (was 4 in the header and 6 here),
               15px text (was 18), and dividers between rows via divide-y so
               the last item has no dangling border under it. The old sizes
               were display type on a menu — big enough that three links
               filled a phone screen. -->
          <nav class="flex-1 overflow-y-auto px-5 py-2 divide-y divide-gray-100">
            <NuxtLink
              v-for="link in mobileLinks"
              :key="link.to"
              :to="link.to"
              class="flex items-center justify-between py-3.5 text-[15px] font-medium text-gray-700 transition-colors hover:text-pokemon-red"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              {{ link.label }}
              <svg class="h-4 w-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </NuxtLink>
          </nav>

          <!-- Actions. The marketplace is the primary one; signing in or out
               is secondary and was previously unreachable here at all. -->
          <div class="space-y-2 border-t border-gray-100 px-5 py-5">
            <NuxtLink
              to="/"
              class="flex w-full items-center justify-center gap-1.5 rounded-full bg-pokemon-red px-4 py-3 text-[15px] font-bold text-white shadow-glow"
              @click="mobileMenuOpen = false"
            >
              Go to the marketplace
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </NuxtLink>

            <button
              v-if="user"
              type="button"
              class="w-full rounded-full border border-gray-200 px-4 py-3 text-[15px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              @click="handleSignOut"
            >
              Sign out
            </button>
            <button
              v-else-if="!authLoading"
              type="button"
              class="w-full rounded-full border border-gray-200 px-4 py-3 text-[15px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              @click="mobileMenuOpen = false; goToLogin()"
            >
              Sign in
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
const {user, authLoading,  signOut} = useAuth();
const { goToLogin } = useSignInGate();
const { profile } = useMyProfile();
const { isAdmin } = useAdmin();

const mobileMenuOpen = ref(false);

// One list, so a fourth link cannot arrive with different padding.
const mobileLinks = [
  { to: "/pricing", label: "Pricing" },
  { to: "/update-notice", label: "Updates" },
  { to: "/privacy-policy", label: "Privacy policy" },
];

const handleSignOut = () => {
  signOut().then(() => navigateTo("/"));
  mobileMenuOpen.value = false;
};

const handleSignIn = () => {
  goToLogin();
  mobileMenuOpen.value = false;
};
</script>

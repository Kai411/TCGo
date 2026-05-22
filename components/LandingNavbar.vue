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
            to="/beta"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Beta Access
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
            class="flex items-center justify-between px-4 h-16 border-b border-gray-200"
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

          <!-- Nav links -->
          <div class="flex-1 flex flex-col px-6 py-6 gap-1">
            <NuxtLink
              to="/beta"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              Beta Access
            </NuxtLink>
            <NuxtLink
              to="/update-notice"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              Updates
            </NuxtLink>
            <NuxtLink
              to="/privacy-policy"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              Privacy Policy
            </NuxtLink>
          </div>

          <!-- User section at bottom -->
          <div class="flex px-6 py-6 border-t border-gray-200 w-full">
            <NuxtLink
              to="/"
              class="inline-flex w-full items-center justify-center gap-1 px-3.5 py-2 rounded-full text-xl font-semibold bg-pokemon-red text-white shadow-glow"
            >
              TCGo Marketplace →
            </NuxtLink>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
const { user, authLoading, signInWithGoogle, signOut } = useAuth();
const { profile } = useMyProfile();
const { isAdmin } = useAdmin();

const mobileMenuOpen = ref(false);

const handleSignOut = () => {
  signOut();
  mobileMenuOpen.value = false;
};

const handleSignIn = () => {
  signInWithGoogle();
  mobileMenuOpen.value = false;
};
</script>

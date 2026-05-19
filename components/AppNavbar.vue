<template>
  <nav class="bg-white border-b border-gray-200 shadow-sm">
    <div class="container mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <NuxtLink to="/landing" class="flex items-center h-full">
          <img
            src="~/assets/images/tcgo_sprites.png"
            alt="TCGo"
            class="h-full w-[110px] object-cover"
          />
        </NuxtLink>

        <!-- Desktop nav -->
        <div class="hidden lg:flex items-center gap-5">
          <NuxtLink
            to="/"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Shop
          </NuxtLink>
          <NuxtLink
            to="/auctions"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Auctions
          </NuxtLink>
          <NuxtLink
            v-if="user"
            to="/dashboard/seller"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            My Listings
          </NuxtLink>
          <NuxtLink
            v-if="user"
            to="/dashboard/buyer"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            My Bids
          </NuxtLink>
          <NuxtLink
            v-if="isAdmin"
            to="/admin/reports"
            class="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            active-class="!text-pokemon-red"
          >
            Admin
          </NuxtLink>

          <!-- Sell buttons -->
          <div v-if="user" class="flex gap-2">
            <NuxtLink
              to="/cards/create"
              class="bg-pokemon-blue text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Sell Card
            </NuxtLink>
            <NuxtLink
              to="/auctions/create"
              class="bg-pokemon-red text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Auction
            </NuxtLink>
          </div>

          <!-- Auth -->
          <div
            v-if="authLoading"
            class="w-8 h-8 rounded-full bg-gray-200 animate-pulse"
          ></div>
          <div v-else-if="user" class="flex items-center gap-2">
            <NuxtLink
              :to="`/profile/${user.uid}`"
              class="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img
                :src="profile?.photoURL || user.photoURL || ''"
                :alt="profile?.customName || user.displayName || 'User'"
                class="w-8 h-8 rounded-full border border-gray-200 object-cover"
              />
            </NuxtLink>
          </div>
          <button
            v-else
            @click="signInWithGoogle"
            class="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Sign In
          </button>
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
              to="/"
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
              to="/"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              Shop
            </NuxtLink>
            <NuxtLink
              to="/auctions"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              Auctions
            </NuxtLink>
            <NuxtLink
              v-if="user"
              to="/dashboard/seller"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              My Listings
            </NuxtLink>
            <NuxtLink
              v-if="user"
              to="/dashboard/buyer"
              class="text-lg font-medium text-gray-700 hover:text-pokemon-red py-3 border-b border-gray-100 transition-colors"
              active-class="!text-pokemon-red"
              @click="mobileMenuOpen = false"
            >
              My Bids
            </NuxtLink>

            <!-- Sell buttons -->
            <div v-if="user" class="flex gap-3 mt-4">
              <NuxtLink
                to="/cards/create"
                class="flex-1 text-center bg-pokemon-blue text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                @click="mobileMenuOpen = false"
              >
                Sell Card
              </NuxtLink>
              <NuxtLink
                to="/auctions/create"
                class="flex-1 text-center bg-pokemon-red text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                @click="mobileMenuOpen = false"
              >
                Auction
              </NuxtLink>
            </div>
          </div>

          <!-- User section at bottom -->
          <div class="px-6 py-6 border-t border-gray-200">
            <div v-if="authLoading" class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full bg-gray-200 animate-pulse"
              ></div>
              <div class="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div v-else-if="user" class="flex items-center justify-between">
              <NuxtLink
                :to="`/profile/${user.uid}`"
                class="flex items-center gap-3 hover:opacity-80 transition-opacity"
                @click="mobileMenuOpen = false"
              >
                <img
                  :src="profile?.photoURL || user.photoURL || ''"
                  :alt="profile?.customName || user.displayName || 'User'"
                  class="w-10 h-10 rounded-full border border-gray-200 object-cover"
                />
                <div>
                  <p class="font-medium text-gray-900 text-sm">
                    {{ profile?.customName || user.displayName }}
                  </p>
                  <p class="text-xs text-gray-400">View profile</p>
                </div>
              </NuxtLink>
            </div>
            <button
              v-else
              @click="handleSignIn"
              class="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Sign In with Google
            </button>
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

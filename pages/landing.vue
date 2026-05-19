<template>
  <div>
    <!-- Hero -->
    <section class="pt-32 pb-20 px-4">
      <div class="container mx-auto max-w-4xl text-center">
        <h1
          class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight"
        >
          Buy, Sell & Auction
        </h1>
        <div class="mt-2">
          <span
            class="text-4xl sm:text-5xl lg:text-6xl font-bold inline-flex items-center justify-center gap-3"
          >
            <span class="relative inline-block overflow-hidden h-[1.2em]">
              <Transition
                enter-active-class="transition-all duration-400 ease-out"
                enter-from-class="opacity-0 translate-y-4"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-4"
                mode="out-in"
              >
                <span
                  :key="currentWord"
                  class="text-pokemon-red inline-block w-full text-center"
                >
                  {{ currentWord }}
                </span>
              </Transition>
            </span>
            <span
              class="text-gray-900 mb-[1px]"
              style="transition: cubic-bezier(0.6, -0.28, 0.74, 0.05)"
              >Cards</span
            >
          </span>
        </div>
        <p class="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto">
          Malaysia's trusted community marketplace for Pokemon TCG collectors.
          List your cards, bid on auctions, and connect with fellow trainers.
        </p>
        <div class="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink
            to="/"
            class="bg-pokemon-red text-white px-8 py-3.5 rounded-xl text-base font-semibold border-2 border-red-800 hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            Browse Marketplace
          </NuxtLink>
          <NuxtLink
            to="/auctions"
            class="bg-white text-gray-900 px-8 py-3.5 rounded-xl text-base font-semibold border-2 border-gray-200 hover:border-gray-300 transition-colors"
          >
            Live Auctions
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="py-20 bg-gray-50">
      <div class="container mx-auto px-4 max-w-5xl">
        <h2
          class="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12"
        >
          Everything you need to trade cards
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div
              class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4"
            >
              <span class="text-xl">🏷️</span>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">List & Sell</h3>
            <p class="text-sm text-gray-500">
              List your cards in seconds. Set your price, upload photos, and
              connect with buyers via WhatsApp.
            </p>
          </div>
          <div
            class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div
              class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4"
            >
              <span class="text-xl">⚡</span>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">Live Auctions</h3>
            <p class="text-sm text-gray-500">
              Real-time bidding with anti-snipe protection. Auto-bid sets your
              max and the system bids for you.
            </p>
          </div>
          <div
            class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div
              class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4"
            >
              <span class="text-xl">🛡️</span>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">Trust System</h3>
            <p class="text-sm text-gray-500">
              Every user has a trust score. Bad actors get penalized. Trade with
              confidence in a verified community.
            </p>
          </div>
          <div
            class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div
              class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-4"
            >
              <span class="text-xl">📱</span>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">Mobile First</h3>
            <p class="text-sm text-gray-500">
              Install as an app on your phone. Get notified when you're outbid.
              Trade on the go.
            </p>
          </div>
          <div
            class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div
              class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-4"
            >
              <span class="text-xl">🎯</span>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">Graded & Ungraded</h3>
            <p class="text-sm text-gray-500">
              Support for PSA, CGC, TAG, Beckett graded cards and raw cards in
              any condition.
            </p>
          </div>
          <div
            class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div
              class="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center mb-4"
            >
              <span class="text-xl">🇲🇾</span>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">Made for Malaysia</h3>
            <p class="text-sm text-gray-500">
              Pricing in RM. Shipping rates for West & East Malaysia. WhatsApp
              integration for easy communication.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-20">
      <div class="container mx-auto px-4 max-w-3xl text-center">
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
          Ready to start trading?
        </h2>
        <p class="text-gray-500 mb-8">
          Join the community. Sign in with Google and list your first card in
          under a minute.
        </p>
        <NuxtLink
          to="/"
          class="inline-block bg-pokemon-red border-2 border-red-800 text-white px-10 py-4 rounded-xl text-base font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
        >
          Enter Marketplace
        </NuxtLink>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-gray-100 py-8">
      <div class="container mx-auto px-4 text-center text-sm text-gray-400">
        <p>
          © {{ new Date().getFullYear() }} TCGo Marketplace. Built for the
          Malaysian TCG community.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "landing",
});

useHead({
  title: "TCGo Marketplace - Buy, Sell & Auction Pokemon Cards in Malaysia",
});

const words = ["Pokemon", "One Piece", "Lorcana", "Yu-Gi-Oh!", "Digimon"];
const currentIndex = ref(0);
const currentWord = computed(() => words[currentIndex.value]);

let interval: ReturnType<typeof setInterval>;

onMounted(() => {
  interval = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % words.length;
  }, 2500);
});

onUnmounted(() => {
  clearInterval(interval);
});
</script>

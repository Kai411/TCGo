<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 bg-white dark:bg-zinc-950 text-ink dark:text-white">
    <!-- TCGo wordmark — same sprite crop used in the navbar. -->
    <NuxtLink to="/" class="block mb-10">
      <img
        src="~/assets/images/tcgo_sprites.png"
        alt="TCGo"
        class="h-12 w-[160px] object-cover block dark:hidden"
      />
      <img
        src="/tcgo_sprites_white.png"
        alt="TCGo"
        class="h-12 w-[160px] object-cover hidden dark:block"
      />
    </NuxtLink>

    <!-- Big status code with a card-frame motif behind it -->
    <div class="relative mb-6">
      <div
        class="absolute inset-0 -inset-x-8 -inset-y-6 rounded-2xl border-2 border-dashed border-black/[0.08] dark:border-white/[0.10] pointer-events-none"
        aria-hidden="true"
      />
      <p class="relative text-7xl sm:text-8xl font-black tracking-tight text-pokemon-red tabular-nums">
        {{ statusCode }}
      </p>
    </div>

    <h1 class="text-xl sm:text-2xl font-bold mb-2 text-center">
      {{ title }}
    </h1>
    <p class="text-sm sm:text-base text-gray-500 dark:text-zinc-400 text-center max-w-md mb-8">
      {{ description }}
    </p>

    <!-- Actions -->
    <div class="flex flex-wrap items-center justify-center gap-3">
      <button
        @click="handleHome"
        class="px-5 py-2.5 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink hover:opacity-90 transition-opacity"
      >
        Back to shop
      </button>
      <button
        @click="goBack"
        class="px-5 py-2.5 rounded-full text-sm font-semibold border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
      >
        Go back
      </button>
    </div>

    <!-- Subtle debug aid in dev only — easy to spot the path that 404'd -->
    <p
      v-if="dev && route.fullPath"
      class="mt-10 text-[11px] font-mono text-gray-400 dark:text-zinc-500 truncate max-w-md"
      :title="route.fullPath"
    >
      {{ route.fullPath }}
    </p>
  </div>
</template>

<script setup lang="ts">
// Nuxt passes the NuxtError through `error` as a prop. The error layout
// is rendered outside the normal page tree, so we don't have access to
// the standard layout chrome — keep this self-contained.
const props = defineProps<{
  error: { statusCode?: number; statusMessage?: string; message?: string } | null;
}>();

const route = useRoute();
const dev = import.meta.dev;

const statusCode = computed(() => props.error?.statusCode ?? 404);

// Friendlier copy per known status. Default plays on the TCG theme —
// people landed somewhere that doesn't exist, like a misprint.
const title = computed(() => {
  switch (statusCode.value) {
    case 404:
      return "This card isn't in the binder";
    case 500:
      return "Something broke on our side";
    case 403:
      return "You don't have access to this";
    default:
      return props.error?.statusMessage || "Something went wrong";
  }
});

const description = computed(() => {
  switch (statusCode.value) {
    case 404:
      return "The page you're looking for either moved or never existed. Head back to the shop and keep collecting.";
    case 500:
      return "We hit an unexpected error. Try again in a moment, or head back to the shop while we look into it.";
    case 403:
      return "This page is restricted. If you think you should have access, contact support.";
    default:
      return props.error?.message || "Try heading back to the shop.";
  }
});

useHead({
  title: `${statusCode.value} · TCGo Marketplace`,
});

// `clearError` resets Nuxt's internal error state and (with redirect)
// hands control back to the router. Without it, the back button can leave
// you stuck on the error overlay.
const handleHome = () => clearError({ redirect: "/" });

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    clearError({ redirect: "/" });
  }
};
</script>

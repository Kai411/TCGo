<template>
  <div
    class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors"
  >
    <AppNavbar />
    <!-- pt-8 rather than py-8: pb-28 already overrode the bottom half, so
         this is the same spacing said once.

         A page whose first element is sticky wants to start flush against the
         nav — the gap makes the bar look detached and moves when you scroll.
         Those pages set `flushTop` in definePageMeta rather than each one
         cancelling the padding with a negative margin of its own. -->
    <main
      class="container mx-auto px-4 pb-28 lg:pb-12"
      :class="route.meta.flushTop ? 'pt-0' : 'pt-8'"
    >
      <!-- Keyed on path so each page replays the enter animation. -->
      <div :key="route.path" class="page-in">
        <slot />
      </div>
    </main>
    <footer
      class="container mx-auto px-4 pb-24 lg:pb-8 text-xs text-ink-soft dark:text-zinc-500"
    >
      <div
        class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-6 border-t border-black/[0.05] dark:border-white/[0.06]"
      >
        <NuxtLink to="/landing" class="hover:text-pokemon-red">About TCGo</NuxtLink>
        <NuxtLink to="/privacy-policy" class="hover:text-pokemon-red">Privacy</NuxtLink>
        <span>© {{ new Date().getFullYear() }} TCGo Marketplace</span>
      </div>
    </footer>
    <InstallPrompt />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
</script>

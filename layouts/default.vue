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
    <!-- Desktop only. On phones these links live on the Account tab
         (pages/account.vue), which the bottom nav reaches. -->
    <footer
      class="hidden lg:block select-none container mx-auto px-4 pb-8 text-xs text-ink-soft dark:text-zinc-500"
    >
      <div
        class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-6 border-t border-black/[0.05] dark:border-white/[0.06]"
      >
        <NuxtLink to="/landing" class="hover:text-pokemon-red">About TCGo</NuxtLink>
        <NuxtLink
          v-for="link in LEGAL_LINKS"
          :key="link.to"
          :to="link.to"
          class="hover:text-pokemon-red"
        >
          {{ link.label }}
        </NuxtLink>
        <span>© {{ new Date().getFullYear() }} TCGo Marketplace</span>
      </div>
    </footer>
    <InstallPrompt />
  </div>
</template>

<script setup lang="ts">
import { LEGAL_LINKS } from "~/shared/legal";

const route = useRoute();
</script>

<template>
  <div
    class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors"
  >
    <AppNavbar />
    <EmailConfirmBar />
    <!-- pt-8 rather than py-8: the bottom padding already overrode the bottom half, so
         this is the same spacing said once. Under lg the top gap matches the
         px-4 side gutter, so content sits evenly inside the screen edges.

         A page whose first element is sticky wants to start flush against the
         nav — the gap makes the bar look detached and moves when you scroll.
         Those pages set `flushTop` in definePageMeta rather than each one
         cancelling the padding with a negative margin of its own.

         Bottom padding under lg clears the phone bottom nav: its 64px bar,
         its own max(16px, safe-area) bottom padding, the Sell circle that
         sticks ~22px above the bar, and an 18px gap. A flat pb-28 ignored
         the safe area, so on phones with a home indicator the circle sat on
         the last link of a page (Back to cart on checkout). -->
    <main
      class="container mx-auto px-4 pb-[calc(6.5rem+max(16px,env(safe-area-inset-bottom)))] lg:pb-12"
      :class="route.meta.flushTop ? 'pt-0' : 'pt-4 lg:pt-8'"
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

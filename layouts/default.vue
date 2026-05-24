<template>
  <div
    class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors"
  >
    <AppNavbar />
    <main class="container mx-auto px-4 py-8 pb-28 lg:pb-12">
      <slot />
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
    <!-- Subtle beta indicator — bottom-left, above mobile nav -->
    <div class="fixed bottom-24 left-4 lg:bottom-5 lg:left-5 z-30 select-none">
      <NuxtLink
        to="/beta"
        class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-widest uppercase text-ink-muted dark:text-zinc-500 bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] hover:text-ink dark:hover:text-zinc-300 hover:border-black/20 dark:hover:border-white/20 transition-colors"
      >
        Beta
      </NuxtLink>
    </div>
    <BetaGate />
    <InstallPrompt />
  </div>
</template>

<template>
  <div
    class="min-h-screen bg-canvas dark:bg-canvas-inverse text-ink dark:text-zinc-100 transition-colors"
  >
    <AppNavbar />
    <div
      class="sticky top-0 w-full py-1 text-center bg-pokemon-yellow text-[12px] font-bold"
    >
      TCGo is currently under closed Beta Testing
    </div>
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
    <BetaGate />
    <InstallPrompt />
  </div>
</template>

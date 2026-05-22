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
    <BetaGate />
    <InstallPrompt />
  </div>
</template>

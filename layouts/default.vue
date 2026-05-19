<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <AppNavbar class="sticky top-0" style="z-index: 2" />
    <div
      class="sticky top-0 w-full py-1 text-center bg-pokemon-yellow text-[12px] font-bold text-grey"
    >
      You are currently on Beta Access of TCGo
    </div>
    <main class="container mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>

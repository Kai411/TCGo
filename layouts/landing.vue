<template>
  <div class="min-h-screen bg-white">
    <LandingNavbar class="sticky top-0" style="z-index: 2" />
    <div
      class="sticky top-0 w-full py-1 text-center bg-pokemon-yellow text-[12px] font-bold"
    >
      You are currently on Beta Access of TCGo
    </div>
    <slot />
  </div>
</template>

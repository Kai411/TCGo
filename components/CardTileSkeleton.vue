<template>
  <!-- Mirrors CardTile's footprint so the grid doesn't jump when data lands. -->
  <div class="surface rounded-2xl overflow-hidden h-full flex flex-col" aria-hidden="true">
    <div class="p-1 sm:p-2.5">
      <div class="skeleton aspect-[3.55/5] rounded-lg" />
    </div>
    <div class="px-2 sm:px-4 pt-1.5 sm:pt-2 pb-2 sm:pb-4 space-y-2 sm:space-y-3">
      <div class="skeleton h-4 w-3/4" />
      <div class="skeleton h-5 w-1/2" />
      <div class="skeleton h-3 w-1/3" />
    </div>
  </div>
</template>

<template>
  <!-- Mirrors CardTile's footprint so the grid doesn't jump when data lands. -->
  <div class="surface rounded-2xl overflow-hidden h-full flex flex-col" aria-hidden="true">
    <div class="p-2 sm:p-2.5">
      <div class="skeleton aspect-[3.55/5] rounded-lg" />
    </div>
    <div class="px-3.5 sm:px-4 pt-2 pb-3.5 sm:pb-4 space-y-3">
      <div class="skeleton h-4 w-3/4" />
      <div class="skeleton h-5 w-1/2" />
      <div class="skeleton h-3 w-1/3" />
    </div>
  </div>
</template>

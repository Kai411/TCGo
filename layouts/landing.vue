<template>
  <!-- Landing layout is intentionally LIGHT-ONLY (marketing surface). -->
  <div class="min-h-screen bg-white text-ink">
    <LandingNavbar class="sticky top-0" style="z-index: 2" />
    <slot />
  </div>
</template>

<script setup lang="ts">
// Pins the document to light while any landing route is mounted, and restores
// the visitor's own theme when they leave.
//
// The pre-paint script in nuxt.config.ts already covers a direct load or
// refresh; this covers client-side navigation *into* these routes from the
// marketplace, where the `dark` class is already on <html> and would otherwise
// bleed through every `.dark .surface` rule in assets/css/tailwind.css.
useLightOnlySurface();
</script>

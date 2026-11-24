<template>
  <!-- Banners | Microsites, the two halves of Mint Condition → Content. -->
  <nav class="mc-tabs mb-5" aria-label="Content">
    <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="mc-tab-link" :aria-current="active(t.to) ? 'page' : undefined">
      {{ t.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute();
const tabs = [
  { to: "/mintcondition/content", label: "Banners" },
  { to: "/mintcondition/content/microsites", label: "Microsites" },
];
const active = (to: string) =>
  to === "/mintcondition/content" ? route.path === to : route.path.startsWith(to);
</script>

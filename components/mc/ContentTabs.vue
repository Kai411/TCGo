<template>
  <!-- Banners | Microsites, the two halves of Mint Condition → Content. -->
  <div class="mb-5 inline-flex rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.06]">
    <NuxtLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors"
      :class="
        active(t.to)
          ? 'bg-white text-ink shadow-sm dark:bg-white/[0.12] dark:text-white'
          : 'text-ink-muted dark:text-zinc-400'
      "
    >
      {{ t.label }}
    </NuxtLink>
  </div>
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

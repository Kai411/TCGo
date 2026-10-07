<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-6 w-6 border-2 border-ink/10 border-t-pokemon-red" />
  </div>
</template>

<script setup lang="ts">
// The seller area moved from /inventory/* to /seller/*. This catch-all keeps
// existing bookmarks, PWA shortcuts and any link already out in the wild
// working instead of dropping them on a 404.
const route = useRoute();

const target = computed(() => {
  const rest = ([] as string[]).concat((route.params.path as string[]) ?? []).join("/");
  return `/seller${rest ? `/${rest}` : ""}`;
});

// replace(), not push() — the old URL should not sit in the back stack.
await navigateTo({ path: target.value, query: route.query }, { replace: true });
</script>

<script setup lang="ts">
// Orders are now surfaced via the Activity tab; keep this route as a redirect
// so any existing links (notifications, success banners, etc.) still land in
// the right place.
definePageMeta({ middleware: () => navigateTo("/activity?tab=purchases", { replace: true }) });
</script>

<template>
  <div />
</template>

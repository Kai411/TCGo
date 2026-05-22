<script setup lang="ts">
// Old URL kept alive — redirect users to the unified /activity page.
onMounted(() => navigateTo("/activity?tab=bidding", { replace: true }));
</script>

<template>
  <div />
</template>

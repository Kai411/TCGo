<template>
  <div />
</template>

<script setup lang="ts">
// Notifications moved into Account settings; old links (the bell's "How",
// Help articles) still land there.
definePageMeta({ redirect: "/profile#notifications" });
</script>

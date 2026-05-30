<script setup lang="ts">
// Moved into the inventory system — keep the old URL working.
definePageMeta({
  middleware: () => navigateTo("/inventory/auctions/new", { replace: true }),
});
</script>

<template>
  <div />
</template>

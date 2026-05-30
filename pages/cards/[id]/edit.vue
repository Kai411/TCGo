<script setup lang="ts">
// Moved into the inventory system — keep the old URL working, preserving id.
definePageMeta({
  middleware: (to) =>
    navigateTo(`/inventory/listings/${to.params.id}/edit`, { replace: true }),
});
</script>

<template>
  <div />
</template>

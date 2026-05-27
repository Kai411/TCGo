<template>
  <div class="max-w-md mx-auto text-center py-16">
    <div class="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-6">
      <svg class="w-10 h-10 text-gray-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    </div>
    <h1 class="text-2xl font-extrabold text-ink dark:text-white mb-2">No worries</h1>
    <p class="text-gray-500 dark:text-zinc-400 mb-8">
      You were not charged. You can upgrade any time from the pricing page.
    </p>
    <NuxtLink
      to="/pricing"
      class="inline-block bg-ink dark:bg-white text-white dark:text-ink font-bold px-6 py-3 rounded-xl transition-colors"
    >
      Back to pricing
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Checkout Cancelled | TCGo' });

definePageMeta({ layout: 'default' });
</script>

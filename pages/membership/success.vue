<template>
  <div class="max-w-md mx-auto text-center py-16">
    <div class="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mx-auto mb-6">
      <svg class="w-10 h-10 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h1 class="text-2xl font-extrabold text-ink dark:text-white mb-2">Welcome to Premium!</h1>
    <p class="text-gray-500 dark:text-zinc-400 mb-8">
      Your subscription is now active. Enjoy unlimited card scans and all Premium features.
    </p>
    <NuxtLink
      to="/profile"
      class="inline-block bg-amber-500 hover:bg-amber-400 text-ink font-bold px-6 py-3 rounded-xl transition-colors"
    >
      Go to your profile →
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Welcome to Premium | TCGo' });

definePageMeta({ layout: 'default' });
</script>

<template>
  <!-- Its own page so the Account row lands on exactly what it names. -->
  <div class="max-w-xl mx-auto">
    <SubpageHeader />
    <div v-if="!user" class="text-center py-12">
      <button
        type="button"
        @click="goToLogin"
        class="min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
      >
        Sign in
      </button>
    </div>
    <div
      v-else
      class="panel bg-white dark:bg-white/[0.04] rounded-xl p-6 border border-gray-200 dark:border-white/[0.08]"
    >
      <AddressBook />
    </div>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { goToLogin } = useSignInGate();

useHead({ title: "Shipping addresses | TCGo" });
</script>

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
    <PushSettings v-else />
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { goToLogin } = useSignInGate();

useHead({ title: "Notifications | TCGo" });
</script>

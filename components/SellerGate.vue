<template>
  <!-- Signed-out state for seller pages. -->
  <div class="mc-card sg-gate">
    <p class="mc-ink-3">{{ message }}</p>
    <button type="button" class="mc-btn mc-btn-primary" @click="goToLogin">Sign in</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string }>();
const { goToLogin } = useSignInGate();
</script>

<style>
.sg-gate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 16px;
}
</style>

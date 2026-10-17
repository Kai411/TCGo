<template>
  <!-- Moved off the profile tabs: favourites are a private list, so they
       live under Account with the other things only you see. -->
  <div>
    <SubpageHeader title="Favourites" />
    <div v-if="!user" class="text-center py-12">
      <button
        type="button"
        @click="goToLogin"
        class="min-h-[44px] px-6 rounded-full text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
      >
        Sign in
      </button>
    </div>
    <FavouritesList v-else :uid="user.uid" />
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { goToLogin } = useSignInGate();

useHead({ title: "Favourites | TCGo" });
</script>

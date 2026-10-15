<template>
  <div class="max-w-5xl mx-auto">
    <div v-if="!user && !authLoading" class="text-center py-12">
      <p class="text-ink-muted dark:text-zinc-400 mb-4">Sign in to see your messages.</p>
      <button type="button" @click="goToLogin" class="px-5 py-2.5 rounded-full text-sm font-semibold bg-pokemon-red text-white">
        Sign in
      </button>
    </div>

    <template v-else>
      <h1 class="text-xl font-bold text-ink dark:text-white mb-4">Messages</h1>
      <div class="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-4 items-start">
        <div class="surface rounded-2xl overflow-hidden">
          <ChatInboxList />
        </div>
        <div class="hidden lg:flex surface rounded-2xl min-h-[24rem] items-center justify-center text-sm text-ink-soft dark:text-zinc-500 px-6 text-center">
          Choose a conversation. To start a new one, use Message on a listing, a profile or an order.
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";

useHead({ title: "Messages · TCGo" });

const { user, authLoading } = useAuth();
const { goToLogin } = useSignInGate();
const { listenInbox } = useChat();

watch(user, listenInbox, { immediate: true });
</script>

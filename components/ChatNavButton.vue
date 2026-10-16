<template>
  <NuxtLink
    to="/messages"
    :aria-label="unreadConversations ? `Messages, ${unreadConversations} unread` : 'Messages'"
    class="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
    active-class="!text-pokemon-red"
  >
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
    <span
      v-if="unreadConversations"
      class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-pokemon-red text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white dark:ring-[#17171c]"
    >
      {{ badgeLabel(unreadConversations) }}
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { badgeLabel } from "~/shared/notifications";

const { user } = useAuth();
const { unreadConversations, listenInbox } = useChat();

// Follows the signed-in user, like the bell: a shared shop device must not
// keep showing the previous person's conversations.
watch(user, listenInbox, { immediate: true });
</script>

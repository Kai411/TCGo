<template>
  <div>
    <p v-if="inboxLoading" class="px-4 py-10 text-center text-sm text-ink-soft dark:text-zinc-500">Loading…</p>
    <p v-else-if="inboxError" class="px-4 py-10 text-center text-sm text-pokemon-red">{{ inboxError }}</p>
    <p v-else-if="!conversations.length" class="px-4 py-10 text-center text-sm text-ink-soft dark:text-zinc-500">
      No conversations yet. Use <b>Message</b> on a listing, a profile or an order to start one.
    </p>
    <NuxtLink
      v-for="c in conversations"
      :key="c.id"
      :to="`/messages/${other(c)}`"
      class="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
      :class="other(c) === activeUid ? 'bg-black/[0.04] dark:bg-white/[0.06]' : ''"
    >
      <ChatAvatar :person="c.people?.[other(c)]" class="w-11 h-11" />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-2">
          <p class="text-sm truncate text-ink dark:text-white" :class="unread(c) ? 'font-bold' : 'font-semibold'">
            {{ c.people?.[other(c)]?.name || "TCGo member" }}
          </p>
          <span class="shrink-0 text-[11px] text-ink-soft dark:text-zinc-500">{{ shortTime(c.lastMessage?.at) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <p
            class="text-[13px] truncate flex-1"
            :class="unread(c) ? 'text-ink dark:text-zinc-100 font-medium' : 'text-ink-muted dark:text-zinc-400'"
          >
            <span v-if="c.lastMessage?.senderUid === user?.uid">You: </span>{{ c.lastMessage?.preview }}
          </p>
          <span v-if="unread(c)" class="w-2 h-2 rounded-full bg-pokemon-red shrink-0" aria-label="Unread" />
        </div>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { isUnreadFor, otherParticipant, type Conversation } from "~/shared/chat";

defineProps<{ activeUid?: string }>();

const { user } = useAuth();
const { conversations, inboxLoading, inboxError } = useChat();

const other = (c: Conversation) => otherParticipant(c.participants, user.value?.uid ?? "");
const unread = (c: Conversation) => !!user.value && isUnreadFor(c, user.value.uid);

const shortTime = (ts?: number): string => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
  }
  if (now.getTime() - ts < 6 * 24 * 3600_000) return d.toLocaleDateString("en-MY", { weekday: "short" });
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
};
</script>

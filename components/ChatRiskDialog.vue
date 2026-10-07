<template>
  <div class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60" @click.self="$emit('edit')">
    <div
      role="alertdialog"
      aria-labelledby="chat-risk-title"
      class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#1b1b21] shadow-xl p-5"
    >
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <div class="min-w-0">
          <p id="chat-risk-title" class="text-base font-bold text-ink dark:text-white">Check before you send</p>
          <p class="text-sm text-ink-muted dark:text-zinc-400 mt-0.5">This message contains:</p>
        </div>
      </div>

      <ul class="mt-4 space-y-3">
        <li v-for="r in risks" :key="r.code" class="text-sm">
          <p class="font-semibold text-ink dark:text-white">{{ r.label }}</p>
          <p class="text-ink-muted dark:text-zinc-400">{{ r.why }}</p>
        </li>
      </ul>

      <p class="mt-4 text-xs text-ink-soft dark:text-zinc-500">
        Buyer Protection only covers orders paid through TCGo. If you send it, {{ otherName }} will see a safety note on it too.
      </p>

      <div class="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          @click="$emit('edit')"
          class="py-2.5 rounded-xl text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
        >
          Edit message
        </button>
        <button
          type="button"
          @click="$emit('send')"
          class="py-2.5 rounded-xl text-sm font-semibold border border-black/[0.10] dark:border-white/[0.12] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          Send anyway
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatRisk } from "~/shared/chat";

defineProps<{ risks: ChatRisk[]; otherName: string }>();
defineEmits<{ edit: []; send: [] }>();
</script>

<template>
  <div class="relative shrink-0">
    <img
      v-if="person?.photoURL"
      :src="person.photoURL"
      alt=""
      class="w-full h-full rounded-full object-cover"
    />
    <div
      v-else
      class="w-full h-full rounded-full flex items-center justify-center bg-black/[0.06] dark:bg-white/[0.08] text-ink-muted dark:text-zinc-400 text-sm font-bold"
      aria-hidden="true"
    >
      {{ (person?.name || "?").charAt(0).toUpperCase() }}
    </div>
    <span
      v-if="online"
      class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#17171c]"
      aria-label="Online now"
    />
  </div>
</template>

<script setup lang="ts">
import type { ChatPerson } from "~/shared/chat";

defineProps<{ person?: ChatPerson | null; online?: boolean }>();
</script>

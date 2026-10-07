<template>
  <div class="flex" :class="mine ? 'justify-end' : 'justify-start'">
    <div class="max-w-[85%] sm:max-w-[70%] space-y-1.5" :class="[mine ? 'items-end' : 'items-start', pending ? 'opacity-60' : '']">
      <div v-if="message.images?.length" class="grid gap-1.5" :class="message.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
        <button
          v-for="(src, i) in message.images"
          :key="src"
          type="button"
          @click="openLightbox(message.images, i)"
          class="block rounded-xl overflow-hidden bg-canvas-sunken dark:bg-white/[0.04]"
          :aria-label="`Open photo ${i + 1}`"
        >
          <img :src="cdnUrl(src, CHAT_THUMB_WIDTH)" alt="" loading="lazy" class="w-full max-h-72 object-cover" />
        </button>
      </div>

      <ChatAttachmentCard v-if="message.attachment" :attachment="message.attachment" class="w-72 max-w-full" />

      <p
        v-if="message.text"
        class="px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words"
        :class="mine
          ? 'bg-pokemon-red text-white rounded-br-md'
          : 'bg-black/[0.05] dark:bg-white/[0.08] text-ink dark:text-zinc-100 rounded-bl-md'"
      >{{ message.text }}</p>

      <!-- The recipient's half of the risk warning the sender confirmed. -->
      <div
        v-if="!mine && riskList.length"
        class="rounded-xl border border-amber-300/60 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
      >
        <p class="font-semibold">Be careful with this message</p>
        <p class="mt-0.5">
          It contains {{ riskList.map((r) => r.label.charAt(0).toLowerCase() + r.label.slice(1)).join(", ") }}.
          Keep payment and delivery on TCGo so Buyer Protection covers you, and never share an OTP or password.
        </p>
      </div>

      <p class="text-[10px] text-ink-soft dark:text-zinc-500 px-1" :class="mine ? 'text-right' : ''">
        {{ pending ? "Sending…" : time }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cdnUrl } from "~/composables/useStorage";
import { CHAT_RISKS, CHAT_THUMB_WIDTH, isChatRiskCode, type ChatMessage } from "~/shared/chat";

const props = defineProps<{ message: ChatMessage; mine: boolean; pending?: boolean }>();
const { openLightbox } = useLightbox();

const riskList = computed(() =>
  (props.message.risks ?? []).filter(isChatRiskCode).map((c) => CHAT_RISKS[c]),
);

const time = computed(() =>
  new Date(props.message.at).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" }),
);
</script>

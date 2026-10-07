<template>
  <component
    :is="link ? NuxtLink : 'div'"
    :to="link ? attachmentHref(attachment) : undefined"
    class="flex items-center gap-3 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-[#1f1f26] p-2.5 text-left"
    :class="link ? 'hover:shadow-card-hover transition-shadow' : ''"
  >
    <div class="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-canvas-sunken dark:bg-white/[0.04]">
      <CardImage v-if="attachment.imageUrl" :src="attachment.imageUrl" :alt="title" :width="96" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-ink-soft dark:text-zinc-500">
        {{ kindLabel }}
      </p>
      <p class="text-sm font-semibold text-ink dark:text-white truncate">{{ title }}</p>
      <p class="text-xs text-ink-muted dark:text-zinc-400 truncate">{{ detail }}</p>
    </div>
    <div class="shrink-0 text-right">
      <p class="text-sm font-bold tabular-nums text-ink dark:text-white">RM {{ price.toFixed(2) }}</p>
      <p v-if="link" class="text-[11px] font-semibold text-pokemon-red">View →</p>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from "vue";
import { attachmentHref, type ChatAttachment } from "~/shared/chat";
import { compiledOrderStatusLabel, type CompiledOrderStatus } from "~/composables/useCompiledOrders";

// Resolved here, not by name in :is — a bare "NuxtLink" string there renders
// an unknown element that goes nowhere.
const NuxtLink = resolveComponent("NuxtLink");

const props = withDefaults(defineProps<{ attachment: ChatAttachment; link?: boolean }>(), { link: true });

const kindLabel = computed(() => {
  const a = props.attachment;
  if (a.type === "order") return `Order #${a.orderId.slice(0, 8)}`;
  return a.kind === "auction" ? "Auction" : "Listing";
});

const title = computed(() => {
  const a = props.attachment;
  if (a.type === "order") {
    return a.itemCount > 1 ? `${a.firstItemName} + ${a.itemCount - 1} more` : a.firstItemName;
  }
  return a.name;
});

const detail = computed(() => {
  const a = props.attachment;
  if (a.type === "order") {
    return a.status ? `${compiledOrderStatusLabel(a.status as CompiledOrderStatus)} when shared` : "";
  }
  return a.kind === "auction" ? `Current bid${a.subtitle ? ` · ${a.subtitle}` : ""}` : a.subtitle;
});

const price = computed(() =>
  props.attachment.type === "order" ? props.attachment.total : props.attachment.price,
);
</script>

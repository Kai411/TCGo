<template>
  <NuxtLink
    :to="to"
    class="block group min-w-0"
  >
    <div
      class="flex gap-3 sm:gap-4 items-center bg-white dark:bg-white/[0.04] rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-white/[0.08] hover:border-pokemon-red/40 transition-colors"
      :class="{ 'opacity-60': dim }"
    >
      <div
        class="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden"
      >
        <img
          v-if="image"
          :src="cdnUrl(image, 200)"
          :alt="title"
          loading="lazy"
          class="w-full h-full object-cover"
        />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="font-semibold text-sm text-ink dark:text-white truncate group-hover:text-pokemon-red transition-colors"
        >
          {{ title }}
        </p>
        <p
          v-if="subtitle"
          class="text-xs text-ink-muted dark:text-zinc-400 truncate"
        >
          {{ subtitle }}
        </p>
        <div
          v-if="$slots.meta"
          class="mt-1 flex flex-wrap items-center text-xs gap-x-2 gap-y-0.5"
        >
          <slot name="meta" />
        </div>
      </div>
      <div v-if="$slots.actions" class="shrink-0 flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { cdnUrl } from "~/composables/useStorage";

defineProps<{
  to: string;
  image?: string;
  title: string;
  subtitle?: string;
  dim?: boolean;
}>();
</script>

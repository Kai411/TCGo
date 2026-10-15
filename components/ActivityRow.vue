<template>
  <NuxtLink
    :to="to"
    class="block group min-w-0"
  >
    <!-- Phones: a flat row split by hairlines, with a card-shaped thumbnail
         and any actions under the text so they never squeeze the title.
         From lg up it's the bordered card it always was. -->
    <div
      class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 items-center py-3 border-b border-black/[0.06] dark:border-white/[0.08] transition-opacity duration-150 active:opacity-60 lg:flex lg:gap-4 lg:items-center lg:p-4 lg:bg-white lg:dark:bg-white/[0.04] lg:rounded-xl lg:border lg:border-gray-200 lg:dark:border-white/[0.08] lg:hover:border-pokemon-red/40 lg:transition-colors lg:active:opacity-100"
      :class="{ 'opacity-60': dim }"
    >
      <div
        class="w-14 aspect-[5/7] shrink-0 self-start bg-gray-100 dark:bg-white/[0.04] rounded-md overflow-hidden lg:w-16 lg:h-16 lg:aspect-auto lg:self-auto lg:rounded-lg"
        :class="{ 'row-span-2': $slots.actions }"
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
          class="font-medium lg:font-semibold text-sm leading-snug lg:leading-5 text-ink dark:text-white line-clamp-2 lg:line-clamp-1 lg:group-hover:text-pokemon-red transition-colors"
        >
          {{ title }}
        </p>
        <p
          v-if="subtitle"
          class="mt-0.5 lg:mt-0 text-xs text-ink-muted dark:text-zinc-400 truncate"
        >
          {{ subtitle }}
        </p>
        <div
          v-if="$slots.meta"
          class="mt-1.5 lg:mt-1 flex flex-wrap items-center text-xs gap-x-2 gap-y-0.5"
        >
          <slot name="meta" />
        </div>
      </div>
      <div v-if="$slots.actions" class="col-start-2 flex items-center gap-2 lg:shrink-0">
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

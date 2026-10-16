<template>
  <!-- Back link plus page title for pages reached from somewhere else.

       Phones: one row like a native nav bar, a chevron that goes back and
       then the title, so the back link costs no extra height.
       Desktop: the page's own back link, passed in the default slot so each
       page keeps exactly what it had; with no slot, a "‹ Account" link (and
       the title when `desktopTitle` is set). -->
  <div class="select-none">
    <div class="lg:hidden flex items-center gap-1" :class="inline ? '' : 'mb-3'">
      <NuxtLink
        :to="back"
        :aria-label="`Back to ${backLabel}`"
        class="-ml-3 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-ink dark:text-white transition-transform duration-150 active:scale-90"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </NuxtLink>
      <component :is="tag" class="text-xl font-bold text-ink dark:text-white truncate">{{ title }}</component>
    </div>
    <div class="hidden lg:block">
      <slot>
        <div class="mb-3">
          <NuxtLink
            :to="back"
            class="-ml-2 inline-flex items-center gap-1 min-h-[44px] px-2 text-sm font-medium text-ink-muted dark:text-zinc-400 hover:text-ink dark:hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {{ backLabel }}
          </NuxtLink>
          <h1 v-if="desktopTitle" class="text-2xl font-bold text-ink dark:text-white">{{ title }}</h1>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    back?: string;
    backLabel?: string;
    /** Show the title under the back link on desktop too (default slot only). */
    desktopTitle?: boolean;
    /** No bottom margin on the phone row, for headers inside a toolbar row. */
    inline?: boolean;
    /** Element for the phone title; "p" when the page has its own h1. */
    tag?: string;
  }>(),
  { back: "/account", backLabel: "Account", desktopTitle: false, inline: false, tag: "h1" },
);
</script>

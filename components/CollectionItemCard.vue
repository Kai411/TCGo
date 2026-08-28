<template>
  <div
    class="group relative surface rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] transition-shadow hover:shadow-card"
  >
    <NuxtLink
      :to="`/collection/${card.productId}`"
      class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pokemon-blue"
      :aria-label="`View ${card.name} price details`"
    >
      <div
        class="aspect-[2.5/3.5] overflow-hidden bg-canvas-sunken dark:bg-white/[0.04] transition-transform duration-300 ease-premium group-hover:scale-[1.02]"
      >
        <CardImage :src="card.imageUrl" :alt="card.name" />
      </div>

      <div class="p-2.5" :class="readonly ? '' : 'pr-11'">
        <p
          class="font-semibold text-sm text-ink dark:text-white truncate"
          :title="card.name"
        >
          {{ card.name }}
        </p>
        <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
          {{ card.setName }}<span v-if="card.number"> · {{ card.number }}</span>
        </p>
        <div class="flex items-center justify-between mt-2">
          <p
            v-if="card.price"
            class="text-md font-[900] text-ink dark:text-white tabular-nums"
          >
            {{ card.price.market.toFixed(2) }}
            <span class="text-xs font-semibold">MYR</span>
          </p>
          <p v-else class="text-[11px] text-gray-400 dark:text-zinc-500">
            No price
          </p>
        </div>
      </div>
    </NuxtLink>

    <button
      v-if="!readonly"
      type="button"
      :disabled="busy"
      @click="$emit('toggle')"
      :class="[
        'absolute bottom-2.5 right-2.5 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-base font-bold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pokemon-blue disabled:cursor-wait disabled:opacity-75',
        busy
          ? 'bg-gray-400'
          : inCollection
          ? 'bg-gray-400 hover:bg-pokemon-red'
          : 'bg-pokemon-blue hover:bg-blue-700',
      ]"
      :aria-label="
        busy
          ? 'Updating collection'
          : inCollection
            ? 'Remove from collection'
            : 'Add to collection'
      "
      :aria-busy="busy"
      :title="
        busy
          ? 'Updating collection…'
          : inCollection
            ? 'Remove from collection'
            : 'Add to collection'
      "
    >
      <svg
        v-if="busy"
        class="h-3.5 w-3.5 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="opacity-30"
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          stroke-width="3"
        />
        <path
          class="opacity-90"
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
      </svg>
      <span v-else class="leading-none -mt-0.5">{{ inCollection ? "−" : "+" }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";

defineProps<{
  card: CatalogMatch;
  inCollection: boolean;
  // Hide the +/- button — used when showcasing a collection read-only
  // (e.g. on a profile page).
  readonly?: boolean;
  // Prevent duplicate mutations and replace the +/- glyph with a spinner.
  busy?: boolean;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

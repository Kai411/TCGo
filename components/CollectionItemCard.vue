<template>
  <div
    class="group relative surface rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] transition-shadow hover:shadow-card"
  >
    <div class="aspect-[2.5/3.5] bg-gray-100 dark:bg-white/[0.04] overflow-hidden">
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.name"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-gray-400 text-xs"
      >
        No image
      </div>
    </div>

    <div class="p-2.5">
      <p class="font-semibold text-sm text-ink dark:text-white truncate" :title="card.name">
        {{ card.name }}
      </p>
      <p class="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
        {{ card.setName }}<span v-if="card.number"> · {{ card.number }}</span>
      </p>
      <div class="flex items-center justify-between mt-2">
        <p
          v-if="card.price"
          class="text-sm font-semibold text-pokemon-red tabular-nums"
        >
          RM {{ card.price.market }}
        </p>
        <p v-else class="text-[11px] text-gray-400 dark:text-zinc-500">No price</p>

        <button
          @click="$emit('toggle')"
          :class="[
            'inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-base font-bold transition-colors shrink-0',
            inCollection
              ? 'bg-gray-400 hover:bg-pokemon-red'
              : 'bg-pokemon-blue hover:bg-blue-700',
          ]"
          :aria-label="inCollection ? 'Remove from collection' : 'Add to collection'"
          :title="inCollection ? 'Remove from collection' : 'Add to collection'"
        >
          <span class="leading-none -mt-0.5">{{ inCollection ? "−" : "+" }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";

defineProps<{
  card: CatalogMatch;
  inCollection: boolean;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

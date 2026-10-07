<template>
  <button
    type="button"
    @click="$emit('select')"
    class="text-left rounded-lg border p-2 transition-all"
    :class="
      selected
        ? 'border-pokemon-red ring-1 ring-pokemon-red/30 bg-pokemon-red/[0.04]'
        : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.16] hover:shadow-card'
    "
  >
    <div class="rounded-md overflow-hidden bg-canvas-sunken dark:bg-white/[0.04] mb-1.5">
      <CardImage :src="card.imageUrl ?? ''" :alt="card.name" />
    </div>
    <p class="text-[11px] font-semibold text-ink dark:text-white truncate leading-tight">
      {{ card.name }}
    </p>
    <p class="text-[10px] text-ink-soft dark:text-zinc-500 truncate">
      {{ card.setName }}<span v-if="card.number"> · {{ card.number }}</span>
    </p>
    <p v-if="card.price" class="text-[11px] font-bold text-ink dark:text-white tabular-price mt-0.5">
      RM {{ card.price.market.toFixed(2) }}
    </p>
  </button>
</template>

<script setup lang="ts">
import type { CatalogMatch } from "~/composables/useCardCatalog";

defineProps<{ card: CatalogMatch; selected?: boolean }>();
defineEmits<{ (e: "select"): void }>();
</script>
